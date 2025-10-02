import { db } from "backend/db/db";
import { organizations } from "@shared/db/schema/organizations";
import { User } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import { Request } from "express";


export default async function attachOrganizationToRequest(user: User, req: Request) {
  if (!req.user) {
    throw new Error("Attach org to request ERROR: No user found in request")
  }
  if (!user.organizationId) {
    console.log("User has no organization assigned")
    return
    //throw new Error("User has no organization assigned")
  }
  try {
    //console.log("User: ", user)
    const result = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id,user.organizationId))
      .limit(1)

    const organizationName = result[0]?.name
    console.log("organizationName: ", organizationName)
    if (!organizationName) {
      throw new Error("No organization name found")
    }

    (req.user as any).organizationName = organizationName 
    //console.log("req.user with org: ", req.user)

  } catch(error) {
    console.error("There was an error while attaching the organization name to the request: ", error)
    throw error
  }
}
