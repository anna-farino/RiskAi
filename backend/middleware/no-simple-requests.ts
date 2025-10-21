import { Request, Response, NextFunction } from "express";

// Explicit allowlist of paths that can accept multipart/form-data
const MULTIPART_ALLOWED_PATHS = [
  '/threat-tracker/tech-stack/upload',  // Path at router level (without /api prefix)
  '/api/threat-tracker/tech-stack/upload'  // Full path (in case it's needed)
  // Add other upload endpoints here as they are implemented
];

export function noSimpleRequests(req: Request, res: Response, next: NextFunction) {
  const disallowed = [
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data'
  ];

  const contentType = req.headers['content-type']?.split(';')[0];
  
  // Debug logging
  console.log('[noSimpleRequests] Path:', req.path);
  console.log('[noSimpleRequests] Content-Type:', contentType);
  console.log('[noSimpleRequests] Method:', req.method);
  
  // Allow multipart/form-data ONLY for explicitly allowed paths (not URLs with query params)
  if (contentType === 'multipart/form-data') {
    // Use req.path to get just the path without query parameters
    const pathAllowed = MULTIPART_ALLOWED_PATHS.some(allowedPath => 
      req.path === allowedPath || req.path.startsWith(allowedPath + '/')
    );
    
    if (pathAllowed) {
      // Verify Origin/Referer for additional CSRF protection
      const origin = req.headers.origin || req.headers.referer;
      
      if (!origin) {
        console.error('[UPLOAD] No origin header present');
        return res.status(403).json({ error: 'Origin header required' });
      }
      
      // Parse the origin to get hostname for exact matching
      let originHostname: string;
      try {
        const url = new URL(origin);
        originHostname = url.hostname.toLowerCase();
      } catch (e) {
        console.error('[UPLOAD] Invalid origin URL:', origin);
        return res.status(403).json({ error: 'Invalid origin' });
      }
      
      // Exact domain allowlist - no substring matching to prevent bypasses
      const ALLOWED_ORIGINS = [
        // Localhost variants
        'localhost',
        '127.0.0.1',
        '::1',
        
        // Production domains (exact matches only)
        'app.risqai.co',
        'preview.risqai.co',
        'www.risqai.co',
        'risqai.co',
      ];
      
      // Special handling for Replit domains (they have unique subdomains)
      const isReplitOrigin = originHostname.endsWith('.replit.dev') || 
                             originHostname.endsWith('.repl.co') ||
                             originHostname.endsWith('.replit.app');
      
      // Check if origin is in exact allowlist
      const isExactMatch = ALLOWED_ORIGINS.includes(originHostname);
      
      // Check environment-specific origin
      const envOrigin = process.env.VITE_SERVER_URL || process.env.VITE_API_URL;
      let isEnvOrigin = false;
      if (envOrigin) {
        try {
          const envUrl = new URL(envOrigin);
          isEnvOrigin = originHostname === envUrl.hostname.toLowerCase();
        } catch (e) {
          console.error('[UPLOAD] Invalid environment origin:', envOrigin);
        }
      }
      
      // Allow if any condition is met
      const isAllowedOrigin = isExactMatch || isReplitOrigin || isEnvOrigin;
      
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
