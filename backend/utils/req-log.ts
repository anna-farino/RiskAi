import { Request } from "express"

export function reqLog(req: Request, ...args: any[]) {
  (req as Request & { log: (...args: any[]) => void }).log(...args)
}
