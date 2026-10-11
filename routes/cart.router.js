const express = require("express");
const router = express.Router();
const Product = require("../model/products.models"); // Corrected model import name
const Order = require("../model/order.model");
const User = require("../model/user.model");
const mongoose = require('mongoose'); // Import mongoose for ObjectId
const fs = require('fs'); // For file system operations (deleting screenshots)
const path = require('path'); // For path manipulation
const rateLimit = require("express-rate-limit");
const { doubleCsrfProtection } = require("../middlewares/csrf.middleware");

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit checkout submissions to 5 per 15 minutes per IP
  message: { error: "Too many checkouts from this IP, please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const cartMutationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit cart mutations to 60 per minute per IP
  message: { error: "Too many cart actions. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload middleware for JazzCash payment screenshots
const { uploadScreenshot: upload } = require("../config/upload.config");

const isAuthenticated = require("../middlewares/auth");


// Add to cart
router.post("/add-to-cart", cartMutationLimiter, async (req, res) => {
  try {
    const { productId, size, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const parsedQuantity = Math.max(1, parseInt(quantity, 10) || 1);
    const chosenSize = size && typeof size === 'string' && size.trim() !== '' ? size.trim() : null;

    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        total: 0,
      };
    }

    const existingItem = req.session.cart.items.find(
      (item) => item.productId.toString() === productId && (item.size || null) === chosenSize
    );

    let newQuantity = parsedQuantity;
    if (existingItem) {
        newQuantity = existingItem.quantity + parsedQuantity;
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
        size: chosenSize,
      });
    }

    req.session.cart.total = req.session.cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const cartCount = req.session.cart.items.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );

    res.json({
      success: true,
      cartCount: cartCount,
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
router.post("/remove-from-cart", cartMutationLimiter, async (req, res) => {
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

    const cartCount = cart.items.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );

    res.json({
      success: true,
      cartCount: cartCount,
      cart: cart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update cart item quantity
router.post("/update-cart-quantity", cartMutationLimiter, async (req, res) => {
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
router.post("/checkout", isAuthenticated, checkoutLimiter, upload.single('screenshot'), doubleCsrfProtection, async (req, res) => {
  const cart = req.session.cart;

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty. Please add items to proceed." });
  }

  const userId = req.session.userId;

  // --- Input Validation (before touching the database) ---
  const {
    name, addressLine1, addressLine2, city, state, zipCode, country, phone,
    deliveryMethod, paymentMethod
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: "Full Name is required." });
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ error: "Phone number is required." });
  }
  if (!addressLine1 || typeof addressLine1 !== 'string' || !addressLine1.trim()) {
    return res.status(400).json({ error: "Address line 1 is required." });
  }
  if (!city || typeof city !== 'string' || !city.trim()) {
    return res.status(400).json({ error: "City is required." });
  }
  if (!deliveryMethod || !['Standard', 'Express'].includes(deliveryMethod)) {
    return res.status(400).json({ error: "Please select a valid delivery method." });
  }
  if (!paymentMethod || !['COD', 'EasyPaisa'].includes(paymentMethod)) {
    return res.status(400).json({ error: "Please select a valid payment method." });
  }
  if (paymentMethod === 'EasyPaisa' && !req.file) {
    return res.status(400).json({ error: "Payment screenshot is required for EasyPaisa." });
  }

  // --- Shipping Charge Calculation ---
  let totalItems = 0;
  cart.items.forEach(item => { totalItems += item.quantity; });
  const additionalItemFee = totalItems > 1 ? (totalItems - 1) * 50 : 0;

  let shippingCharge = 0;
  if (deliveryMethod === 'Standard') {
    shippingCharge = cart.total >= 5000 ? 0 : 190 + additionalItemFee;
  } else if (deliveryMethod === 'Express') {
    shippingCharge = 500 + additionalItemFee;
  }

  const subtotal = cart.total;
  const totalWithShipping = subtotal + shippingCharge;
  const paymentScreenshotPath = req.file ? req.file.path : null;

  // --- Collision-safe readable Order ID generator ---
  const generateReadableOrderId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  // Retry up to 5 times to avoid duplicate key collision on readableOrderId
  const getUniqueOrderId = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = generateReadableOrderId();
      const existing = await Order.findOne({ readableOrderId: id }).lean();
      if (!existing) return id;
    }
    throw new Error("Could not generate a unique order ID. Please try again.");
  };

  // --- MongoDB Transaction: atomic stock deduction + order creation ---
  const dbSession = await mongoose.startSession();
  try {
    dbSession.startTransaction();

    // Deduct stock for every cart item atomically within the transaction
    for (const cartItem of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: cartItem.productId, inStock: { $gte: cartItem.quantity } },
        { $inc: { inStock: -cartItem.quantity } },
        { new: true, session: dbSession }
      );

      if (!updatedProduct) {
        // Not enough stock — abort the whole transaction (no partial deductions committed)
        await dbSession.abortTransaction();
        dbSession.endSession();

        // Clean up uploaded file if present (local storage only)
        if (req.file && req.file.path && !req.file.path.startsWith('http')) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting uploaded file on stock failure:', err);
          });
        }

        return res.status(400).json({
          error: `Stock for "${cartItem.title}" is insufficient or unavailable.`
        });
      }
    }

    const readableOrderId = await getUniqueOrderId();

    // Create the order document inside the same transaction
    const order = new Order({
      userId: new mongoose.Types.ObjectId(userId),
      readableOrderId,
      items: cart.items.map((item) => ({
        productId: new mongoose.Types.ObjectId(item.productId),
        title: item.title,
        price: item.price,
        picture: (Array.isArray(item.picture) ? item.picture[0] : item.picture) || 'placeholder.jpg',
        quantity: item.quantity,
        size: item.size || null,
      })),
      subtotal,
      total: totalWithShipping,
      shippingCharge,
      deliveryMethod,
      paymentMethod,
      paymentScreenshot: paymentScreenshotPath,
      shippingAddress: {
        name: name.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2 ? addressLine2.trim() : '',
        city: city.trim(),
        state: state ? state.trim() : '',
        zipCode: zipCode ? zipCode.trim() : '',
        country: country ? country.trim() : 'Pakistan',
        phone: phone.trim(),
      },
      orderDate: new Date(),
      status: paymentMethod === 'COD' ? 'Pending' : 'Confirmed',
    });

    await order.save({ session: dbSession });

    // All operations succeeded — commit the transaction
    await dbSession.commitTransaction();
    dbSession.endSession();

    // Clear cart after confirmed commit
    req.session.cart = { items: [], total: 0 };

    res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId: order._id,
      readableOrderId: order.readableOrderId,
    });

  } catch (error) {
    // Transaction aborts automatically on uncaught error, but explicitly abort for safety
    try { await dbSession.abortTransaction(); } catch (_) {}
    dbSession.endSession();

    console.error("Checkout Error:", error);

    // Clean up uploaded file on error (local storage only)
    if (req.file && req.file.path && !req.file.path.startsWith('http')) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }

    res.status(500).json({ error: "An error occurred during checkout: " + error.message });
  }
});

module.exports = router;


