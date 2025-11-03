import { db } from "backend/db/db";
import { subFreeUsers, User, users } from "@shared/db/schema/user";
import { eq, or } from "drizzle-orm";
import { Request } from "express";


export default async function attachOnBoardingInfoToRequest(user: User, req: Request) {
  console.log("Attach onBoardingInfo")
  if (!req.user) {
    throw new Error("Attach org to request ERROR: No user found in request")
  }
  try {
    const email = user.email
    const domain = email.split('@')[1]
    if (!email || !domain) {
      throw new Error("No valid email found in user")
    }
    const result = await db
      .select()
      .from(subFreeUsers)
      .where(or(
        eq(subFreeUsers.pattern,email),
        eq(subFreeUsers.pattern,domain),
      ));

    console.log("Sub free user: ", email, domain, result.length>0);

    (req.user as any).subFree = result.length > 0  

  } catch(error) {
    console.error("There was an error while attaching the onboarding info to the request: ", error)
    throw error
  }
}
