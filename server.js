require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const helmet = require("helmet");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path"); // <-- ADDED: Required for path manipulation for static files
const {
  generateToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
} = require("./middlewares/csrf.middleware");

// Import your routers
const cartRouter = require("./routes/cart.router");
const wishlistRouter = require("./routes/wishlist.router");
const userRouter = require("./routes/user.router");
const productsRouter = require("./routes/admin/products.router");

// Security check: enforce SESSION_SECRET in production
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("FATAL SECURITY ERROR: SESSION_SECRET must be defined in production mode.");
}

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline scripts in EJS templates — refactor to nonces in future
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://code.jquery.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline styles in EJS templates
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com", // Cloudinary product images
        ],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Allows CDN resources to load without COEP issues
  })
);

// Set up EJS layouts
var expressLayouts = require("express-ejs-layouts");
app.use(expressLayouts);
app.set("layout", "layout");
app.set("view engine", "ejs"); // Set view engine here

// Parse URL-encoded data (for form submissions) with 1MB size limit
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Parse JSON request bodies with 1MB size limit
app.use(express.json({ limit: "1mb" }));

// Parse cookies
app.use(cookieParser());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "al-rehan-garments-development-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_CONNECTION_STRING || "mongodb://127.0.0.1:27017/al-rehan-garments",
      ttl: 24 * 60 * 60, // 1 day
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files (product images, screenshots) from 'uploads' directory
// This is crucial for images to be accessible in the browser
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <-- UPDATED: Explicit '/uploads' prefix and path.join for robustness

// Initialize cart and expose global variables to all EJS templates
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = {
      items: [],
      total: 0,
    };
  }
  const cartItems = req.session.cart.items || [];
  res.locals.cart = req.session.cart;
  res.locals.cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  res.locals.isAuthenticated = !!req.session.userId;
  res.locals.isAdmin = !!req.session.isAdmin;
  res.locals.currentPath = req.path;
  try {
    res.locals.csrfToken = generateToken(req, res);
  } catch (err) {
    res.locals.csrfToken = "";
  }
  next();
});

// Multipart routes handle file streams via Multer; Multer must parse the stream first,
// so those routes apply doubleCsrfProtection after Multer at the route level.
const multipartRoutePrefixes = [
  "/checkout",
  "/admin/products/create",
  "/admin/products/edit",
];

const conditionalCsrfProtection = (req, res, next) => {
  const isMultipart = multipartRoutePrefixes.some((prefix) => req.path.startsWith(prefix));
  const contentType = req.headers["content-type"] || "";
  if (isMultipart && contentType.includes("multipart/form-data")) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
};

// Global CSRF Protection for all URL-encoded and JSON POST/PUT/DELETE requests
app.use(conditionalCsrfProtection);

// Connect to MongoDB
const connectionString = process.env.MONGODB_CONNECTION_STRING || "mongodb://127.0.0.1:27017/al-rehan-garments";
mongoose
  .connect(connectionString)
  .then(() => {
    console.log("Successfully connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err.message);
  });

// Define your routes
// Order of routes matters: more specific routes should generally come before more general ones.
app.use(cartRouter); // Contains /cart, /checkout, /add-to-cart etc.
app.use(wishlistRouter); // Assuming these have their own prefixes or specific routes
app.use(userRouter); // Contains /user/login, /profile etc.
app.use(productsRouter); // Contains /admin/* routes and /secondpage

const Product = require("./model/products.models");

app.get("/", async (req, res) => {
  try {
    const featuredProducts = await Product.find().sort({ createdAt: -1 }).limit(8);
    res.render("pages/Main_Site_pages/landingPage", { featuredProducts });
  } catch (err) {
    console.error("Error fetching landing page products:", err);
    res.render("pages/Main_Site_pages/landingPage", { featuredProducts: [] });
  }
});

// Health check endpoint for Docker / Container Orchestrators
app.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 200 : 503;
  res.status(status).json({
    status: isDbConnected ? "healthy" : "unhealthy",
    uptime: Math.floor(process.uptime()),
    database: isDbConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// 404 Page Not Found Handler
app.use((req, res, next) => {
  res.status(404).render("pages/Main_Site_pages/error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist or has been moved.",
    layout: "layout.ejs"
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Catch CSRF validation errors
  if (err === invalidCsrfTokenError || err.code === "EBADCSRFTOKEN" || (err.message && err.message.toLowerCase().includes("csrf"))) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes("json"))) {
      return res.status(403).json({ error: "Invalid or expired security token (CSRF). Please refresh and try again." });
    }
    return res.status(403).render("pages/Main_Site_pages/error", {
      title: "Security Check Failed",
      message: "Your session or security token (CSRF) has expired. Please refresh the page and try again.",
      layout: "layout.ejs",
    });
  }

  console.error("Unhandled Server Error:", err);
  res.status(500).render("pages/Main_Site_pages/error", {
    title: "Internal Server Error",
    message: "An internal server error occurred. We are working to fix this as quickly as possible. Please try again shortly.",
    layout: "layout.ejs"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port: ${PORT}`);
});
