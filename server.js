require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const helmet = require("helmet");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const path = require("path"); // <-- ADDED: Required for path manipulation for static files

// Import your routers
const cartRouter = require("./routes/cart.router"); // Corrected to cart.route.js based on previous context
const wishlistRouter = require("./routes/wishlist.router"); // Assuming this exists
const userRouter = require("./routes/user.router"); // Corrected to user.route.js based on previous context
let productsRouter = require("./routes/admin/products.router"); // Admin/Product routes

let app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

// Set up EJS layouts
var expressLayouts = require("express-ejs-layouts");
app.use(expressLayouts);
app.set("layout", "layout");
app.set("view engine", "ejs"); // Set view engine here

// Middleware order is important:
// Parse URL-encoded data (for form submissions)
// Fix for body-parser deprecation warning: explicitly provide the extended option
app.use(express.urlencoded({ extended: true })); // <-- UPDATED: Add { extended: true }

// Parse JSON request bodies
app.use(express.json()); // <-- Moved above cookie-parser and session for consistency

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

// Initialize cart in session if it doesn't exist (should be after session middleware)
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = {
      items: [],
      total: 0,
    };
  }
  next();
});

// Connect to MongoDB
let connectionstring = process.env.MONGODB_CONNECTION_STRING || "mongodb://127.0.0.1:27017/al-rehan-garments";
mongoose
  .connect(connectionstring)
  .then(() => {
    console.log(`Connected to ${connectionstring} `);
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err); // Use console.error for errors
  });

// Define your routes
// Order of routes matters: more specific routes should generally come before more general ones.
app.use(cartRouter); // Contains /cart, /checkout, /add-to-cart etc.
app.use(wishlistRouter); // Assuming these have their own prefixes or specific routes
app.use(userRouter); // Contains /user/login, /profile etc.
app.use(productsRouter); // Contains /admin/* routes and /secondpage

app.get("/", (req, res) => {
  res.render("pages/Main_Site_pages/landingPage");
});

// 404 Page Not Found Handler
app.use((req, res, next) => {
  res.status(404).render("pages/Main_Site_pages/error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist or has been moved.",
    layout: "layout.ejs"
  });
});

// 500 Global Server Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).render("pages/Main_Site_pages/error", {
    title: "Internal Server Error",
    message: "An internal server error occurred. We are working to fix this as quickly as possible. Please try again shortly.",
    layout: "layout.ejs"
  });
});

app.listen(5000, () => {
  console.log("Server started at location : 5000");
});
