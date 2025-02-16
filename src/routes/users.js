const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../utils/cloudinaryConfig');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads/');
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname));
	}
});

const upload = multer({
	storage,
	limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
	fileFilter: (req, file, cb) => {
		const allowedTypes = /jpeg|jpg|png/;
		const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
		const mimetype = allowedTypes.test(file.mimetype);
		if (extname && mimetype) {
			return cb(null, true);
		}
		cb(new Error('Invalid file type. Only JPEG and PNG files are allowed.'));
	}
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('-password');
		res.json(user);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Update user profile
router.put('/profile',
	auth,
	[
		body('name').optional().trim().notEmpty(),
		body('phone').optional().isMobilePhone(),
		body('email').optional().isEmail().normalizeEmail()
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { name, phone, email } = req.body;
			const updateData = {};

			if (name) updateData.name = name;
			if (phone) updateData.phone = phone;
			if (email && email !== req.user.email) {
				// Check if email is already in use
				const existingUser = await User.findOne({ email });
				if (existingUser) {
					return res.status(400).json({ message: 'Email already in use' });
				}
				updateData.email = email;
				updateData.isVerified = false; // Require re-verification for new email
			}

			const user = await User.findByIdAndUpdate(
				req.user._id,
				{ $set: updateData },
				{ new: true }
			).select('-password');

			res.json(user);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Update profile picture
router.put('/profile/picture', auth, upload.single('profilePicture'), async (req, res) => {
	try {
		const result = await cloudinary.uploader.upload(req.file.path);
		
		const user = await User.findByIdAndUpdate(
			req.user._id,
			{ profilePicture: result.secure_url },
			{ new: true }
		).select('-password');

		res.json(user);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Change password
router.put('/password',
	auth,
	[
		body('currentPassword').notEmpty(),
		body('newPassword').isLength({ min: 6 })
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { currentPassword, newPassword } = req.body;
			const user = await User.findById(req.user._id);

			// Verify current password
			const isMatch = await user.comparePassword(currentPassword);
			if (!isMatch) {
				return res.status(400).json({ message: 'Current password is incorrect' });
			}

			// Update password
			user.password = newPassword;
			await user.save();

			res.json({ message: 'Password updated successfully' });
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Delete own account
router.delete('/me', auth, async (req, res) => {
	try {
		const user = await User.findByIdAndDelete(req.user._id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}
		res.json({ message: 'Account deleted successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Admin routes

// Get all users (admin only)
router.get('/', adminAuth, async (req, res) => {
	try {
		const users = await User.find().select('-password');
		res.json(users);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Get user by ID (admin only)
router.get('/:id', adminAuth, async (req, res) => {
	try {
		const user = await User.findById(req.params.id).select('-password');
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}
		res.json(user);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Update user role (admin only)
router.patch('/:id/role',
	adminAuth,
	body('role').isIn(['user', 'admin']),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await User.findByIdAndUpdate(
				req.params.id,
				{ role: req.body.role },
				{ new: true }
			).select('-password');

			if (!user) {
				return res.status(404).json({ message: 'User not found' });
			}

			res.json(user);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Delete user (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
	try {
		const user = await User.findByIdAndDelete(req.params.id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}
		res.json({ message: 'User deleted successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

module.exports = router; 