const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const emailService = require('../utils/emailService');
const speakeasy = require('speakeasy');
const router = express.Router();

// Register validation middleware
const registerValidation = [
	body('email').isEmail().normalizeEmail(),
	body('password').isLength({ min: 6 }),
	body('name').trim().notEmpty(),
	body('phone').optional().isMobilePhone()
];

// Login validation middleware
const loginValidation = [
	body('email').isEmail().normalizeEmail(),
	body('password').notEmpty()
];

// Register route
router.post('/register', registerValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password, name, phone } = req.body;

		// Check if user already exists
		const existingUser = await User.findOne({ email });
		if (existingUser && existingUser?.isVerified) {
			return res.status(400).json({ message: 'Email already registered' });
		}

		let user = {};
		if (existingUser) {
			// Update existing user
			user = existingUser;
			user.name = name; // Update name
			user.phone = phone; // Update phone
			if (password) {
				user.password = password; // Update password
			}
		} else {
			// Create new user
			user = new User({
				email,
				password,
				name,
				phone
			});
		}

		// Generate verification token
		const verificationToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '24h' }
		);

		user.verificationToken = verificationToken;
		await user.save();

		// Send verification email
		try {
			await emailService.sendVerificationEmail(email, verificationToken);
		} catch (emailError) {
			console.error('Failed to send verification email:', emailError);
			// Don't return error to client, but log it
		}

		res.status(201).json({
			message: 'Registration successful. Please check your email for verification.',
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				isVerified: user.isVerified
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Login route
router.post('/login', loginValidation, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password, twoFactorToken } = req.body;

		// Find user
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		// Check password
		const isMatch = await user.comparePassword(password);
		if (!isMatch) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		// Check if email is verified
		if (!user.isVerified) {
			return res.status(403).json({
				isVerified: false,
				email: user.email,
				message: 'Please verify your email before logging in'
			});
		}

		// Check 2FA if enabled
		if (user.twoFactorAuth?.enabled) {
			if (!twoFactorToken) {
				return res.status(403).json({
					requires2FA: true,
					message: '2FA token required'
				});
			}

			const verified = speakeasy.totp.verify({
				secret: user.twoFactorAuth.secret,
				encoding: 'base32',
				token: twoFactorToken
			});

			if (!verified) {
				return res.status(403).json({
					requires2FA: true,
					message: 'Invalid 2FA token'
				});
			}
		}

		// Generate token
		const token = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);

		// Update last login
		user.lastLogin = Date.now();
		await user.save();

		res.json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				isVerified: user.isVerified,
				twoFactorEnabled: user.twoFactorAuth?.enabled || false
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Resend verification email
router.post('/resend-verification',
	body('email').isEmail().normalizeEmail(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email } = req.body;
			const user = await User.findOne({ email });

			if (!user) {
				return res.status(404).json({ message: 'User not found' });
			}

			if (user.isVerified) {
				return res.status(400).json({ message: 'Email is already verified' });
			}

			// Generate new verification token
			const verificationToken = jwt.sign(
				{ userId: user._id },
				process.env.JWT_SECRET,
				{ expiresIn: '24h' }
			);

			user.verificationToken = verificationToken;
			await user.save();

			// Send verification email
			await emailService.sendVerificationEmail(email, verificationToken);

			res.json({ message: 'Verification email sent successfully' });
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Verify email route
router.get('/verify/:token', async (req, res) => {
	try {
		const { token } = req.params;

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findOne({
			_id: decoded.userId,
			verificationToken: token
		});

		if (!user) {
			return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?verification=failed&message=Invalid or expired verification token`);
		}

		user.isVerified = true;
		user.verificationToken = undefined;
		await user.save();

		res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?verification=success&message=Email verified successfully`);
	} catch (error) {
		if (error.name === 'TokenExpiredError') {
			return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?verification=failed&message=Verification token has expired`);
		}
		res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?verification=failed&message=Verification failed`);
	}
});

// Get current user route
router.get('/me', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('-password');
		res.json(user);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Forgot password route
router.post('/forgot-password',
	body('email').isEmail().normalizeEmail(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { email } = req.body;
			const user = await User.findOne({ email });

			if (!user) {
				return res.status(404).json({ message: 'User not found' });
			}

			// Generate reset token
			const resetToken = jwt.sign(
				{ userId: user._id },
				process.env.JWT_SECRET,
				{ expiresIn: '1h' }
			);

			user.resetPasswordToken = resetToken;
			user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
			await user.save();

			// Send password reset email
			await emailService.sendPasswordResetEmail(email, resetToken);

			res.json({ message: 'Password reset email sent' });
		} catch (error) {
			console.error('Forgot password error:', error);
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Reset password route
router.post('/reset-password/:token',
	body('password').isLength({ min: 6 }),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { token } = req.params;
			const { password } = req.body;

			const user = await User.findOne({
				resetPasswordToken: token,
				resetPasswordExpires: { $gt: Date.now() }
			});

			if (!user) {
				return res.status(400).json({ message: 'Invalid or expired reset token' });
			}

			// Update password
			user.password = password;
			user.resetPasswordToken = undefined;
			user.resetPasswordExpires = undefined;
			await user.save();

			// Send confirmation email
			await emailService.sendPasswordResetConfirmationEmail(user.email);

			res.json({ message: 'Password reset successful' });
		} catch (error) {
			console.error('Reset password error:', error);
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

module.exports = router; 