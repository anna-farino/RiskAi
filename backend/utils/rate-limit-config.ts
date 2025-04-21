
export const rateLimitConfig = {
	windowMs: 15 * 60 * 1000, 
	limit: 30, 
  message: "Too many requests. Try again later.",
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
  skipSuccessfulRequests: true
}
