import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { KeyClient, CryptographyClient } from "@azure/keyvault-keys";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "backend/db/db";
import { eq } from "drizzle-orm";
import { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { Column } from "drizzle-orm";

const VAULT_URL  = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
const KEY_NAME   = process.env.AZURE_KEY_NAME!;
const credential = new DefaultAzureCredential();
const keyClient  = new KeyClient(VAULT_URL, credential);

const IV_LEN = 12;
const TAG_LEN = 16;

const db = drizzle(pool);

export interface TidyEnvelope {
  wrapped_dek: Uint8Array; // wrapped DEK
  key_id: string;          // full versioned key ID
  blob: Uint8Array;        // [iv | ciphertext | tag]
}

export async function envelopeEncrypt(plain: string): Promise<TidyEnvelope> {
  const dek = randomBytes(32);
  const iv  = randomBytes(IV_LEN);

  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ct  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Get the latest **versioned** key id, and wrap with that version
  const latest = await keyClient.getKey(KEY_NAME);
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
  rowId: string
): Promise<string> {
  const [row] = await db.select().from(table).where(eq(table.id, rowId));
  if (!row) throw new Error(`Row ${rowId} not found`);

  // Decode blob (handles Buffer/Uint8Array/string-hex)
  const blobBuf = Buffer.isBuffer(row.blob)
    ? row.blob
    : row.blob instanceof Uint8Array
      ? Buffer.from(row.blob)
      : typeof row.blob === "string" && row.blob.startsWith("\\x")
        ? Buffer.from(row.blob.slice(2), "hex")
        : Buffer.from(row.blob as string);

  const iv  = blobBuf.subarray(0, IV_LEN);
  const tag = blobBuf.subarray(blobBuf.length - TAG_LEN);
  const ct  = blobBuf.subarray(IV_LEN, blobBuf.length - TAG_LEN);

  // Unwrap DEK using the exact version recorded in key_id
  const cryptoVersioned = new CryptographyClient(row.key_id as string, credential);
  const { result: dek } = await cryptoVersioned.unwrapKey("RSA-OAEP", row.wrapped_dek as Uint8Array);

  const dec = createDecipheriv("aes-256-gcm", dek, iv);
  dec.setAuthTag(tag);
  const plain = dec.update(ct, undefined, "utf8") + dec.final("utf8");

  // If stale, re-wrap the DEK under the latest **versioned** key and update
  const latest = await keyClient.getKey(KEY_NAME);
  const latestId = latest.id!;
  if (row.key_id !== latestId) {
    const cryptoLatest = new CryptographyClient(latestId, credential);
    const { result: newWrapped } = await cryptoLatest.wrapKey("RSA-OAEP", dek);
    await db
      .update(table)
      .set({ 
        wrapped_dek: newWrapped, 
        key_id: latestId 
      })
      .where(eq(table.id, rowId));
  }

  return plain;
}
