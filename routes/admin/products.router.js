const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { validateStringFields } = require("../../middlewares/validation.middleware");
const fs = require('fs'); // For file system operations (deleting images)
const path = require('path'); // For path manipulation

const Admin = require("../../model/login.model");
const Product = require("../../model/products.models"); // Assuming your model file is products.model.js
const Category = require("../../model/category.model");
const Order = require("../../model/order.model"); // Ensure Order model is imported
const User = require("../../model/user.model"); // Ensure User model is imported

// Middleware for Admin Authentication
const isAdminAuthenticated = (req, res, next) => {
    if (req.session && req.session.isAdmin) { // Ensure you set req.session.isAdmin = true upon successful admin login
        next();
    } else {
        // Redirect to admin login if not authenticated
        res.redirect('/admin/login');
    }
};

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

let storageProducts;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  storageProducts = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "products",
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
    },
  });
} else {
  // Local fallback
  storageProducts = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = "./uploads"; // Products are uploaded to the base 'uploads' folder
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  });
}
const uploadProducts = multer({ storage: storageProducts });

/* Multer configuration for dynamic file replacement on product edit */
function multerAnyReplace(req, res, next) {
  const flds = [{ name: "files", maxCount: 20 }]; // For new files being added
  // Dynamically add replace_0 ... replace_19 to accept single files for replacement
  for (let i = 0; i < 20; i++) {
    flds.push({ name: `replace_${i}`, maxCount: 1 });
  }
  // Use the defined 'storageProducts' for handling file uploads
  uploadProducts.fields(flds)(req, res, next); // Correctly call multer with fields and storage
}

// --- ADMIN ROUTES ---

