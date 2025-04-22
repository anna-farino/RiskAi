import { db } from 'backend/db/db';
import { decrypt, encrypt } from 'backend/utils/encryption';
import { Request, Response } from 'express';
import { secrets } from '../../shared/db/schema/secrets'
import { User } from '@shared/db/schema/user';
import { Type } from '@shared/db/schema/enums/secrets-1';
import { eq } from 'drizzle-orm';


export async function storeSecret(req: Request, res: Response) {
  try {
    const user = (req as any).user as User;
    const { secret } = req.body;

    const cipherText = encrypt(secret)

    const response = await db
      .insert(secrets)
      .values({
        userId: user.id,
        type: Type.TEST,
        cipherText,
        keyId: 1,
      })
      .returning()

    if (response.length === 0) throw new Error()

    res.json({ success: true, message: "secret stored successfully"})

  } catch(err) {
    console.error(err)
    res.status(500).json({ message: "An error occurred while storing a secret"})
  }
}


export async function getSecrets(req: Request, res: Response) {
  const user = (req as any).user as User;
  console.log("[🤐 GET SECRETS] User: ", )

  try {
    const response = await db 
      .select({
        ciphertext: secrets.cipherText
      })
      .from(secrets)
      .where(eq(secrets.userId, user.id))

    const decryptedSecrets = []

    for (let secret of response) {
      decryptedSecrets.push(
        decrypt(secret.ciphertext)
      )
    }

    res.status(200).json({ secrets: decryptedSecrets })

  } catch (err) {
    console.error(err)
    res.status(500).send()
  }
}


export async function getEncryptedSecrets(req: Request, res: Response) {
  const user = (req as any).user as User;

  try {
    const response = await db
      .select({
        ciphertext: secrets.cipherText
      })
      .from(secrets)
      .where(eq(secrets.userId, user.id))
      
    res.status(200).json({ secrets: response })

  } catch(err) {
    console.error(err)
    res.status(500).send()
  }
}


export async function deleteSecrets(req: Request, res: Response) {
  const user = (req as any).user as User;

  try {
    await db
      .delete(secrets)
      .where(eq(secrets.userId, user.id))
      .returning()

    res.sendStatus(200)

  } catch(err) {
    console.error(err)
    res.sendStatus(500)
  }

}
