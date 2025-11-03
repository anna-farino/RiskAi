import { db } from "backend/db/db";
import { allowedEmails, User } from "@shared/db/schema/user";
import { eq, or } from "drizzle-orm";
import { Request } from "express";

export default async function attachUserAllowed(user: User, req: Request) {
  if (!req.user) {
    throw new Error("Attach org to request ERROR: No user found in request")
  }
  const email = user.email
  try {
      const domain = email.split('@')[1];
      const allowedUser = await db
        .select()
        .from(allowedEmails)
        .where(
          domain
            ? or(
                eq(allowedEmails.name, email),
                eq(allowedEmails.name, domain)
              )
            : eq(allowedEmails.name, email)
        )
        .limit(1);

    const userAllowed = allowedUser.length > 0;

    (req.user as any).isAllowed = userAllowed

  } catch(error) {
    console.error("There was an error while attaching the organization name to the request: ", error)
    throw error
  }
}

