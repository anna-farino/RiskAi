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
      
      // Check various allowed origins
      const isLocalhost = origin && (
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')
      );
      
      // For Replit, check if origin contains replit.dev
      const isReplitOrigin = origin && origin.includes('replit.dev');
      
      // For Azure/Production, check if origin contains the expected domains
      const isProductionOrigin = origin && (
        origin.includes('app.risqai.co') || 
        origin.includes('preview.risqai.co') ||
        origin.includes('risqai.co')
      );
      
      // Check environment variables for additional allowed origins
      const envOrigin = process.env.VITE_SERVER_URL || process.env.VITE_API_URL;
      const isEnvOrigin = envOrigin && origin && origin.startsWith(envOrigin);
      
      // Allow if any condition is met
      const isAllowedOrigin = isLocalhost || isReplitOrigin || isProductionOrigin || isEnvOrigin;
      
      if (!isAllowedOrigin) {
        console.error('[UPLOAD] Origin validation failed. Origin:', origin);
        console.error('[UPLOAD] Environment origin:', envOrigin);
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
      
      console.log('[UPLOAD] Origin validation passed. Origin:', origin);
      return next();
    }
  }
  
  if (contentType && disallowed.includes(contentType)) {
    return res.status(415).json({ error: 'Unsupported Content-Type' });
  }

  next();
};
