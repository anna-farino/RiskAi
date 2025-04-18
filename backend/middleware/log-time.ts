import { reqLog } from 'backend/utils/req-log';
import { Request, Response, NextFunction } from 'express'

function getCurrentDate() {
  const now = new Date();

  const year = now.getFullYear();
  // Note: getMonth() returns 0-based months, so we add 1.
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


export default function logTime(req: Request, _res: Response, next: NextFunction) {

  console.log("")
  reqLog(req, `${getCurrentDate()} path: ${req.path}, method: ${req.method}
`)

  next()
}
