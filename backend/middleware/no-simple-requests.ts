import { Request, Response, NextFunction } from "express";

export function noSimpleRequests(req: Request, res: Response, next: NextFunction) {
  const disallowed = [
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data'
  ];

  const contentType = req.headers['content-type']?.split(';')[0];
  
  if (contentType && disallowed.includes(contentType)) {
    return res.status(415).json({ error: 'Unsupported Content-Type' });
  }

  next();
};
