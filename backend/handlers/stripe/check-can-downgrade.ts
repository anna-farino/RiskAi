import getNumOfUsersTechStackKeywords from 'backend/apps/threat-tracker/router/get-num-keywords'
import { getMaxNumKeywords } from 'backend/services/unified-storage/utils/get-max-num-of-keywords'
import { getUserTierLevel } from 'backend/services/unified-storage/utils/get-user-tier-level'
import { Request, Response } from 'express'


export default async function handleCheckCanDowngrade(req: Request, res: Response) {
  console.log("Handling check can downgrade...")
  try {
    const { userId } = req.body

    if (!userId) {
      const message = "Cannot check for downgrade: userId not found"
      console.error(message)
      return res.status(400).json({ message })
    }

    const numOfUserKeywords = await getNumOfUsersTechStackKeywords(userId)
    const userTier = await getUserTierLevel(userId)

    if (userTier === 0) {
      const message = "Cannot downgrade: already on the free plan"
      console.error(message)
      return res.status(400).json({ message })
    }

    const maxNumOfKeywordsLowerPlan = getMaxNumKeywords(userTier-1)

    if (numOfUserKeywords > maxNumOfKeywordsLowerPlan) {
      const message = `User has too many keywords (${numOfUserKeywords}) to downgrade`
      console.error(message)
      return res.status(409).json({ message })
    }
    console.log(`User has only ${numOfUserKeywords} and thus can downgrade`)

    res.status(200).json({ userCanDowngrade: true })

  } catch(error) {
    const message = "An error occurred - cannot downgrade: " + error
    console.error(message)
    res.status(500).json({ message })
  }
}
