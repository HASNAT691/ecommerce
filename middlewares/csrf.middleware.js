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
  getSessionIdentifier: (req) => req.session?.id || req.sessionID || "anonymous",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getTokenFromRequest: (req) => {
    return (
      req.headers["x-csrf-token"] ||
      (req.body && req.body._csrf) ||
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