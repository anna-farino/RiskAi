import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { KeyClient, CryptographyClient } from "@azure/keyvault-keys";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "backend/db/db";
import { eq } from "drizzle-orm";
import { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { Column } from "drizzle-orm";
import { withUserContext } from "backend/db/with-user-context";

const KEY_NAME = process.env.AZURE_KEY_NAME || "";

// Credential management with refresh tracking
let keyClient: KeyClient | null = null;
let credential: DefaultAzureCredential | ManagedIdentityCredential | null = null;
let lastTokenCheck: number = 0;
let currentToken: { expiresOnTimestamp: number } | null = null;

/**
 * Check if the current credential token is expired or will expire soon
 */
async function isCredentialTokenExpired(): Promise<boolean> {
  if (!credential || !currentToken) {
    return true; // No credential or token info means we need to refresh
  }

  const now = Date.now();
  const timeToExpiry = currentToken.expiresOnTimestamp - now;
  const fiveMinutesInMs = 5 * 60 * 1000;

  // Consider expired if less than 5 minutes remaining
  if (timeToExpiry < fiveMinutesInMs) {
    console.log(`[ENCRYPTION] Token expires in ${Math.round(timeToExpiry / 1000 / 60)} minutes, refreshing...`);
    return true;
  }

  return false;
}

/**
 * Initialize or refresh the Azure credential with retry logic
 */
async function initializeOrRefreshCredential(force: boolean = false): Promise<void> {
  const now = Date.now();

  // Only check token expiry every 30 seconds to avoid excessive calls
  if (!force && (now - lastTokenCheck) < 30000 && credential && currentToken) {
    const isExpired = await isCredentialTokenExpired();
    if (!isExpired) {
      return; // Current credential is still valid
    }
  }

  lastTokenCheck = now;

  try {
    console.log(`[ENCRYPTION] ${force ? 'Force refreshing' : 'Initializing'} Azure credential...`);

    let newCredential: DefaultAzureCredential | ManagedIdentityCredential;

    // Initialize credential based on environment
    if (process.env.NODE_ENV === 'production') {
      newCredential = new ManagedIdentityCredential();

      // Test ManagedIdentity first
      try {
        const token = await newCredential.getToken("https://vault.azure.net/.default");
        console.log(`[ENCRYPTION] ManagedIdentityCredential successful, token expires in ${Math.round((token.expiresOnTimestamp - Date.now()) / 1000 / 60)} minutes`);
        currentToken = token;
      } catch (miTokenError) {
        console.log(`[ENCRYPTION] ManagedIdentityCredential failed, falling back to DefaultAzureCredential:`, miTokenError);
        newCredential = new DefaultAzureCredential();
        const token = await newCredential.getToken("https://vault.azure.net/.default");
        console.log(`[ENCRYPTION] DefaultAzureCredential successful, token expires in ${Math.round((token.expiresOnTimestamp - Date.now()) / 1000 / 60)} minutes`);
        currentToken = token;
      }
    } else {
      newCredential = new DefaultAzureCredential();
      const token = await newCredential.getToken("https://vault.azure.net/.default");
      console.log(`[ENCRYPTION] DefaultAzureCredential successful, token expires in ${Math.round((token.expiresOnTimestamp - Date.now()) / 1000 / 60)} minutes`);
      currentToken = token;
    }

    // If we get here, credential initialization succeeded
    credential = newCredential;

    // Reset KeyClient so it gets recreated with new credential
    keyClient = null;

  } catch (error) {
    console.error(`[ENCRYPTION] Failed to initialize/refresh credential:`, error);
    // Reset all state on failure
    credential = null;
    keyClient = null;
    currentToken = null;
    throw error;
  }
}

/**
 * Get Key Vault client with automatic credential refresh
 */
async function getKeyClient(): Promise<KeyClient | null> {
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    return null;
  }

  const VAULT_URL = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;

  try {
    // Check and refresh credential if needed
    await initializeOrRefreshCredential();

    // Create KeyClient if not exists or if credential was refreshed
    if (!keyClient && credential) {
      console.log(`[ENCRYPTION] Creating new KeyClient with refreshed credential`);
      keyClient = new KeyClient(VAULT_URL, credential);
    }

    return keyClient;

  } catch (error) {
    console.error(`[ENCRYPTION] Error getting Key Vault client:`, error);
    throw error;
  }
}

/**
 * Enhanced credential-aware operation with retry logic
 */
