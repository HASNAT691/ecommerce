const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  inStock: {
    type: Number,
    required: true,
    min: 0,
  },

  images: [
    {
      type: String, // Array of image URLs
    },
  ],
  isFeatured: {
    type: Boolean,
    default: false,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  subcategories: [
    {
      type: String, // Storing subcategory names directly
      trim: true,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