// Dashboard
router.get("/admin/dashboard", isAdminAuthenticated, async (req, res) => {
  try {
    const products = await Product.find(); // Fetching all products for dashboard overview

    // Pagination parameters for recent orders on dashboard
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // Items per page
    const skip = (page - 1) * limit;

    // Fetch complete order data
    const orders = await Order.find()
      .sort({ orderDate: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .lean(); // .lean() for plain JS objects, faster if not modifying Mongoose docs

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    // Enhanced order sanitization for dashboard display
    const sanitizedOrders = orders.map((order) => {
      return {
        _id: order._id,
        readableOrderId: order.readableOrderId,
        total: order.total || 0, // Use stored total from Order model
        subtotal: order.subtotal || 0, // Use stored subtotal from Order model
        shippingCharge: order.shippingCharge || 0, // Use stored shippingCharge
        orderDate: order.orderDate || new Date(),
        status: order.status, // Use stored status
        shippingAddress: {
          name: order.shippingAddress?.name || "Customer",
          addressLine1: order.shippingAddress?.addressLine1 || "N/A", // Added for consistency
          city: order.shippingAddress?.city || "N/A",
          phone: order.shippingAddress?.phone || "N/A",
        },
        paymentMethod: order.paymentMethod,
        paymentScreenshot: order.paymentScreenshot,
        deliveryMethod: order.deliveryMethod,
        items: (order.items || []).map((item) => ({
          productId: item.productId || "",
          title: item.title || "Product",
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
        })),
      };
    });

    const totalRevenue = orders.reduce( // Calculate total revenue from fetched orders
      (sum, order) => sum + (order.total || 0),
      0
    );

    const completedOrdersCount = await Order.countDocuments({ status: "Delivered" }); // Use "Delivered" as final state
    const completedPercentage =
      totalOrders > 0 ? Math.round((completedOrdersCount / totalOrders) * 100) : 0;

    res.render("pages/Admin_Pages/dashboard", {
      layout: "admin-layout.ejs",
      products, // Pass products for product count or other stats if needed
      orders: sanitizedOrders,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats: {
        totalRevenue,
        totalOrders,
        completedPercentage,
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).send("Error loading dashboard");
  }
});

// Analytics page render
router.get("/admin/analytics", isAdminAuthenticated, (req, res) => {
  res.render("pages/Admin_Pages/analytics", { layout: "admin-layout.ejs" });
});

// Analytics API for dynamic Chart.js stats
router.get("/admin/api/analytics", isAdminAuthenticated, async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 1. Sales Performance (Last 6 months)
    const salesData = await Order.aggregate([
      { $match: { orderDate: { $gte: sixMonthsAgo }, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: { year: { $year: '$orderDate' }, month: { $month: '$orderDate' } },
          revenue: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 2. User Growth (Last 6 months)
    const userData = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 3. Product Categories Performance
    const categoryData = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: '$categoryDetails' },
      {
        $group: {
          _id: '$categoryDetails.categoryName',
          productCount: { $addToSet: '$items.productId' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          quantitySold: { $sum: '$items.quantity' }
        }
      }
    ]);

    // 4. Sales Data List (recent items sold)
    const recentSales = await Order.find({ status: { $ne: 'Cancelled' } })
      .sort({ orderDate: -1 })
      .limit(10)
      .lean();

    const salesList = [];
    recentSales.forEach(order => {
      order.items.forEach(item => {
        salesList.push({
          title: item.title,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          region: order.shippingAddress.city || "Pakistan"
        });
      });
    });

    // 5. Build dynamic monthly labels and sync records
    const labels = [];
    const salesValues = [];
    const userValues = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('en-US', { month: 'short' });
      labels.push(label);

      const matchYear = d.getFullYear();
      const matchMonth = d.getMonth() + 1;

      const saleMatch = salesData.find(s => s._id.year === matchYear && s._id.month === matchMonth);
      salesValues.push(saleMatch ? saleMatch.revenue : 0);

      const userMatch = userData.find(u => u._id.year === matchYear && u._id.month === matchMonth);
      userValues.push(userMatch ? userMatch.count : 0);
    }

    // 6. Format Category List
    const allCategories = await Category.find().lean();
    const categoriesList = allCategories.map(cat => {
      const match = categoryData.find(c => c._id === cat.categoryName);
      return {
        name: cat.categoryName,
        productCount: match ? match.productCount.length : 0,
        revenue: match ? match.revenue : 0
      };
    });

    res.json({
      success: true,
      labels,
      salesValues,
      userValues,
      categoriesList,
      salesList
    });

  } catch (error) {
    console.error("API Analytics Error:", error);
    res.status(500).json({ error: "Failed to gather analytics data" });
  }
});

// --- ADMIN PRODUCTS MANAGEMENT ---

/* GET all products with sort / filter / search */
router.get("/admin/products", isAdminAuthenticated, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = 10;
  const skip = (page - 1) * limit;

  const sortDir = req.query.sort === "desc" ? -1 : 1;
  const categoryId = req.query.category;
  const searchStr = req.query.search;

  let q = {}; // Build query object
  if (categoryId) q.category = categoryId;
  if (searchStr) {
    const rx = new RegExp(searchStr, "i");
    q.$or = [
      { title: rx },
      { description: rx },
      { subcategories: rx },
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(q)
      .populate("category")
      .sort({ price: sortDir }) // Sorting by price as per your original code
      .skip(skip)
      .limit(limit),
    Product.countDocuments(q),
  ]);

  const categories = await Category.find();
  const totalPages = Math.ceil(total / limit);

  // To keep filters while paging
  const urlParams = new URLSearchParams(req.query);
  urlParams.delete("page");
  const queryString = urlParams.toString();

  res.render("pages/Admin_Pages/products", {
    layout: "admin-layout.ejs",
    products,
    categories,
    page,
    totalPages,
    queryString,
    currentCategory: categoryId,
    currentSort: req.query.sort,
    search: searchStr,
  });
});

/* GET create product form */
router.get("/admin/products/create", isAdminAuthenticated, async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("pages/Admin_Pages/create", { // Assuming the EJS file is create-product.ejs
      layout: "admin-layout.ejs",
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading create product form");
  }
});

/* POST create product action */
router.post(
  "/admin/products/create",
  isAdminAuthenticated,
  uploadProducts.array("files", 20), // Use uploadProducts here
  async (req, res) => {
    try {
      const { title, description, price, inStock, category, isFeatured, subcategories } = req.body;

      const product = new Product({
        title,
        description,
        price: Number(price),
        inStock: parseInt(inStock, 10),
        category,
        isFeatured: !!isFeatured, // Convert to boolean
        subcategories: Array.isArray(subcategories)
          ? subcategories
          : subcategories
          ? subcategories.split(',').map(s => s.trim()) // Handle comma-separated string
          : [],
        images: req.files ? req.files.map((f) => (f.path && f.path.startsWith("http")) ? f.path : f.filename) : [],
      });

      await product.save();
      res.redirect("/admin/products");
    } catch (err) {
      console.error("Error creating product:", err);
      res.status(500).send("Error creating product: " + err.message);
    }
  }
);

/* GET edit product form */
router.get("/admin/products/edit/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const pid = req.params.id;
    let product = mongoose.Types.ObjectId.isValid(pid)
      ? await Product.findById(pid).populate("category")
      : await Product.findOne({ title: pid }).populate("category"); // Allows editing by ID or title

    if (!product) return res.status(404).send("Product not found");

    const categories = await Category.find();
    res.render("pages/Admin_Pages/editform", { // Assuming the EJS file is edit-product.ejs
      layout: "admin-layout.ejs",
      product,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading product edit form");
  }
});

/* POST edit product action */
router.post("/admin/products/edit/:id", isAdminAuthenticated, multerAnyReplace, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");

    /* Update basic fields */
    product.title = req.body.title;
    product.description = req.body.description;
    product.price = Number(req.body.price);
    product.inStock = parseInt(req.body.inStock, 10);
    product.category = req.body.category;
    product.isFeatured = !!req.body.isFeatured; // Convert to boolean

    let currentImages = [...product.images]; // Get existing images

    /* Handle REMOVE check-boxes: filter out images whose filenames are in req.body.removeImages */
    if (req.body.removeImages) {
      const removedImageFilenames = Array.isArray(req.body.removeImages)
        ? req.body.removeImages
        : [req.body.removeImages]; // Ensure it's an array

      currentImages = currentImages.filter(img => {
          const shouldRemove = removedImageFilenames.includes(img);
          if (shouldRemove) {
              if (img && !img.startsWith("http")) {
                  // Delete file from disk
                  const imagePath = path.join(__dirname, "..", "uploads", img);
                  if (fs.existsSync(imagePath)) {
                      fs.unlinkSync(imagePath);
                      console.log(`Deleted old image: ${imagePath}`);
                  }
              }
          }
          return !shouldRemove;
      });
    }

    /* Handle per-slot REPLACE: update image at specific index */
    Object.keys(req.files || {}).forEach((fld) => {
      if (fld.startsWith("replace_")) {
        const idx = Number(fld.split("_")[1]); // Extract index (e.g., replace_0 => 0)
        const newFile = req.files[fld][0]; // Get the new uploaded file

        if (product.images[idx]) { // If there was an old image at this slot
          if (product.images[idx] && !product.images[idx].startsWith("http")) {
            // Delete old image file from disk
            const oldImagePath = path.join(__dirname, "..", "uploads", product.images[idx]);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
                console.log(`Replaced and deleted old image: ${oldImagePath}`);
            }
          }
        }
        currentImages[idx] = (newFile.path && newFile.path.startsWith("http")) ? newFile.path : newFile.filename; // Update with new URL or filename
      }
    });

    /* Handle NEW files (field = files[]) */
    if (req.files && req.files["files"]) {
      currentImages.push(...req.files["files"].map((f) => (f.path && f.path.startsWith("http")) ? f.path : f.filename));
    }
    
    // Ensure the product.images array is updated with the modified list
    product.images = currentImages.filter(img => img); // Filter out any null/undefined entries if any slot was emptied but not replaced

    /* Handle subcategories */
    if (req.body.subcategories) {
      product.subcategories = Array.isArray(req.body.subcategories)
        ? req.body.subcategories
        : [req.body.subcategories]; // Convert single string to array
    } else {
        product.subcategories = []; // Clear if no subcategories provided
    }

    // Save new subcats into category doc (if applicable, your original logic for this)
    if (req.body.newSubcategories) {
      const cat = await Category.findById(product.category);
      if (cat) {
        const extra = Array.isArray(req.body.newSubcategories)
          ? req.body.newSubcategories
          : [req.body.newSubcategories];
        cat.subcategories.push(...extra.filter(sub => !cat.subcategories.includes(sub))); // Add only unique new ones
        await cat.save();
      }
    }

    await product.save();
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).send("Error updating product: " + err.message);
  }
});

