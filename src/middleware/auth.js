const jwt = require('jsonwebtoken');
const User = require('../models/User');
const speakeasy = require('speakeasy');

const auth = async (req, res, next) => {
	try {
		const token = req.header('Authorization')?.replace('Bearer ', '');

		if (!token) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findOne({ _id: decoded.userId });

		if (!user) {
			return res.status(401).json({ message: 'User not found' });
		}

		req.user = user;
		req.token = token;
		next();
	} catch (error) {
		res.status(401).json({ message: 'Invalid authentication token' });
	}
};

const adminAuth = async (req, res, next) => {
	try {
		await auth(req, res, () => {
			if (req.user.role !== 'admin') {
				return res.status(403).json({ message: 'Admin access required' });
			}
			next();
		});
	} catch (error) {
		res.status(401).json({ message: 'Authentication failed' });
	}
};

const verifiedAuth = async (req, res, next) => {
	try {
		await auth(req, res, () => {
			if (!req.user.isVerified) {
				return res.status(403).json({ message: 'Email verification required' });
			}
			next();
		});
	} catch (error) {
		res.status(401).json({ message: 'Authentication failed' });
	}
};

const twoFactorAuth = async (req, res, next) => {
	try {
		await auth(req, res, () => {
			// Skip 2FA check if it's not enabled for the user
			if (!req.user.twoFactorAuth?.enabled) {
				return next();
			}

			const { twoFactorToken } = req.body;

			// If 2FA is enabled but no token provided
			if (!twoFactorToken) {
				return res.status(403).json({
					message: '2FA token required',
					requires2FA: true
				});
			}

			// Verify the token
			const verified = speakeasy.totp.verify({
				secret: req.user.twoFactorAuth.secret,
				encoding: 'base32',
				token: twoFactorToken
			});

			if (!verified) {
				return res.status(403).json({
					message: 'Invalid 2FA token',
					requires2FA: true
				});
			}

			next();
		});
	} catch (error) {
		res.status(401).json({ message: 'Authentication failed' });
	}
};

module.exports = {
	auth,
	adminAuth,
	verifiedAuth,
	twoFactorAuth
}; 