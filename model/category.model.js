const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
    trim: true
  },
  subcategories: [
    {
      type: String,
      trim: true
    }
  ]
});

const Category = mongoose.model("Category", CategorySchema);
module.exports = Category;
