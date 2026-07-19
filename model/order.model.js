const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    readableOrderId: { // New field for a user-friendly order ID
        type: String,
        unique: true,
        required: true
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        title: String,
        price: Number,
        picture: String, // Storing only the first image path for simplicity
        quantity: Number
    }],
    total: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    shippingCharge: {
        type: Number,
        default: 0
    },
    deliveryMethod: {
        type: String,
        enum: ['Standard', 'Express'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['COD', 'EasyPaisa'],
        required: true
    },
    paymentScreenshot: {
        type: String,
        default: null // Will store path to the screenshot if EasyPaisa is used
    },
    shippingAddress: {
        name: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String },
        zipCode: { type: String },
        country: { type: String, default: "Pakistan" },
        phone: { type: String, required: true }
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    }
});

module.exports = mongoose.model('Order', orderSchema);
