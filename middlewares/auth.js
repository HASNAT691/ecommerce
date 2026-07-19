// Middleware to check if user is authenticated (using session)
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next(); // User is authenticated, proceed
  } else {
    // If it's an API request (XHR), send JSON error
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(401).json({ error: "Unauthorized: Please log in." });
    }
    // For page requests, store the intended URL and redirect to login
    req.session.returnTo = req.originalUrl; // Store the URL the user was trying to access
    res.redirect("/user/login"); // Redirect to your login page
  }
};