async function executeWithCredentialRetry<T>(
  operation: (cred: DefaultAzureCredential | ManagedIdentityCredential) => Promise<T>,
  operationName: string,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Ensure we have a valid credential
      await initializeOrRefreshCredential(attempt > 0); // Force refresh on retry

      if (!credential) {
        throw new Error(`Credential not available after initialization attempt ${attempt + 1}`);
      }

      console.log(`[ENCRYPTION] Executing ${operationName} (attempt ${attempt + 1}/${maxRetries})`);
      const result = await operation(credential);

      if (attempt > 0) {
        console.log(`[ENCRYPTION] ${operationName} succeeded after ${attempt + 1} attempts`);
      }

      return result;

    } catch (error) {
      lastError = error as Error;
      console.error(`[ENCRYPTION] ${operationName} failed on attempt ${attempt + 1}:`, error);

      // Check if this is a credential-related error
      const errorMessage = String(error).toLowerCase();
      const isCredentialError = errorMessage.includes('credential') ||
                               errorMessage.includes('unauthorized') ||
                               errorMessage.includes('authentication') ||
                               errorMessage.includes('forbidden') ||
                               errorMessage.includes('token');

      if (isCredentialError && attempt < maxRetries - 1) {
        console.log(`[ENCRYPTION] Credential error detected, will retry with fresh credential`);
        // Force reset credential state for retry
        credential = null;
        keyClient = null;
        currentToken = null;

        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // If not a credential error or we've exhausted retries, fail
      break;
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

/**
 * Get current credential status for debugging/monitoring
 */
export async function getCredentialStatus(): Promise<{
  hasCredential: boolean;
  credentialType?: string;
  tokenExpiry?: number;
  timeToExpiry?: number;
  isExpired?: boolean;
  lastCheck: number;
}> {
  const now = Date.now();

  if (!credential || !currentToken) {
    return {
      hasCredential: false,
      lastCheck: lastTokenCheck
    };
  }

  const timeToExpiry = currentToken.expiresOnTimestamp - now;
  const isExpired = timeToExpiry <= 0;

  return {
    hasCredential: true,
    credentialType: credential.constructor.name,
    tokenExpiry: currentToken.expiresOnTimestamp,
    timeToExpiry,
    isExpired,
    lastCheck: lastTokenCheck
  };
}

const IV_LEN = 12;
const TAG_LEN = 16;

const db = drizzle(pool);

/**
 * Utility function to detect if a string is likely base64 encoded data vs plaintext
 */
function isLikelyBase64EncodedData(value: string): boolean {
  if (!value || value.length === 0) return false;

  // Base64 strings are typically much longer than regular keywords
  if (value.length < 20) return false;

  // Check if it matches base64 pattern (alphanumeric + / + = padding)
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Pattern.test(value)) return false;

  // Check if length is divisible by 4 (base64 requirement)
  if (value.length % 4 !== 0) return false;

  // Additional heuristic: base64 encoded encrypted data is typically 100+ chars
  if (value.length < 50) return false;

  // Try to decode and see if it contains binary data patterns
  try {
    const decoded = Buffer.from(value, 'base64');
    // If most bytes are non-printable (encrypted data), it's likely base64 encoded
    const nonPrintableCount = decoded.filter(byte => byte < 32 || byte > 126).length;
    return nonPrintableCount / decoded.length > 0.5;
  } catch {
    return false;
  }
}

/**
 * Attempt to recover a corrupted keyword by detecting if it contains base64 data
 */
function attemptCorruptedKeywordRecovery(value: string): { recovered: boolean; plaintext?: string; error?: string } {
  if (!isLikelyBase64EncodedData(value)) {
    return { recovered: false, error: 'Value does not appear to be base64 encoded data' };
  }

  console.log(`[ENCRYPTION] Attempting recovery of corrupted keyword with length ${value.length}`);

  try {
    // Try to decode the base64 and see if it yields readable text
    const decoded = Buffer.from(value, 'base64');
    const decodedText = decoded.toString('utf8');

    // Check if decoded text looks like a reasonable keyword (printable, reasonable length)
    if (decodedText.length > 0 && decodedText.length < 100 && /^[\x20-\x7E]*$/.test(decodedText)) {
      console.log(`[ENCRYPTION] Successfully recovered corrupted keyword: "${decodedText}"`);
      return { recovered: true, plaintext: decodedText };
    } else {
      console.log(`[ENCRYPTION] Decoded text doesn't look like a valid keyword: ${decodedText.slice(0, 50)}...`);
      return { recovered: false, error: 'Decoded text is not a valid keyword' };
    }
  } catch (error) {
    console.log(`[ENCRYPTION] Failed to decode base64 during recovery: ${error}`);
    return { recovered: false, error: 'Failed to decode base64' };
  }
}

export interface TidyEnvelope {
  wrapped_dek: Uint8Array; // wrapped DEK
  key_id: string;          // full versioned key ID
  blob: Uint8Array;        // [iv | ciphertext | tag]
}

export async function envelopeEncrypt(plain: string): Promise<TidyEnvelope | string> {
  // In dev environment, just return the plaintext
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    return plain;
  }

  const dek = randomBytes(32);
  const iv  = randomBytes(IV_LEN);

  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ct  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Get the latest **versioned** key id, and wrap with that version
  const client = await getKeyClient();
  if (!client) throw new Error("Key Vault not available");

  const latest = await client.getKey(KEY_NAME);
  const versionedId = latest.id!; // .../keys/<name>/<version>

  // Use credential retry for DEK wrapping during encryption
  const wrapped = await executeWithCredentialRetry(
    async (cred) => {
      const cryptoLatest = new CryptographyClient(versionedId, cred);
      const { result } = await cryptoLatest.wrapKey("RSA-OAEP", dek);
      return result;
    },
    `DEK wrap for encryption (keyId: ${versionedId})`
  );

  return {
    wrapped_dek: wrapped,
    key_id: versionedId,
    blob: Buffer.concat([iv, ct, tag]),
  };
}

