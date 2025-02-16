const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const router = express.Router();

// Get user settings
router.get('/', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('-password');
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.json({
			notifications: user.notifications || {
				email: true,
				push: true
			},
			theme: user.theme || 'light',
			language: user.language || 'en',
			twoFactorAuth: {
				enabled: user.twoFactorAuth?.enabled || false,
				verified: user.twoFactorAuth?.verified || false
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Update user preferences
router.patch('/preferences', auth, [
	body('theme').optional().isIn(['light', 'dark', 'system']),
	body('language').optional().isIn(['en', 'es', 'fr', 'de', 'hi']),
	body('notifications.email').optional().isBoolean(),
	body('notifications.push').optional().isBoolean()
], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { theme, language, notifications } = req.body;
		const updateData = {};

		if (theme) updateData.theme = theme;
		if (language) updateData.language = language;
		if (notifications) updateData.notifications = notifications;

		const user = await User.findByIdAndUpdate(
			req.user._id,
			{ $set: updateData },
			{ new: true }
		).select('-password');

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.json({
			notifications: user.notifications,
			theme: user.theme,
			language: user.language,
			twoFactorAuth: {
				enabled: user.twoFactorAuth?.enabled || false,
				verified: user.twoFactorAuth?.verified || false
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Update user settings
router.put('/', auth, async (req, res) => {
	try {
		const { notifications, theme, language } = req.body;

		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (notifications) user.notifications = notifications;
		if (theme) user.theme = theme;
		if (language) user.language = language;

		await user.save();

		res.json({
			notifications: user.notifications,
			theme: user.theme,
			language: user.language,
			twoFactorAuth: {
				enabled: user.twoFactorAuth?.enabled || false,
				verified: user.twoFactorAuth?.verified || false
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Enable 2FA - Step 1: Generate secret and QR code
router.post('/2fa/enable', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Generate new secret
		const secret = speakeasy.generateSecret({
			name: `SpeakUp:${user.email}`
		});

		// Save secret to user
		user.twoFactorAuth = {
			...user.twoFactorAuth,
			secret: secret.base32,
			enabled: false,
			verified: false
		};
		await user.save();

		// Generate QR code
		const otpauthUrl = speakeasy.otpauthURL({
			secret: secret.ascii,
			label: `SpeakUp:${user.email}`,
			issuer: 'SpeakUp'
		});
		const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

		res.json({
			secret: secret.base32,
			qrCode: qrCodeUrl
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Enable 2FA - Step 2: Verify and activate
router.post('/2fa/verify',
	auth,
	body('token').isLength({ min: 6, max: 6 }).isNumeric(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await User.findById(req.user._id);
			if (!user?.twoFactorAuth?.secret) {
				return res.status(400).json({ message: '2FA not set up' });
			}

			const verified = speakeasy.totp.verify({
				secret: user.twoFactorAuth.secret,
				encoding: 'base32',
				token: req.body.token
			});

			if (!verified) {
				return res.status(400).json({ message: 'Invalid verification code' });
			}

			// Generate backup codes
			const backupCodes = generateBackupCodes();

			user.twoFactorAuth = {
				...user.twoFactorAuth,
				enabled: true,
				verified: true,
				backupCodes
			};
			await user.save();

			res.json({
				message: '2FA enabled successfully',
				backupCodes
			});
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Disable 2FA
router.post('/2fa/disable', auth, async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		user.twoFactorAuth = {
			enabled: false,
			secret: null,
			verified: false,
			backupCodes: []
		};
		await user.save();

		res.json({ message: '2FA disabled successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Verify 2FA token (for testing)
router.post('/2fa/validate',
	auth,
	body('token').isLength({ min: 6, max: 6 }).isNumeric(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await User.findById(req.user._id);
			if (!user?.twoFactorAuth?.enabled) {
				return res.status(400).json({ message: '2FA not enabled' });
			}

			const verified = speakeasy.totp.verify({
				secret: user.twoFactorAuth.secret,
				encoding: 'base32',
				token: req.body.token
			});

			res.json({ valid: verified });
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Helper function to generate backup codes
function generateBackupCodes(count = 8) {
	const codes = [];
	for (let i = 0; i < count; i++) {
		codes.push(Math.random().toString(36).substr(2, 8).toUpperCase());
	}
	return codes;
}

module.exports = router; 