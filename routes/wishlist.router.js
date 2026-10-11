const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Wishlist = require('../model/wishlist.model');
const User = require('../model/user.model');
const Product = require('../model/products.models');
const isAuthenticated = require('../middlewares/auth');

const wishlistLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit wishlist actions to 60 per minute per IP
    message: { success: false, message: 'Too many wishlist requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// View wishlist - protected route with email verification
router.get('/wishlist', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const wishlist = await Wishlist.findOne({ userId });
        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/user/login");
        }

        res.render('pages/Main_Site_pages/wishlist', { 
            wishlist: wishlist || { items: [] },
            layout: false,
            user: user.toObject(),
            userEmail: user.email // Pass email to view
        });
    } catch (error) {
        console.error('View wishlist error:', error);
        res.status(500).send('Error loading wishlist');
    }
});

// Add to wishlist - protected route
router.post('/add-to-wishlist', isAuthenticated, wishlistLimiter, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Valid Product ID is required' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const userId = req.session.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userEmail = user.email;

        // Find existing wishlist or create new one
        let wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                userEmail,
                items: []
            });
        }

        // Check if item already exists
        const existingItem = wishlist.items.find(item => item.productId.toString() === productId.toString());
        if (!existingItem) {
            const itemPic = (product.images && product.images.length > 0) ? product.images[0] : (req.body.picture || '');
            wishlist.items.push({
                productId: product._id,
                title: product.title,
                price: Number(product.price),
                picture: itemPic
            });
            
            try {
                await wishlist.save();
                res.json({
                    success: true,
                    message: 'Item added to wishlist successfully'
                });
            } catch (saveError) {
                console.error('Wishlist save error:', saveError);
                res.status(500).json({
                    success: false,
                    message: 'Error saving to wishlist'
                });
            }
        } else {
            res.json({
                success: false,
                message: 'Item is already in your wishlist'
            });
        }
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding item to wishlist'
        });
    }
});

// Remove from wishlist handler - supports both DELETE and POST
const handleRemoveFromWishlist = async (req, res) => {
    try {
        const userId = req.session.userId;
        const productId = req.params.productId || (req.body && req.body.productId) || req.query.productId;

        if (!productId || typeof productId !== 'string' || !productId.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Valid Product ID is required'
            });
        }

        const trimmedProductId = productId.trim();
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
        const productObjectId = mongoose.Types.ObjectId.isValid(trimmedProductId) ? new mongoose.Types.ObjectId(trimmedProductId) : null;

        const userQuery = {
            $or: [
                { userId: userId },
                ...(userObjectId ? [{ userId: userObjectId }] : [])
            ]
        };

        const pullFilter = {
            $or: [
                { productId: trimmedProductId },
                { _id: trimmedProductId },
                ...(productObjectId ? [{ productId: productObjectId }, { _id: productObjectId }] : [])
            ]
        };

        // 1. Atomic $pull update across matching wishlist documents
        await Wishlist.updateMany(userQuery, {
            $pull: { items: pullFilter }
        });

        // 2. Also ensure any in-memory/loaded document is cleanly synchronized
        const wishlist = await Wishlist.findOne(userQuery);
        if (wishlist) {
            const initialCount = wishlist.items.length;
            wishlist.items = wishlist.items.filter(item => {
                if (!item) return false;
                const pId = item.productId ? item.productId.toString() : '';
                const sId = item._id ? item._id.toString() : '';
                return pId !== trimmedProductId && sId !== trimmedProductId;
            });
            if (wishlist.items.length < initialCount) {
                wishlist.markModified('items');
                await wishlist.save();
            }
        }

        res.json({
            success: true,
            message: 'Item removed successfully'
        });

    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing item from wishlist'
        });
    }
};

router.delete('/remove-from-wishlist/:productId', isAuthenticated, wishlistLimiter, handleRemoveFromWishlist);
router.post('/remove-from-wishlist/:productId', isAuthenticated, wishlistLimiter, handleRemoveFromWishlist);
router.post('/remove-from-wishlist', isAuthenticated, wishlistLimiter, handleRemoveFromWishlist);

module.exports = router; 