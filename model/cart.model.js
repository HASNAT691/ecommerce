const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      productId: String,
      title: String,
      price: Number,
      picture: [String],
      quantity: Number,
    },
  ],
  total: Number,
});

module.exports = mongoose.model("Cart", cartSchema);
