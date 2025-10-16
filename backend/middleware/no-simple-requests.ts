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
      
      // In production, the origin should match the request host
      // In development, allow localhost origins
      const host = req.get('host');
      const protocol = req.protocol;
      const requestOrigin = `${protocol}://${host}`;
      
      // Allow same-origin or localhost for development
      const isValidOrigin = origin && (
        origin.startsWith(requestOrigin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      );
      
      if (!isValidOrigin) {
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
