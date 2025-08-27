console.log("[ENCRYPTION STARTUP] Loading crypto module...");
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
console.log("[ENCRYPTION STARTUP] Loading Azure Identity...");
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
console.log("[ENCRYPTION STARTUP] Loading Azure KeyVault Keys...");
import { KeyClient, CryptographyClient } from "@azure/keyvault-keys";
console.log("[ENCRYPTION STARTUP] All Azure modules loaded successfully");
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
  console.log(`[ENCRYPTION] Attempting to get key client...`);
  console.log(`[ENCRYPTION] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[ENCRYPTION] AZURE_KEY_VAULT_NAME: ${process.env.AZURE_KEY_VAULT_NAME}`);
  console.log(`[ENCRYPTION] AZURE_KEY_NAME: ${process.env.AZURE_KEY_NAME}`);
  console.log(`[ENCRYPTION] AZURE_CLIENT_ID: ${process.env.AZURE_CLIENT_ID}`);
  console.log(`[ENCRYPTION] AZURE_TENANT_ID: ${process.env.AZURE_TENANT_ID}`);
  
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    console.log(`[ENCRYPTION] Not in staging/production environment, returning null`);
    return null;
  }
  
  if (!keyClient) {
    const VAULT_URL = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
    console.log(`[ENCRYPTION] Initializing Azure Key Vault client for ${process.env.NODE_ENV}`);
    console.log(`[ENCRYPTION] Vault URL: ${VAULT_URL}`);
    console.log(`[ENCRYPTION] Key name: ${KEY_NAME}`);
    
    try {
      // Try ManagedIdentityCredential first for Container Apps, fallback to DefaultAzureCredential
      if (process.env.NODE_ENV === 'production') {
        console.log(`[ENCRYPTION] Using ManagedIdentityCredential for production`);
        try {
          credential = new ManagedIdentityCredential();
          console.log(`[ENCRYPTION] ManagedIdentityCredential created`);
        } catch (miError) {
          console.error(`[ENCRYPTION] ManagedIdentityCredential failed, trying DefaultAzureCredential:`, miError);
          credential = new DefaultAzureCredential();
          console.log(`[ENCRYPTION] DefaultAzureCredential created as fallback`);
        }
      } else {
        console.log(`[ENCRYPTION] Using DefaultAzureCredential for staging`);
        credential = new DefaultAzureCredential();
      }
      console.log(`[ENCRYPTION] Credential created successfully`);
      keyClient = new KeyClient(VAULT_URL, credential);
      console.log(`[ENCRYPTION] KeyClient created successfully`);
      
      // Test the credential by attempting to get a token
      console.log(`[ENCRYPTION] Testing credential by getting token...`);
      try {
        await credential.getToken("https://vault.azure.net/.default");
        console.log(`[ENCRYPTION] Credential token test successful`);
      } catch (tokenError) {
        console.error(`[ENCRYPTION] Credential token test failed:`, tokenError);
        throw new Error(`Credential authentication failed: ${tokenError.message}`);
      }
      
    } catch (error) {
      console.error(`[ENCRYPTION] Error initializing Key Vault client:`, error);
      throw error;
    }
  }
  return keyClient;
}

const IV_LEN = 12;
const TAG_LEN = 16;

const db = drizzle(pool);

export interface TidyEnvelope {
  wrapped_dek: Uint8Array; // wrapped DEK
  key_id: string;          // full versioned key ID
  blob: Uint8Array;        // [iv | ciphertext | tag]
}

export async function envelopeEncrypt(plain: string): Promise<TidyEnvelope | string> {
  console.log(`[ENCRYPTION] envelopeEncrypt called for environment: ${process.env.NODE_ENV}`);
  console.log(`[ENCRYPTION] Plaintext length: ${plain.length}`);
  
  // In dev environment, just return the plaintext
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    console.log(`[ENCRYPTION] Returning plaintext for non-staging/production environment`);
    return plain;
  }
  
  console.log(`[ENCRYPTION] Starting encryption process for production environment`);

  console.log(`[ENCRYPTION] Generating encryption keys and IV`);
  const dek = randomBytes(32);
  const iv  = randomBytes(IV_LEN);

  console.log(`[ENCRYPTION] Performing AES encryption`);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ct  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  console.log(`[ENCRYPTION] AES encryption completed successfully`);

  // Get the latest **versioned** key id, and wrap with that version
  console.log(`[ENCRYPTION] About to call getKeyClient()`);
  const client = await getKeyClient();
  console.log(`[ENCRYPTION] getKeyClient() returned successfully`);
  console.log(`[ENCRYPTION] Got key client:`, !!client);
  console.log(`[ENCRYPTION] Got credential:`, !!credential);
  
  if (!client || !credential) throw new Error("Key Vault not available");
  
  console.log(`[ENCRYPTION] Attempting to get key: ${KEY_NAME}`);
  const latest = await client.getKey(KEY_NAME);
  console.log(`[ENCRYPTION] Got key successfully, ID: ${latest.id}`);
  
  const versionedId = latest.id!; // .../keys/<name>/<version>
  const cryptoLatest = new CryptographyClient(versionedId, credential);
  console.log(`[ENCRYPTION] Created CryptographyClient`);

  console.log(`[ENCRYPTION] Attempting to wrap key`);
  const { result: wrapped } = await cryptoLatest.wrapKey("RSA-OAEP", dek);
  console.log(`[ENCRYPTION] Key wrapped successfully`);

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
  
  // In dev environment, just return the plaintext value
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    console.log(`[ENCRYPTION] Returning plaintext value for non-staging/production environment`);
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
  }

  // Field is encrypted - decrypt it  
  const blobBuf = Buffer.from(row[fieldName] as string, 'base64');

  const iv  = blobBuf.subarray(0, IV_LEN);
  const tag = blobBuf.subarray(blobBuf.length - TAG_LEN);
  const ct  = blobBuf.subarray(IV_LEN, blobBuf.length - TAG_LEN);

  // Unwrap DEK using the exact version recorded in field-specific key_id
  const cryptoVersioned = new CryptographyClient(row[keyIdColumn] as string, credential);
  const wrappedDekBuffer = Buffer.from(row[wrappedDekColumn] as string, 'base64');
  const { result: dek } = await cryptoVersioned.unwrapKey("RSA-OAEP", wrappedDekBuffer);

  const dec = createDecipheriv("aes-256-gcm", dek, iv);
  dec.setAuthTag(tag);
  const plain = dec.update(ct, undefined, "utf8") + dec.final("utf8");

  // If stale, re-wrap the DEK under the latest **versioned** key and update
  const client = await getKeyClient();
  if (!client || !credential) throw new Error("Key Vault not available");
  
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

  return plain;
}
