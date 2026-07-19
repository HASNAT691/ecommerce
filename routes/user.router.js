const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // Added bcrypt for password hashing/comparison
const rateLimit = require("express-rate-limit");
const { validateStringFields } = require("../middlewares/validation.middleware");
const User = require("../model/user.model"); // Adjust path as per your project structure
const Order = require("../model/order.model"); // Adjust path

// Limit auth requests to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 attempts
  message: "Too many login or registration attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

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

// --- User Authentication Routes ---

// Login page render
router.get("/user/login", (req, res) => {
  res.render("pages/Main_Site_pages/user-login", {
    layout: "layout", // Assuming your login page doesn't use the main layout
    error: null,
  });
});

// Login post handler
router.post("/user/login", authLimiter, validateStringFields(["email", "password"]), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render("pages/Main_Site_pages/user-login", {
        layout: false,
        error: "Invalid email or password",
      });
    }

    // Set user ID in session (replaces setting userId directly in cookie)
    req.session.userId = user._id;

    // Redirect back to the page user was trying to access or home
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo; // Clear the stored URL after use
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Login error:", error);
    res.render("pages/Main_Site_pages/user-login", {
      layout: false,
      error: "An error occurred during login",
    });
  }
});

// Registration page route
router.get("/user/register", (req, res) => {
  res.render("pages/Main_Site_pages/user-register", {
    layout: "layout", // Assuming your registration page doesn't use the main layout
    error: null,
  });
});

// Registration post handler
router.post("/user/register", authLimiter, validateStringFields(["email", "password", "name"]), async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("pages/Main_Site_pages/user-register", {
        layout: false,
        error: "Email already registered",
      });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      name,
    });

    await user.save();

    // Automatically log in the user after registration
    req.session.userId = user._id;

    // Redirect to the stored URL or home page
    const redirectUrl = req.session.returnTo || "/";
    delete req.session.returnTo; // Clear the stored URL
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Registration error:", error);
    res.render("pages/Main_Site_pages/user-register", {
      layout: false,
      error: "Error during registration. Please try again.",
    });
  }
});

// POST /logout - Log out user and destroy session (from previous Canvas)
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }
    // Clear session cookie if session store doesn't handle it automatically
    res.clearCookie("connect.sid"); // 'connect.sid' is the default name for express-session cookie
    res.status(200).json({ message: "Logged out successfully." });
  });
});

// --- User Profile & API Routes ---

// GET /profile - Renders the user profile page
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      // If session.userId exists but user not found in DB (e.g., deleted account)
      req.session.destroy(); // Clear invalid session
      return res.redirect("/user/login"); // Redirect to login
    }

    // Fetch user's orders
    // Assuming Order model has a userId field that matches User._id or a simple string ID
    const orders = await Order.find({ userId: user._id.toString() }).sort({
      orderDate: -1,
    });

    res.render("pages/Main_Site_pages/profile", {
      user: user.toObject(), // Pass user object (toObject() for plain JS object)
      orders: orders.map((order) => order.toObject()), // Pass orders as plain JS objects
      showLoginModal: false, // User is logged in, no need to show modal
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).send("Server Error");
  }
});

// API: PUT /api/profile/update - Update user's personal details
router.put("/api/profile/update", isAuthenticated, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.name = name;
    user.phone = phone;
    await user.save();

    res.status(200).json({ message: "Profile updated successfully!" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// API: POST /api/addresses/add - Add a new address
router.post("/api/addresses/add", isAuthenticated, async (req, res) => {
  try {
    const newAddress = req.body;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Handle default address logic: if new address is default, set all others to non-default
    if (newAddress.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      message: "Address added successfully!",
      address: user.addresses[user.addresses.length - 1],
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: "Failed to add address." });
  }
});

// API: PUT /api/addresses/:id - Edit an existing address
router.put("/api/addresses/:id", isAuthenticated, async (req, res) => {
  try {
    const addressId = req.params.id;
    const updatedAddressData = req.body;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ error: "Address not found." });
    }

    // Handle default address logic: if this address is set default, clear others
    if (updatedAddressData.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Update the specific address
    // Use .toObject() to ensure it's a plain JS object before spreading,
    // preserving the existing _id of the subdocument
    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex].toObject(),
      ...updatedAddressData,
    };

    await user.save();
    res.status(200).json({ message: "Address updated successfully!" });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ error: "Failed to update address." });
  }
});

// API: PUT /api/addresses/:id/set-default - Set an address as default
router.put(
  "/api/addresses/:id/set-default",
  isAuthenticated,
  async (req, res) => {
    try {
      const addressIdToSetDefault = req.params.id;
      const user = await User.findById(req.session.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      let addressFound = false;
      user.addresses.forEach((addr) => {
        if (addr._id.toString() === addressIdToSetDefault) {
          addr.isDefault = true;
          addressFound = true;
        } else {
          addr.isDefault = false; // Unset default for others
        }
      });

      if (!addressFound) {
        return res.status(404).json({ error: "Address not found." });
      }

      await user.save();
      res.status(200).json({ message: "Default address set successfully!" });
    } catch (error) {
      console.error("Error setting default address:", error);
      res.status(500).json({ error: "Failed to set default address." });
    }
  }
);

// API: DELETE /api/addresses/:id - Delete an address
router.delete("/api/addresses/:id", isAuthenticated, async (req, res) => {
  try {
    const addressId = req.params.id;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const initialLength = user.addresses.length;
    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== addressId
    );

    if (user.addresses.length === initialLength) {
      return res.status(404).json({ error: "Address not found." });
    }

    // If the deleted address was the only default, and there are other addresses,
    // set the first remaining one as default to maintain consistency.
    if (
      initialLength > user.addresses.length &&
      !user.addresses.some((addr) => addr.isDefault) &&
      user.addresses.length > 0
    ) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.status(200).json({ message: "Address deleted successfully!" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ error: "Failed to delete address." });
  }
});

// API: GET /api/orders/:id - Get single order details for modal
router.get("/api/orders/:id", isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Ensure the order belongs to the logged-in user
    // Convert to string for strict comparison with session.userId
    if (order.userId.toString() !== req.session.userId.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not own this order." });
    }

    res.status(200).json({ order: order.toObject() });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ error: "Failed to fetch order details." });
  }
});

// POST /logout - Log out user and destroy session (consolidated logout route)
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }
    // Clear session cookie, 'connect.sid' is the default name for express-session cookie
    res.clearCookie("connect.sid");
    // For successful logout, send JSON response which JS on frontend can handle to redirect
    res.status(200).json({ message: "Logged out successfully." });
  });
});

// --- Public Static Policy & About Pages ---

router.get("/about-us", (req, res) => {
  res.render("pages/Main_Site_pages/about-us", { layout: "layout.ejs" });
});

router.get("/privacy-policy", (req, res) => {
  res.render("pages/Main_Site_pages/legal", { legalType: "privacy", layout: "layout.ejs" });
});

router.get("/terms-conditions", (req, res) => {
  res.render("pages/Main_Site_pages/legal", { legalType: "terms", layout: "layout.ejs" });
});

router.get("/shipping-policy", (req, res) => {
  res.render("pages/Main_Site_pages/legal", { legalType: "shipping", layout: "layout.ejs" });
});

router.get("/return-policy", (req, res) => {
  res.render("pages/Main_Site_pages/legal", { legalType: "returns", layout: "layout.ejs" });
});

module.exports = router;
