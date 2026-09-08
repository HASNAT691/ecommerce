const express = require('express');
const router = express.Router();
const Wishlist = require('../model/wishlist.model');
const User = require('../model/user.model');
const Product = require('../model/products.models');
const isAuthenticated = require('../middlewares/auth');

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
router.post('/add-to-wishlist', isAuthenticated, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
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
        const existingItem = wishlist.items.find(item => item.productId === productId);
        if (!existingItem) {
            const itemPic = (product.images && product.images.length > 0) ? product.images[0] : (req.body.picture || '');
            wishlist.items.push({
                productId,
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

// Remove from wishlist - protected route
router.delete('/remove-from-wishlist/:productId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const productId = req.params.productId;

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        // Find and remove the item
        const initialLength = wishlist.items.length;
        wishlist.items = wishlist.items.filter(item => item.productId !== productId);

        // Check if item was found and removed
        if (wishlist.items.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in wishlist'
            });
        }

        // Save the updated wishlist
        await wishlist.save();

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
});

module.exports = router; 