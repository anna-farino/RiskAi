import { FullRequest } from ".";
import { Response, NextFunction } from "express";
import dotenv from 'dotenv'
import dotenvConfig from "backend/utils/dotenv-config";

dotenvConfig(dotenv)

const restrictAccess = process.env.RESTRICT_ACCESS

export default async function userAllowedMiddleware(req: FullRequest, res: Response, next: NextFunction) {
  if (restrictAccess && !req.user.isAllowed) {
    console.error("User is not allowed! ", req.user)
    res.status(401).json({ message: "User is not allowed" })
    return
  }
  next()
}
