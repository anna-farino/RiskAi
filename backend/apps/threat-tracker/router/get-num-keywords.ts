import { usersCompanies, usersHardware, usersSoftware } from "@shared/db/schema/threat-tracker/user-associations";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";


export default async function getNumOfUsersTechStackKeywords(userId: string): Promise<number> {

  return await db.transaction(async (tx) => {
    const numSoftwareKws = await tx
      .$count(
        usersSoftware,
        eq(usersSoftware.userId,userId)
      ) 
    const numHardwareKws = await tx
      .$count(
        usersHardware,
        eq(usersHardware.userId,userId)
      ) 
    const numCompaniesKws = await tx
      .$count(
        usersCompanies,
        eq(usersCompanies.userId,userId)
      ) 
    
    return numSoftwareKws + numHardwareKws + numCompaniesKws
  })
}
