import { Request } from 'express';
import { reqLog } from './req-log';

const lock = new Map<string, boolean>();

type Args = {
  req: Request,
  refreshToken: string,
  asyncFn: (...args: any) => any
}

export async function refreshTokenLock({ req, refreshToken, asyncFn }: Args) {
  reqLog(req, "🔒 LOCK-CHECK")

  const previousCall = lock.get(refreshToken) 
  reqLog(req, "Token already refreshed:", !!previousCall, refreshToken)

  if (previousCall) return
  reqLog(req, "Token not present", refreshToken)

  lock.set(refreshToken,true)
  setTimeout(()=>lock.delete(refreshToken), 1000)

  try {
    await asyncFn()
  } catch(error) {
    console.error(error)
  } 
}
