import dotenvConfig from "backend/utils/dotenv-config";
import dotenv from 'dotenv'

dotenvConfig(dotenv)

type PlanPrice = {
  pro: {
    monthly: string
    yearly: string
  },
  free: {
    monthly: string
  }
}
export const planPrice: PlanPrice = {
  pro: {
    monthly: process.env.PRO_PRICE_ID_MONTHLY!,
    yearly: process.env.PRO_PRICE_ID_YEARLY!
  },
  free: {
    monthly: process.env.FREE_PRICE_ID!
  }
}