export async function envelopeDecryptAndRotate(
  table: PgTable<TableConfig> & { id: Column<any, any, any> },
  rowId: string,
  fieldName: string,
  userId: string
): Promise<string> {
  console.log(`[ENCRYPTION] envelopeDecryptAndRotate called for environment: ${process.env.NODE_ENV}, userId: ${userId}, rowId: ${rowId}, fieldName: ${fieldName}`);

  // Add timing to help identify slow decryptions
  const startTime = Date.now();
  
  // In dev environment, just return the plaintext value
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    const row = await withUserContext(userId, (contextDb) => 
      contextDb.select().from(table).where(eq(table.id, rowId)).then(rows => rows[0])
    );
    if (!row) throw new Error(`Row ${rowId} not found`);
    return row[fieldName] as string || "";
  }

  console.log(`[ENCRYPTION] Not in dev environment. NODE_ENV: ${process.env.NODE_ENV}`)

  const row = await withUserContext(userId, (contextDb) => 
    contextDb.select().from(table).where(eq(table.id, rowId)).then(rows => rows[0])
  );

  if (!row) throw new Error(`Row ${rowId} not found`);

  // Build field-specific metadata column names (camelCase)
  const capitalizedField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  const wrappedDekColumn = `wrappedDek${capitalizedField}`;
  const keyIdColumn = `keyId${capitalizedField}`;

  // Check if field is not encrypted (no field-specific metadata)
  if (!row[wrappedDekColumn] || !row[keyIdColumn]) {
    // Field is not encrypted - encrypt it now and update the row
    const plaintext = row[fieldName] as string;
    if (!plaintext) return "";
    
    try {
      const envelope = (await envelopeEncrypt(plaintext)) as TidyEnvelope;
      if (!envelope) return plaintext; // Encryption was skipped in dev
      
      // Update the row with encrypted data
      await withUserContext(userId, (contextDb) => 
        contextDb
          .update(table)
          .set({
            [wrappedDekColumn]: Buffer.from(envelope.wrapped_dek).toString('base64'),
            [keyIdColumn]: envelope.key_id,
            [fieldName]: Buffer.from(envelope.blob).toString('base64')
          })
          .where(eq(table.id, rowId))
      );
      
      return plaintext;
    } catch (error) {
      console.error(`[ENCRYPTION] Failed to encrypt plaintext field, returning as-is:`, error);
      return plaintext;
    }
  }

  // Field is encrypted - decrypt it  
  try {
    const blobBuf = Buffer.from(row[fieldName] as string, 'base64');

    const iv  = blobBuf.subarray(0, IV_LEN);
    const tag = blobBuf.subarray(blobBuf.length - TAG_LEN);
    const ct  = blobBuf.subarray(IV_LEN, blobBuf.length - TAG_LEN);

    // Unwrap DEK using the exact version recorded in field-specific key_id with credential retry
    const wrappedDekBuffer = Buffer.from(row[wrappedDekColumn] as string, 'base64');
    const keyId = row[keyIdColumn] as string;

    const dek = await executeWithCredentialRetry(
      async (cred) => {
        const cryptoVersioned = new CryptographyClient(keyId, cred);
        const { result } = await cryptoVersioned.unwrapKey("RSA-OAEP", wrappedDekBuffer);
        return result;
      },
      `DEK unwrap for field '${fieldName}' (keyId: ${keyId})`
    );

    const dec = createDecipheriv("aes-256-gcm", dek, iv);
    dec.setAuthTag(tag);
    const plain = dec.update(ct, undefined, "utf8") + dec.final("utf8");

    // If stale, re-wrap the DEK under the latest **versioned** key and update
    try {
      const client = await getKeyClient();
      if (client) {
        const latest = await client.getKey(KEY_NAME);
        const latestId = latest.id!;
        if (row[keyIdColumn] !== latestId) {
          console.log(`[ENCRYPTION] Rotating key from ${row[keyIdColumn]} to ${latestId}`);

          // Use credential retry for key rotation
          const newWrapped = await executeWithCredentialRetry(
            async (cred) => {
              const cryptoLatest = new CryptographyClient(latestId, cred);
              const { result } = await cryptoLatest.wrapKey("RSA-OAEP", dek);
              return result;
            },
            `Key rotation wrap for field '${fieldName}' (new keyId: ${latestId})`
          );

          await withUserContext(userId, (contextDb) =>
            contextDb
              .update(table)
              .set({
                [wrappedDekColumn]: Buffer.from(newWrapped).toString('base64'),
                [keyIdColumn]: latestId
              })
              .where(eq(table.id, rowId))
          );

          console.log(`[ENCRYPTION] Key rotation completed for field '${fieldName}' in row ${rowId}`);
        }
      }
    } catch (rotationError) {
      console.warn(`[ENCRYPTION] Key rotation failed, continuing with decrypted value:`, rotationError);
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`[ENCRYPTION] Successfully decrypted field '${fieldName}' for row ${rowId} in ${elapsedTime}ms`);
    return plain;
  } catch (error) {
    console.error(`[ENCRYPTION] Decryption failed for field '${fieldName}' in row ${rowId}. Error:`, error);

    const fieldValue = row[fieldName] as string;
    if (!fieldValue) {
      console.log(`[ENCRYPTION] Field '${fieldName}' is empty, returning empty string`);
      return "";
    }

    // CRITICAL FIX: Check if the field contains base64 encoded data (corrupted state)
    if (isLikelyBase64EncodedData(fieldValue)) {
      console.error(`[ENCRYPTION] CORRUPTION DETECTED: Field '${fieldName}' contains base64 data instead of plaintext. Attempting recovery...`);

      // Try to recover the corrupted keyword
      const recovery = attemptCorruptedKeywordRecovery(fieldValue);
      if (recovery.recovered && recovery.plaintext) {
        console.log(`[ENCRYPTION] Successfully recovered corrupted keyword for row ${rowId}`);

        // Re-encrypt with the recovered plaintext
        try {
          const envelope = (await envelopeEncrypt(recovery.plaintext)) as TidyEnvelope;
          if (!envelope) return recovery.plaintext; // Encryption was skipped in dev

          // Update the row with properly encrypted data
          await withUserContext(userId, (contextDb) =>
            contextDb
              .update(table)
              .set({
                [wrappedDekColumn]: Buffer.from(envelope.wrapped_dek).toString('base64'),
                [keyIdColumn]: envelope.key_id,
                [fieldName]: Buffer.from(envelope.blob).toString('base64')
              })
              .where(eq(table.id, rowId))
          );

          console.log(`[ENCRYPTION] Successfully re-encrypted recovered keyword for row ${rowId}`);
          return recovery.plaintext;
        } catch (reEncryptError) {
          console.error(`[ENCRYPTION] Failed to re-encrypt recovered keyword for row ${rowId}:`, reEncryptError);
          return recovery.plaintext; // Return recovered text even if re-encryption fails
        }
      } else {
        console.error(`[ENCRYPTION] Failed to recover corrupted keyword for row ${rowId}: ${recovery.error}`);
        console.error(`[ENCRYPTION] Corrupted value preview: ${fieldValue.slice(0, 100)}...`);
        return `[CORRUPTED KEYWORD - ID: ${rowId}]`; // Return a clear indicator of corruption
      }
    }

    // If it doesn't look like base64 data, treat as potential plaintext
    console.log(`[ENCRYPTION] Field value doesn't appear to be base64, treating as plaintext and attempting re-encryption`);

    try {
      const envelope = (await envelopeEncrypt(fieldValue)) as TidyEnvelope;
      if (!envelope) {
        console.log(`[ENCRYPTION] Encryption was skipped (dev environment), returning value as-is`);
        return fieldValue;
      }

      // Update the row with newly encrypted data using current environment's key
      await withUserContext(userId, (contextDb) =>
        contextDb
          .update(table)
          .set({
            [wrappedDekColumn]: Buffer.from(envelope.wrapped_dek).toString('base64'),
            [keyIdColumn]: envelope.key_id,
            [fieldName]: Buffer.from(envelope.blob).toString('base64')
          })
          .where(eq(table.id, rowId))
      );

      console.log(`[ENCRYPTION] Successfully re-encrypted field with current environment key for row ${rowId}`);
      return fieldValue;
    } catch (reEncryptError) {
      console.error(`[ENCRYPTION] Re-encryption also failed for row ${rowId}:`, reEncryptError);
      console.error(`[ENCRYPTION] Returning field value as-is: ${fieldValue.slice(0, 50)}...`);
      return fieldValue;
    }
  }
}
