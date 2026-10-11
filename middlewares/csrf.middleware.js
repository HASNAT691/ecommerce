const { doubleCsrf } = require("csrf-csrf");

const CSRF_SECRET =
  process.env.CSRF_SECRET ||
  process.env.SESSION_SECRET ||
  "al-rehan-garments-development-csrf-secret-key-32chars";

const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  getSessionIdentifier: (req) => req.sessionID || req.session?.id || "anonymous",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getCsrfTokenFromRequest: (req) => {
    return (
      (req.body && req.body._csrf) ||
      req.headers["x-csrf-token"] ||
      req.headers["csrf-token"]
    );
  },
  getTokenFromRequest: (req) => {
    return (
      (req.body && req.body._csrf) ||
      req.headers["x-csrf-token"] ||
      req.headers["csrf-token"]
    );
  },
});

module.exports = {
  invalidCsrfTokenError,
  generateToken: generateCsrfToken,
  generateCsrfToken,
  doubleCsrfProtection,
};