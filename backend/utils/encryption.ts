import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const NEW_KEY = process.env.NEW_ENCRYPTION_KEY 
  ? Buffer.from(process.env.NEW_ENCRYPTION_KEY, 'hex')
  : null;

const OLD_KEY = process.env.OLD_ENCRYPTION_KEY
  ? Buffer.from(process.env.OLD_ENCRYPTION_KEY, 'hex')
  : null;

const IV_LEN  = 12;
const TAG_LEN = 16;

export function encrypt(text: string): string {
  const iv     = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', NEW_KEY, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(blobB64: string | null): string | null {
  if (!blobB64) {
    console.error("Blob64 not found")
    return null;
  }
  const blob = Buffer.from(blobB64, 'base64');

  if (blob.length < IV_LEN + TAG_LEN) {
    //return null
  }

  const iv  = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct  = blob.subarray(IV_LEN + TAG_LEN);

  const tryWithKey = (key: Buffer) => {
    const dec = createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    return dec.update(ct, undefined, 'utf8') + dec.final('utf8');
  };

  try {
    //console.log("Trying with new key")
    return tryWithKey(NEW_KEY);
  } catch (err: any) {
    if (err.code === 'ERR_CRYPTO_INVALID_AUTH_TAG' && OLD_KEY) {
      try {
        //console.log("Trying with old key")
        return tryWithKey(OLD_KEY);
      } catch {
        //console.log("Just returning the blobB64")
        return blobB64
      }
    }
    //throw err;
  }
}

