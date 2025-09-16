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

let keyClient: KeyClient | null = null;
let credential: DefaultAzureCredential | ManagedIdentityCredential | null = null;

async function getKeyClient() {
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    return null;
  }
  
  if (!keyClient || !credential) {
    const VAULT_URL = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
    
    try {
      // Initialize credential
      if (process.env.NODE_ENV === 'production') {
        credential = new ManagedIdentityCredential();
        
        // Test credential immediately after creation
        try {
          await credential.getToken("https://vault.azure.net/.default");
        } catch (miTokenError) {
          console.log(`[ENCRYPTION] ManagedIdentityCredential failed, falling back to DefaultAzureCredential`);
          credential = new DefaultAzureCredential();
          await credential.getToken("https://vault.azure.net/.default");
        }
      } else {
        credential = new DefaultAzureCredential();
        await credential.getToken("https://vault.azure.net/.default");
      }
      
      keyClient = new KeyClient(VAULT_URL, credential);
      
    } catch (error) {
      console.error(`[ENCRYPTION] Error initializing Key Vault client:`, error);
      // Reset both to null on failure
      credential = null;
      keyClient = null;
      throw error;
    }
  }
  
  return keyClient;
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
  if (!client || !credential) throw new Error("Key Vault not available");
  
  const latest = await client.getKey(KEY_NAME);
  const versionedId = latest.id!; // .../keys/<name>/<version>
  
  if (!credential) {
    throw new Error(`Credential is null when trying to create CryptographyClient`);
  }
  
  const cryptoLatest = new CryptographyClient(versionedId, credential);
  const { result: wrapped } = await cryptoLatest.wrapKey("RSA-OAEP", dek);

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

    // Unwrap DEK using the exact version recorded in field-specific key_id
    if (!credential) {
      throw new Error(`Credential not available for decryption`);
    }
    
    const cryptoVersioned = new CryptographyClient(row[keyIdColumn] as string, credential);
    const wrappedDekBuffer = Buffer.from(row[wrappedDekColumn] as string, 'base64');
    const { result: dek } = await cryptoVersioned.unwrapKey("RSA-OAEP", wrappedDekBuffer);

    const dec = createDecipheriv("aes-256-gcm", dek, iv);
    dec.setAuthTag(tag);
    const plain = dec.update(ct, undefined, "utf8") + dec.final("utf8");

    // If stale, re-wrap the DEK under the latest **versioned** key and update
    try {
      const client = await getKeyClient();
      if (client && credential) {
        const latest = await client.getKey(KEY_NAME);
        const latestId = latest.id!;
        if (row[keyIdColumn] !== latestId) {
          const cryptoLatest = new CryptographyClient(latestId, credential);
          const { result: newWrapped } = await cryptoLatest.wrapKey("RSA-OAEP", dek);
          await withUserContext(userId, (contextDb) => 
            contextDb
              .update(table)
              .set({ 
                [wrappedDekColumn]: Buffer.from(newWrapped).toString('base64'), 
                [keyIdColumn]: latestId 
              })
              .where(eq(table.id, rowId))
          );
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
