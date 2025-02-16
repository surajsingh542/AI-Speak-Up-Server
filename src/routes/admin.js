const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const FAQ = require('../models/FAQ');
const { adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get all users (admin only)
router.get('/users', adminAuth, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const [users, total] = await Promise.all([
			User.find()
				.select('-password')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
			User.countDocuments()
		]);

		res.json({
			users,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
			total
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Create new user (admin only)
router.post('/users',
	adminAuth,
	[
		body('email')
			.isEmail().withMessage('Invalid email address')
			.normalizeEmail(),
		body('password')
			.optional()
			.isString().withMessage('Password must be a string')
			.isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
		body('name')
			.trim()
			.notEmpty().withMessage('Name is required'),
		body('role')
			.isIn(['user', 'admin']).withMessage('Invalid role'),
		body('status')
			.optional()
			.isIn(['active', 'inactive', 'blocked']).withMessage('Invalid status')
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email, name, role, status } = req.body;
			let { password } = req.body;

			// Check if user already exists
			const existingUser = await User.findOne({ email });
			if (existingUser) {
				return res.status(400).json({ message: 'Email already registered' });
			}

			// Generate random password if not provided
			if (!password) {
				password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
			}

			// Create new user
			const user = new User({
				email,
				password,
				name,
				role,
				status,
				isVerified: true // Admin-created users are automatically verified
			});

			await user.save();

			// Return the generated password in the response if it was auto-generated
			res.status(201).json({
				message: 'User created successfully',
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					status: user.status
				},
				...(password && !req.body.password ? { generatedPassword: password } : {})
			});
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Update user (admin only)
router.put('/users/:id',
	adminAuth,
	[
		body('name').optional().trim().notEmpty(),
		body('email').optional().isEmail().normalizeEmail(),
		body('role').optional().isIn(['user', 'admin']),
		body('status').optional().isIn(['active', 'inactive', 'blocked'])
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const updates = {};
			if (req.body.name) updates.name = req.body.name;
			if (req.body.email) updates.email = req.body.email;
			if (req.body.role) updates.role = req.body.role;
			if (req.body.status) updates.status = req.body.status;

			const user = await User.findByIdAndUpdate(
				req.params.id,
				{ $set: updates },
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
router.delete('/users/:id', adminAuth, async (req, res) => {
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

// Get all FAQs (admin only)
router.get('/faqs', adminAuth, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const [faqs, total] = await Promise.all([
			FAQ.find()
				.sort({ order: 1, createdAt: -1 })
				.skip(skip)
				.limit(limit),
			FAQ.countDocuments()
		]);

		res.json({
			faqs,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
			total
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Create new FAQ (admin only)
router.post('/faqs',
	adminAuth,
	[
		body('question').trim().notEmpty(),
		body('answer').trim().notEmpty(),
		body('category').trim().notEmpty(),
		body('order').optional().isNumeric(),
		body('isActive').optional().isBoolean()
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const faq = new FAQ(req.body);
			await faq.save();

			res.status(201).json(faq);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Update FAQ (admin only)
router.put('/faqs/:id',
	adminAuth,
	[
		body('question').optional().trim().notEmpty(),
		body('answer').optional().trim().notEmpty(),
		body('category').optional().trim().notEmpty(),
		body('order').optional().isNumeric(),
		body('isActive').optional().isBoolean()
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const faq = await FAQ.findByIdAndUpdate(
				req.params.id,
				{ $set: req.body },
				{ new: true }
			);

			if (!faq) {
				return res.status(404).json({ message: 'FAQ not found' });
			}

			res.json(faq);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Delete FAQ (admin only)
router.delete('/faqs/:id', adminAuth, async (req, res) => {
	try {
		const faq = await FAQ.findByIdAndDelete(req.params.id);
		if (!faq) {
			return res.status(404).json({ message: 'FAQ not found' });
		}
		res.json({ message: 'FAQ deleted successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

module.exports = router; 