import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string) {
  const iv       = randomBytes(12);
  const cipher   = createCipheriv('aes-256-gcm', KEY, iv);
  const enc      = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag      = cipher.getAuthTag();

  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(blobB64: string) {
  const blob = Buffer.from(blobB64, 'base64');

  const iv   = blob.subarray(0, 12);
  const tag  = blob.subarray(12, 28);
  const enc  = blob.subarray(28);
  const dec  = createDecipheriv('aes-256-gcm', KEY, iv);
  dec.setAuthTag(tag);

  return dec.update(enc, undefined, 'utf8') + dec.final('utf8');
}
