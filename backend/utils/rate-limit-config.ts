export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, 
  limit: 30, 
  message: "Too many requests. Try again later.",
  standardHeaders: 'draft-8', 
  legacyHeaders: false, 
  skipSuccessfulRequests: true,
  
  // Add these properties to fix the Azure Container Apps issue
  trustProxy: true,
  
  // Custom key generator to handle X-Forwarded-For issues
  keyGenerator: (req, res) => {
    let clientIP = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress;
    
    // Handle X-Forwarded-For header safely
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map(ip => ip.trim());
      clientIP = ips[0] || clientIP;
    }
    
    // Fallback to a default if we still can't determine IP
    return clientIP || 'default-key';
  },
  
  // Skip rate limiting if we can't determine the IP properly
  skip: (req, res) => {
    // Don't skip - but you could add logic here if needed
    return false;
  }
}
