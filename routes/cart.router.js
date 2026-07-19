const express = require("express");
const router = express.Router();
const Product = require("../model/products.models"); // Corrected model import name
const Order = require("../model/order.model");
const User = require("../model/user.model");
const mongoose = require('mongoose'); // Import mongoose for ObjectId
const fs = require('fs'); // For file system operations (deleting screenshots)
const path = require('path'); // For path manipulation
const rateLimit = require("express-rate-limit");

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit checkout submissions to 5 per 15 minutes per IP
  message: { error: "Too many checkouts from this IP, please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// For handling JazzCash screenshot uploads
const multer = require('multer');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

let storage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'screenshots',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        },
    });
} else {
    // Local fallback
    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = 'uploads/screenshots';
            // Create the directory if it doesn't exist
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        },
    });
}
const upload = multer({ storage: storage });

// --- Middleware for Authentication ---
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next(); // User is authenticated, proceed
  } else {
    // If it's an API request (XHR), send JSON error
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(401).json({ error: 'Unauthorized: Please log in.' });
    }
    // For page requests, store the intended URL and redirect to login
    req.session.returnTo = req.originalUrl; // Store the URL the user was trying to access
    res.redirect('/user/login'); // Redirect to your login page
  }
};
// --- End Middleware ---


// Add to cart
router.post("/add-to-cart", async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        total: 0,
      };
    }

    const existingItem = req.session.cart.items.find(
      (item) => item.productId.toString() === productId
    );

    let newQuantity = 1;
    if (existingItem) {
        newQuantity = existingItem.quantity + 1;
    }

    // --- Stock Check ---
    if (product.inStock < newQuantity) {
        return res.status(400).json({ error: `Not enough stock for "${product.title}". Available: ${product.inStock}` });
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      req.session.cart.items.push({
        productId: product._id.toString(),
        title: product.title,
        price: product.price,
        picture: product.images, // Store the FULL array of images
        quantity: newQuantity,
      });
    }

    req.session.cart.total = req.session.cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      cartCount: req.session.cart.items.length,
      cart: req.session.cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: error.message });
  }
});

// View cart (protected by isAuthenticated middleware)
router.get("/cart", isAuthenticated, async (req, res) => {
  const cart = req.session.cart || { items: [], total: 0 };
  let user = null;
  let defaultAddress = null;

  if (req.session.userId) {
    user = await User.findById(req.session.userId);
    if (user && user.addresses && user.addresses.length > 0) {
      defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
    }
  }

  res.render("pages/Main_Site_pages/cart", {
    cart: cart,
    user: user ? user.toObject() : null,
    defaultAddress: defaultAddress, // Pass default address for pre-filling
    layout: "layout.ejs",
  });
});

