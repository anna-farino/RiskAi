import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';


export async function callId(req: Request, _: Response, next: NextFunction) {
  const id = uuid().slice(0,5);

  (req as unknown as Record<any,any>).log = (...args: any[]) => console.log(`[${id}]`, ...args)

  next()
}


