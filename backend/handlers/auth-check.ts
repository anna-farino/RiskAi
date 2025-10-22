import { Request, Response } from 'express';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { FullRequest } from '../middleware';
import { withUserContext } from 'backend/db/with-user-context';
import { db } from 'backend/db/db';
import { organizations, subscriptionTiers } from '@shared/db/schema/organizations';
import { subsUser } from '@shared/db/schema/subscriptions';


export async function handleAuthCheck(req: Request, res: Response) {
  console.log("[👤 AUTH-CHECK] Checking if user is logged in...")
  try {
    const userId = (req as unknown as FullRequest).user.id;
    if (!userId) {
      console.log("[👤 AUTH-CHECK] No user found!")
      const err = new Error("No user found");
      (err as any).status = 400
      throw err
    }
    const userRes = await withUserContext(
      userId,
      async (db) => {
        return db
          .select()
          .from(users)
          .where(eq(users.id, userId)) 
      }
    )
    if (userRes.length===0) {
      throw new Error("No user found")
    }
    const user = userRes[0]

    console.log("[👤 AUTH-CHECK] User found", user.email)

    const organizationRes = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id,user.organizationId))
      .limit(1)

    const organizationName = organizationRes[0]?.name
    console.log("organizationName: ", organizationName)
    if (!organizationName) {
      console.log("No organization name found")
      //throw new Error("No organization name found")
    }

    const subRes = await db
      .select({
        subName: subscriptionTiers.name,
        metadata: subsUser.metadata,
      })
      .from(subsUser)
      .leftJoin(
        subscriptionTiers,
        eq(subscriptionTiers.id,subsUser.tierId)
      )
      .where(eq(subsUser.userId,userId))
      .limit(1)

    let subscriptionName = subRes[0]?.subName || 'none'
    const metadata = subRes[0]?.metadata as any || {}
    const hasPromoCode = !!metadata.promo_code
    const promoInfo = hasPromoCode ? {
      description: metadata.promo_code?.description || 'Promotional discount applied'
    } : undefined

    //console.log("Subscription name: ", subscriptionName)
    
    const jsonResponse = {
      authenticated: true,
      user: [
        {
          ...user,
          subscription: subscriptionName,
          hasPromoCode,
          promoInfo,
          permissions: (req as unknown as FullRequest).user.permissions,
          role: (req as unknown as FullRequest).user.role,
          password: "hidden",
          organizationName: organizationName || undefined
        }
      ]
    }
    //console.log("jsonResponse: ", jsonResponse)
    res.status(200).json(jsonResponse);

  } catch(error: unknown) {
    let message: string;
    let status: number;
    if (error instanceof Error) {
      message = error.message
      status = (error as any).status || 500
    } else {
      message = String(error)
      status = 500
    }
    console.error(message)
    res.status(status).json({ message })
  }

}
