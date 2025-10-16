import { Request, Response, NextFunction } from "express";

// Explicit allowlist of paths that can accept multipart/form-data
const MULTIPART_ALLOWED_PATHS = [
  '/api/threat-tracker/tech-stack/upload'
  // Add other upload endpoints here as they are implemented
];

export function noSimpleRequests(req: Request, res: Response, next: NextFunction) {
  const disallowed = [
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data'
  ];

  const contentType = req.headers['content-type']?.split(';')[0];
  
  // Allow multipart/form-data ONLY for explicitly allowed paths (not URLs with query params)
  if (contentType === 'multipart/form-data') {
    // Use req.path to get just the path without query parameters
    const pathAllowed = MULTIPART_ALLOWED_PATHS.some(allowedPath => 
      req.path === allowedPath || req.path.startsWith(allowedPath + '/')
    );
    
    if (pathAllowed) {
      // Verify Origin/Referer for additional CSRF protection
      const origin = req.headers.origin || req.headers.referer;
      const expectedOrigin = process.env.VITE_SERVER_URL415  || process.env.VITE_SERVER_URL_DEV || 'http://localhost:5000';
      
      if (!origin || !origin.startsWith(expectedOrigin)) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
      
      return next();
    }
  }
  
  if (contentType && disallowed.includes(contentType)) {
    return res.status(415).json({ error: 'Unsupported Content-Type' });
  }

  next();
};
