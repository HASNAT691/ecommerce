const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype.toLowerCase());
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only image files (jpg, jpeg, png, webp) are allowed!"), false);
};

// Storage for payment screenshots
let screenshotStorage;
if (isCloudinaryConfigured) {
  screenshotStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "screenshots",
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
    },
  });
} else {
  screenshotStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "..", "uploads", "screenshots");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}

const uploadScreenshot = multer({
  storage: screenshotStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Storage for product images
let productsStorage;
if (isCloudinaryConfigured) {
  productsStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "products",
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
    },
  });
} else {
  productsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}

const uploadProducts = multer({
  storage: productsStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 }, // 10 MB per image, max 20 files
});

module.exports = {
  uploadScreenshot,
  uploadProducts,
  imageFileFilter,
  isCloudinaryConfigured,
};