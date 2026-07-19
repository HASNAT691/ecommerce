const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    items: [{
        productId: String,
        title: String,
        price: Number,
        picture: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

module.exports = mongoose.model('Wishlist', wishlistSchema); 