/* DELETE product */
router.get("/admin/products/delete/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const pid = req.params.id;
    const product = mongoose.Types.ObjectId.isValid(pid)
      ? await Product.findByIdAndDelete(pid)
      : await Product.findOneAndDelete({ title: pid }); // Allows deleting by ID or title

    if (!product) return res.status(404).send("Product not found");

    // Delete associated image files from disk
    if (product.images && product.images.length > 0) {
      product.images.forEach(image => {
        if (image && !image.startsWith("http")) {
          const imagePath = path.join(__dirname, "..", "uploads", image);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Deleted product image: ${imagePath}`);
          }
        }
      });
    }
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).send("Error deleting product: " + err.message);
  }
});

// --- ADMIN CATEGORIES MANAGEMENT ---

router.get("/admin/categories", isAdminAuthenticated, async (req, res) => {
  try {
    let categories = await Category.find();
    res.render("pages/Admin_Pages/category", { // Assuming your EJS file is category.ejs
      layout: "admin-layout.ejs",
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Error loading categories page.");
  }
});

router.get("/admin/categories/create", isAdminAuthenticated, (req, res) => {
  res.render("pages/Admin_Pages/createCategory", { // Assuming your EJS file is create-category.ejs
    layout: "admin-layout.ejs",
  });
});

router.post("/admin/categories/create", isAdminAuthenticated, async (req, res) => {
  try {
    let category = new Category(req.body); // Expects req.body to have 'name' and 'subcategories'
    await category.save();
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).send("Error creating category: " + error.message);
  }
});

router.get("/admin/categories/delete/:id", isAdminAuthenticated, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    return res.redirect("/admin/categories");
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).send("Error deleting category: " + error.message);
  }
});

router.get("/admin/categories/edit/:id", isAdminAuthenticated, async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).send("Category not found");
    }
    res.render("pages/Admin_Pages/edit-category", { // Assuming your EJS file is edit-category.ejs
      layout: "admin-layout.ejs",
      category,
    });
  } catch (error) {
    console.error("Edit Category Error:", error);
    res.status(500).send("Error loading category: " + error.message);
  }
});

router.post("/admin/categories/edit/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).send("Category not found");
    }

    category.categoryName = req.body.categoryName; // Assuming field is categoryName

    // Ensure subcategories is an array and filter out empty strings
    if (Array.isArray(req.body.subcategories)) {
      category.subcategories = req.body.subcategories.filter(
        (sub) => sub.trim() !== ""
      );
    } else if (typeof req.body.subcategories === "string" && req.body.subcategories.trim() !== "") {
      // Handle comma-separated string input for subcategories
      category.subcategories = req.body.subcategories.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      category.subcategories = [];
    }

    await category.save();
    return res.redirect("/admin/categories");
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).send("Error updating category: " + error.message);
  }
});

// --- ADMIN AUTHENTICATION (Login/Register) ---

router.get("/admin/login", (req, res) => {
  res.render("pages/Admin_Pages/admin-login", { layout: false });
});

// Rate limiting for admin authentication
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit admin attempts to 10 per 15 minutes
  message: "Too many admin login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/admin/login", adminAuthLimiter, validateStringFields(["username", "password"]), async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).send("Invalid username or password!");
    }
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).send("Invalid username or password!");
    }
    req.session.isAdmin = true; // Set session variable for admin
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).send("Error logging in admin!");
  }
});

router.get("/admin/register", (req, res) => {
  const { secret } = req.query;
  if (!process.env.ADMIN_REGISTRATION_SECRET || secret !== process.env.ADMIN_REGISTRATION_SECRET) {
    return res.status(403).send("Admin registration is disabled or secret is incorrect!");
  }
  res.render("pages/Admin_Pages/admin-register", { layout: false, secret });
});

router.post("/admin/register", adminAuthLimiter, validateStringFields(["username", "password", "secret"]), async (req, res) => {
  const { username, password, secret } = req.body;
  try {
    if (!process.env.ADMIN_REGISTRATION_SECRET || secret !== process.env.ADMIN_REGISTRATION_SECRET) {
      return res.status(403).send("Admin registration is disabled or secret is incorrect!");
    }
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).send("Admin already exists!");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ username, password: hashedPassword });
    await newAdmin.save();
    res.redirect("/admin/login");
  } catch (error) {
    console.error("Admin Registration Error:", error);
    res.status(500).send("Error registering admin!");
  }
});


// --- NEW ADMIN ORDER MANAGEMENT ROUTES ---

// GET all orders for admin view
router.get("/admin/orders", isAdminAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of orders per page
        const skip = (page - 1) * limit;

        const [orders, totalOrders] = await Promise.all([
            Order.find()
                .sort({ orderDate: -1 }) // Sort by newest first
                .skip(skip)
                .limit(limit)
                .lean(), // Use .lean() for faster fetching if not modifying docs
            Order.countDocuments()
        ]);

        const totalPages = Math.ceil(totalOrders / limit);

        // Sanitize data and ensure necessary fields are present for EJS
        const sanitizedOrders = orders.map(order => ({
            _id: order._id.toString(), // Convert ObjectId to string for EJS
            readableOrderId: order.readableOrderId,
            total: order.total || 0,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentScreenshot: order.paymentScreenshot, // Full path stored by Multer
            deliveryMethod: order.deliveryMethod,
            orderDate: order.orderDate,
            shippingAddress: {
                name: order.shippingAddress?.name || 'N/A',
                // Add other address fields if needed in admin view, e.g., addressLine1
            }
        }));

        res.render("pages/Admin_Pages/admin-orders", {
            layout: "admin-layout.ejs",
            orders: sanitizedOrders,
            pagination: {
                page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages
            }
        });

    } catch (error) {
        console.error("Error fetching admin orders:", error);
        res.status(500).send("Error loading admin orders page.");
    }
});

// POST to update order status
router.post("/admin/orders/:id/update-status", isAdminAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: "Order not found." });
        }

        // Validation for EasyPaisa and screenshot
        if ((status === 'Confirmed' || status === 'Delivered') && order.paymentMethod === 'EasyPaisa' && !order.paymentScreenshot) {
            return res.status(400).json({ error: "Cannot confirm or deliver EasyPaisa order without a payment screenshot." });
        }

        order.status = status;
        await order.save();

        res.status(200).json({ success: true, message: "Order status updated.", newStatus: status });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ error: "Failed to update order status." });
    }
});

// --- NEW ADMIN CUSTOMER MANAGEMENT ROUTES ---

// GET all customers for admin view
router.get("/admin/customers", isAdminAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Customers per page
        const skip = (page - 1) * limit;

        // Fetch users and their order counts
        const [customers, totalCustomers] = await Promise.all([
            User.aggregate([
                {
                    $lookup: {
                        from: 'orders', // The collection name for Order model (usually pluralized lowercase)
                        localField: '_id',
                        foreignField: 'userId',
                        as: 'orders'
                    }
                },
                {
                    $addFields: {
                        orderCount: { $size: '$orders' } // Count orders for each user
                    }
                },
                {
                    $project: {
                        password: 0, // Exclude sensitive info
                        orders: 0 // Exclude the orders array itself to keep response lighter
                    }
                }
            ])
            .sort({ createdAt: -1 }) // Sort by newest registered
            .skip(skip)
            .limit(limit),
            User.countDocuments()
        ]);

        const totalPages = Math.ceil(totalCustomers / limit);

        res.render("pages/Admin_Pages/admin-customer", {
            layout: "admin-layout.ejs",
            customers: customers,
            pagination: {
                page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages
            }
        });

    } catch (error) {
        console.error("Error fetching admin customers:", error);
        res.status(500).send("Error loading admin customers page.");
    }
});

// GET specific customer's order history
router.get("/admin/customers/:id/orders", isAdminAuthenticated, async (req, res) => {
    try {
        const customerId = req.params.id;

        const customer = await User.findById(customerId).lean();
        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        const orders = await Order.find({ userId: customerId })
            .sort({ orderDate: -1 })
            .lean();

        res.render("pages/Admin_Pages/admin-customer-orders", {
            layout: "admin-layout.ejs",
            customer: customer,
            orders: orders
        });

    } catch (error) {
        console.error("Error fetching customer orders history:", error);
        res.status(500).send("Error loading customer order history.");
    }
});

// --- NEW PUBLIC TRACK ORDER ROUTES ---

// GET track order page
router.get("/track-order", (req, res) => {
    res.render("pages/Main_Site_pages/track-order", { layout: "layout.ejs" });
});

// API to track order by readable ID
router.post("/api/track-order", async (req, res) => {
    try {
        const { readableOrderId } = req.body;

        if (!readableOrderId) {
            return res.status(400).json({ error: "Order ID is required." });
        }

        const order = await Order.findOne({ readableOrderId: readableOrderId }).lean();

        if (!order) {
            return res.status(404).json({ error: "No order found with that ID." });
        }

        // Mask sensitive customer information for public tracking
        const maskedOrder = {
            ...order,
            shippingAddress: {
                name: order.shippingAddress.name ? order.shippingAddress.name.replace(/^(.)(.*)(.)$/, (m, a, b, c) => a + "*".repeat(b.length) + c) : "N/A",
                addressLine1: "Masked for Privacy",
                addressLine2: order.shippingAddress.addressLine2 ? "Masked" : "",
                city: order.shippingAddress.city || "",
                state: order.shippingAddress.state || "",
                zipCode: "****",
                country: order.shippingAddress.country || "Pakistan",
                phone: order.shippingAddress.phone ? order.shippingAddress.phone.replace(/.(?=.{4})/g, "*") : "N/A"
            }
        };

        res.status(200).json({ success: true, order: maskedOrder });

    } catch (error) {
        console.error("Error tracking order:", error);
        res.status(500).json({ error: "An error occurred while tracking your order." });
    }
});

// --- EXISTING PUBLIC PRODUCT LISTING ROUTES ---

// GET secondpage (main product listing for users)
router.get("/secondpage", async (req, res) => {
  try {
    const { category, subcategory, sort } = req.query;

    let query = {};

    let categoryId = null;
    if (category && category !== "") {
      const foundCategory = await Category.findOne({
        categoryName: { $regex: new RegExp(`^${category}$`, "i") },
      });

      if (foundCategory) {
        categoryId = foundCategory._id;
        query.category = categoryId;
      } else {
        query.category = null; // No matching category, effectively returns no products
      }
    }

    if (subcategory && subcategory !== "") {
      query.subcategories = { $regex: new RegExp(subcategory, "i") };
    }

    let sortObj = {};
    switch (sort) {
      case "price_asc":
        sortObj = { price: 1 };
        break;
      case "price_desc":
        sortObj = { price: -1 };
        break;
      case "newest":
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    const products = await Product.find(query).sort(sortObj);

    res.render("pages/Main_Site_pages/secondpage", {
      products,
      category: category || "",
      subcategory: subcategory || "",
      sort: sort || "newest",
    });
  } catch (error) {
    console.error("Error fetching products for secondpage:", error);
    res.status(500).send("Error loading products. Please try again later.");
  }
});

// API to fetch products (e.g., for client-side filtering)
router.get("/api/products", async (req, res) => {
  try {
    const { category, subcategory, sort } = req.query;
    let query = {};

    if (category) {
      const categoryDoc = await Category.findOne({
        categoryName: { $regex: new RegExp(category, "i") },
      });

      if (categoryDoc) {
        query.category = categoryDoc._id;
      } else {
        return res.json({ products: [] }); // No category found, return empty
      }
    }

    if (subcategory) {
      query.subcategories = { $regex: new RegExp(subcategory, "i") };
    }

    let sortObj = {};
    switch (sort) {
      case "price_asc":
        sortObj = { price: 1 };
        break;
      case "price_desc":
        sortObj = { price: -1 };
        break;
      case "newest":
      default:
        sortObj = { createdAt: -1 };
        break;
    }

    const products = await Product.find(query)
      .populate("category")
      .sort(sortObj)
      .lean(); // Use .lean() for API responses

    res.json({ products });
  } catch (error) {
    console.error("Error fetching products API:", error);
    res.status(500).json({ error: "Error fetching products." });
  }
});

// --- NEW ROUTE: PRODUCT DETAIL PAGE ---
router.get("/product/:id", async (req, res) => {
    try {
        const productId = req.params.id;

        // Fetch the main product
        const product = await Product.findById(productId).lean();

        if (!product) {
            return res.status(404).send("Product not found.");
        }

        // Fetch similar products (e.g., from the same category, excluding the current product)
        const similarProducts = await Product.find({
            category: product.category, // Same category
            _id: { $ne: productId } // Not the current product itself
        })
        .limit(4) // Limit to a few similar products
        .lean();

        res.render("pages/Main_Site_pages/product-detail", {
            layout: "layout.ejs",
            product: product,
            similarProducts: similarProducts
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).send("Error loading product details. Please try again.");
    }
});

module.exports = router;
