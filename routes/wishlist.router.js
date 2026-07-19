const express = require('express');
const router = express.Router();
const Wishlist = require('../model/wishlist.model');
const User = require('../model/user.model');

// Enhanced authentication middleware
const isAuthenticated = async (req, res, next) => {
    try {
        const userId = req.cookies.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to access wishlist'
            });
        }

        const user = await User.findById(userId);
        if (!user || !user.email) {
            res.clearCookie('userId');
            return res.status(401).json({
                success: false,
                message: 'User not found or invalid, please login again'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// View wishlist - protected route with email verification
router.get('/wishlist', isAuthenticated, async (req, res) => {
    try {
        const userId = req.cookies.userId;
        const wishlist = await Wishlist.findOne({ userId });
        const user = req.user; // User is now available from middleware

        res.render('pages/Main_Site_pages/wishlist', { 
            wishlist: wishlist || { items: [] },
            layout: false,
            user: user,
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
        const { productId, price, title, picture } = req.body;
        const userId = req.cookies.userId;
        const userEmail = req.user.email; // Get email from authenticated user

        // Find existing wishlist or create new one
        let wishlist = await Wishlist.findOne({ userId });
        
        if (!wishlist) {
            // Create new wishlist with required fields
            wishlist = new Wishlist({
                userId,
                userEmail, // Add user email here
                items: []
            });
        }

        // Check if item already exists
        const existingItem = wishlist.items.find(item => item.productId === productId);
        if (!existingItem) {
            // Add new item
            wishlist.items.push({
                productId,
                title,
                price: Number(price),
                picture
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
        const userId = req.cookies.userId;
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