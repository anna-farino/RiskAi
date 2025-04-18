import { Request } from 'express';
import { reqLog } from './req-log';

const lock = new Map<string, Promise<void>>();

type Args = {
  req: Request,
  userId: string,
  asyncFn: (...args: any) => any
}

export async function lockWrap({ req, userId, asyncFn }: Args) {

  const previousCall = lock.get(userId) ?? Promise.resolve();

  reqLog(req, previousCall)

  let release;
  const next = new Promise<void>(res => { release = res })

  lock.set(userId, previousCall.then(() => next))

  await previousCall;

  try {
    await asyncFn()
  } catch(error) {
    console.error(error)
  } finally {
    release!()
    lock.delete(userId)
  }
}
