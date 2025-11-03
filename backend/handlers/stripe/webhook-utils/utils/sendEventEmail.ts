import { SubsUser } from "@shared/db/schema/subscriptions"
import { users } from "@shared/db/schema/user"
import { db } from "backend/db/db"
import sendGrid from "backend/utils/sendGrid"
import { eq } from "drizzle-orm"

type Args = {
  subsUserRes: SubsUser[]
  subject: string
  html: string
  text?: string
}
export async function sendEventEmail({ 
  subsUserRes,
  subject,
  html,
  text
}
  : Args
) {
  if (subsUserRes[0]) {
    const [ emailRes ] = await db
      .select({ email: users.email})
      .from(users)
      .where(eq(users.id,subsUserRes[0].userId))

    if (emailRes.email) {
      sendGrid({
        to: emailRes.email,
        subject,
        html,
        text: text || html
      })

      console.log("Email sent to the user")

    } else {
      console.error("No user email found")
    }

  } else {
    console.error("No subsUser found")
  }
}
