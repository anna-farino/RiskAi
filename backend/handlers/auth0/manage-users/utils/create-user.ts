import { db } from "backend/db/db";
import { auth0_domain } from "backend/utils/auth0/auth0-env";
import { organizations } from "@shared/db/schema/organizations";
import { eq } from "drizzle-orm";
import { users } from "@shared/db/schema/user";

type Args = {
  email: string,
  password: string
  token: string,
  organizationId: string
}
export async function createUser({ email, password, token, organizationId }: Args): Promise<boolean> {
  const orgResponse = await db
    .select({ name: organizations.name})
    .from(organizations)
    .where(eq(organizations.id,organizationId))

  if (orgResponse.length===0) {
    const message="Error: organizationId doesn't match any organization"
    console.error(message)
    throw new Error(message)
  }

  const res = await db
    .insert(users)
    .values({
      email,
      password: '',
      name: email,
      organizationId
    })
    .returning()
  
  if (res.length===0 || res[0].email!=email) {
    const message="Error while creating the user in the database"
    console.error(message)
    throw new Error(message)
  }

  const organizationName = orgResponse[0].name

  if (organizationName==="") {
    console.error("Error: missing organization name")
    return false
  }

  const response = await fetch(`${auth0_domain}/api/v2/users`, {
    method: 'POST',
    headers: { 
      'content-type': 'application/json',
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email,
      password,
      connection: "Username-Password-Authentication",
      app_metadata: {
        organizationName,
        organizationId
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json()
    console.log("Error while creating user: ", errorData)
    throw new Error(errorData)
  }
};
