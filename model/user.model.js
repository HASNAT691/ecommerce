const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Home", "Office"
  addressLine1: { type: String, required: true },
  addressLine2: { type: String }, // Optional, like apartment, suite, etc.
  city: { type: String, required: true },
  state: { type: String }, // For countries with states/provinces, e.g., Punjab
  zipCode: { type: String }, // Postal code
  country: { type: String, default: "Pakistan" },
  phone: { type: String, required: true },
  isDefault: { type: Boolean, default: false }, // Mark one address as default
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    trim: true,
    default: "New User", // Default name if not provided
  },
  phone: {
    // Added phone number
    type: String,
    trim: true,
    sparse: true, // Allows nulls, helpful if not all users provide phone
  },
  addresses: [addressSchema], // Array of embedded address documents
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // You might also add roles, lastLogin, etc., as needed for a more complex app
});

module.exports = mongoose.model("User", userSchema);
