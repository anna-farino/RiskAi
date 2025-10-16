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
      
      // Get allowed origins from environment variable or use defaults for development
      const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
      const allowedSuffixesEnv = process.env.ALLOWED_DOMAIN_SUFFIXES || '';
      
      // Parse environment variables (comma-separated lists)
      const envOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(',').map(o => o.trim()) : [];
      const envSuffixes = allowedSuffixesEnv ? allowedSuffixesEnv.split(',').map(s => s.trim()) : [];
      
      // Default origins for development
      const defaultOrigins = [
        'http://localhost:5000',
        'http://localhost:3000', 
        'http://127.0.0.1:5000',
        'http://127.0.0.1:3000',
      ];
      
      // Default suffixes for Replit deployments
      const defaultSuffixes = [
        '.replit.app',
        '.repl.co'
      ];
      
      // Combine environment and defaults
      const TRUSTED_ORIGINS = envOrigins.length > 0 ? envOrigins : defaultOrigins;
      const TRUSTED_DOMAIN_SUFFIXES = envSuffixes.length > 0 ? envSuffixes : defaultSuffixes;
      
      // Check if origin is trusted
      let isValidOrigin = false;
      
      if (origin) {
        // Check exact origin matches
        if (TRUSTED_ORIGINS.includes(origin)) {
          isValidOrigin = true;
        } else {
          // Parse the origin URL properly
          try {
            const originUrl = new URL(origin);
            const hostname = originUrl.hostname;
            
            // Check if hostname matches trusted domain patterns
            isValidOrigin = TRUSTED_DOMAIN_SUFFIXES.some(suffix => {
              // For '.replit.app', we want to match:
              // - 'something.replit.app' (subdomain)
              // - 'replit.app' (bare domain)
              // But NOT 'evilreplit.app' (missing dot)
              
              if (suffix.startsWith('.')) {
                // Remove leading dot for bare domain check
                const bareDomain = suffix.slice(1);
                return hostname === bareDomain || hostname.endsWith(suffix);
              }
              // For non-dot-prefixed suffixes (shouldn't happen with our config)
              return hostname === suffix;
            });
          } catch (e) {
            // Invalid URL format - reject
            isValidOrigin = false;
          }
        }
      }
      
      if (!isValidOrigin) {
        console.error(`[SECURITY] Blocked multipart request from untrusted origin: ${origin}`);
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