// API: Check authentication status (used by frontend before opening checkout modal)
router.get('/api/check-auth-status', (req, res) => {
    if (req.session.userId) {
        res.json({ isAuthenticated: true });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Remove from cart
router.post("/remove-from-cart", async (req, res) => {
  try {
    const { productId } = req.body;
    const cart = req.session.cart;

    if (!cart) {
        return res.status(400).json({ error: "Cart is empty." });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.productId !== productId);

    if (cart.items.length === initialLength) {
        return res.status(404).json({ error: "Product not found in cart." });
    }

    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      cartCount: cart.items.length,
      cart: cart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update cart item quantity
router.post("/update-cart-quantity", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const cart = req.session.cart;

    if (!cart) {
        return res.status(400).json({ error: "Cart is empty." });
    }

    const item = cart.items.find((item) => item.productId === productId);
    if (!item) {
      return res.status(404).json({ error: "Product not found in cart." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Original product not found for stock check." });
    }

    if (quantity > product.inStock) {
        return res.status(400).json({ error: `Cannot add more than available stock for "${product.title}". Max: ${product.inStock}` });
    }
    if (quantity < 1) {
        return res.status(400).json({ error: "Quantity cannot be less than 1." });
    }

    item.quantity = parseInt(quantity);

    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    res.json({
      success: true,
      cart: cart,
    });
  } catch (error) {
    console.error("Update cart quantity error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /checkout - Renders the checkout page (protected)
router.get("/checkout", isAuthenticated, async (req, res) => {
  try {
    const cart = req.session.cart || { items: [], total: 0 };

    if (cart.items.length === 0) {
      return res.redirect('/cart'); // Redirect to cart if it's empty
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
        req.session.destroy();
        return res.redirect('/user/login');
    }

    let defaultAddress = null;
    if (user.addresses && user.addresses.length > 0) {
        defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
    }

    res.render("pages/Main_Site_pages/checkout", {
      cart: cart,
      user: user.toObject(),
      defaultAddress: defaultAddress,
      layout: "layout.ejs", // Assuming your main layout
    });

  } catch (error) {
    console.error("Error loading checkout page:", error);
    res.status(500).send("Error loading checkout page. Please try again.");
  }
});

// POST /checkout - Processes the order
// Use upload.single('screenshot') for the file upload if EasyPaisa is selected
router.post("/checkout", isAuthenticated, checkoutLimiter, upload.single('screenshot'), async (req, res) => {
  try {
    const cart = req.session.cart;

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty. Please add items to proceed." });
    }

    const userId = req.session.userId;

    // Optional: Re-verify stock for all items right before final checkout
    for (const cartItem of cart.items) {
        const product = await Product.findById(cartItem.productId);
        if (!product || product.inStock < cartItem.quantity) {
            return res.status(400).json({ error: `Stock for "${cartItem.title}" is insufficient. Available: ${product ? product.inStock : 0}` });
        }
    }

    // Extract data from request body and uploaded file
    const {
      name, addressLine1, addressLine2, city, state, zipCode, country, phone,
      deliveryMethod, paymentMethod
    } = req.body;

    // Determine shipping charge
    let shippingCharge = 0;
    if (deliveryMethod === 'Standard') {
      shippingCharge = 200;
    } else if (deliveryMethod === 'Express') {
      shippingCharge = 500;
    }

    const subtotal = cart.total;
    const totalWithShipping = subtotal + shippingCharge;
    let paymentScreenshotPath = null;

    if (paymentMethod === 'EasyPaisa') {
        if (!req.file) {
            // This should ideally be caught by frontend validation, but good to have a backend fallback
            return res.status(400).json({ error: "Payment screenshot is required for EasyPaisa." });
        }
        paymentScreenshotPath = req.file.path; // Store path from multer
    }

    // Generate a readable Order ID
    // Simple random alphanumeric string for demonstration.
    // For production, consider collision avoidance (e.g., check if ID exists, or use a sequence).
    const generateReadableOrderId = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const length = 10; // e.g., 'ABC123DEF4'
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    const readableOrderId = generateReadableOrderId();


    // Create order
    const order = new Order({
      userId: new mongoose.Types.ObjectId(userId),
      readableOrderId: readableOrderId, // Save the generated readable ID
      items: cart.items.map((item) => ({
        productId: new mongoose.Types.ObjectId(item.productId),
        title: item.title,
        price: item.price,
        // When saving to Order model, if you only want the *first* image for the order history
        // then store item.picture[0]. If you want the full array for some reason (less common for order history), store item.picture
        picture: item.picture[0] || 'placeholder.jpg', // Store only the first image for the order item record
        quantity: item.quantity,
      })),
      subtotal: subtotal,
      total: totalWithShipping,
      shippingCharge: shippingCharge,
      deliveryMethod: deliveryMethod,
      paymentMethod: paymentMethod,
      paymentScreenshot: paymentScreenshotPath,
      shippingAddress: {
        name: name,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        city: city,
        state: state,
        zipCode: zipCode,
        country: country,
        phone: phone,
      },
      orderDate: new Date(),
      status: (paymentMethod === 'COD') ? 'Pending' : 'Confirmed',
    });

    await order.save();

    // Update product stock in DB
    for (const cartItem of cart.items) {
        await Product.findByIdAndUpdate(
            cartItem.productId,
            { $inc: { inStock: -cartItem.quantity } } // Decrement stock
        );
    }

    // Clear cart after successful order
    req.session.cart = {
      items: [],
      total: 0,
    };

    // Send success JSON response, including the readableOrderId
    res.status(200).json({ success: true, message: "Order placed successfully!", orderId: order._id, readableOrderId: order.readableOrderId });

  } catch (error) {
    console.error("Checkout Error:", error);
    // If an error occurs after file upload, delete the uploaded file (local only)
    if (req.file && req.file.path && !req.file.path.startsWith('http')) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });
    }
    res.status(500).json({ error: "An error occurred during checkout: " + error.message });
  }
});

module.exports = router;
