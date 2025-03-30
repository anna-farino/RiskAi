import { doubleCsrf } from "csrf-csrf";

export const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!, 
  ignoredMethods: [],
  cookieName: "csrf-token",
  cookieOptions: {
    sameSite: "none",     
    secure: true,         
    path: "/",
    httpOnly: false 
  },
  getTokenFromRequest: (req) => {
    console.log("csrf-cookie", req.cookies['csrf-token'])
    console.log("csrf-token", req.headers["x-csrf-token"])
    return req.headers["x-csrf-token"] as string | undefined
  }
});
