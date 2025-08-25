import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { KeyClient, CryptographyClient } from "@azure/keyvault-keys";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "backend/db/db";
import { eq } from "drizzle-orm";
import { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { Column } from "drizzle-orm";
import { withUserContext } from "backend/db/with-user-context";

const KEY_NAME = process.env.AZURE_KEY_NAME || "";

let keyClient: KeyClient | null = null;
let credential: DefaultAzureCredential | null = null;

function getKeyClient() {
  if (!keyClient && (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production')) {
    const VAULT_URL = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
    credential = new DefaultAzureCredential();
    keyClient = new KeyClient(VAULT_URL, credential);
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
  const client = getKeyClient();
  if (!client || !credential) throw new Error("Key Vault not available");
  
  const latest = await client.getKey(KEY_NAME);
  const versionedId = latest.id!; // .../keys/<name>/<version>
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
  // In dev environment, just return the plaintext value
  if (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'production') {
    const [ row ] = await withUserContext(userId, (contextDb) => 
      contextDb.select().from(table).where(eq(table.id, rowId)).then(rows => rows[0])
    ) as any;
    
    if (!row) throw new Error(`Row ${rowId} not found`);
    return row[fieldName] as string || "";
  }

  const [ row ] = await withUserContext(userId, (contextDb) => 
    contextDb.select().from(table).where(eq(table.id, rowId)).then(rows => rows[0])
  ) as any;

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
  const client = getKeyClient();
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
