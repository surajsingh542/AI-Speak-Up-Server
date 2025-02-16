const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true
	},
	password: {
		type: String,
		required: true,
		minlength: 6
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	phone: {
		type: String,
		trim: true
	},
	profilePicture: {
		type: String,
		default: ''
	},
	role: {
		type: String,
		enum: ['user', 'admin'],
		default: 'user'
	},
	isVerified: {
		type: Boolean,
		default: false
	},
	verificationToken: String,
	resetPasswordToken: String,
	resetPasswordExpires: Date,
	lastLogin: Date,
	notifications: {
		email: {
			type: Boolean,
			default: true
		},
		push: {
			type: Boolean,
			default: true
		}
	},
	theme: {
		type: String,
		enum: ['light', 'dark', 'system'],
		default: 'light'
	},
	language: {
		type: String,
		enum: ['en', 'es', 'fr', 'de', 'hi'],
		default: 'en'
	},
	twoFactorAuth: {
		enabled: {
			type: Boolean,
			default: false
		},
		secret: String,
		backupCodes: [String],
		verified: {
			type: Boolean,
			default: false
		}
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();

	try {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

// Update the updatedAt timestamp on save
userSchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	next();
});

const User = mongoose.model('User', userSchema);

module.exports = User; 