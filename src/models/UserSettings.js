const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		unique: true
	},
	notifications: {
		email: {
			enabled: { type: Boolean, default: true },
			types: {
				statusUpdates: { type: Boolean, default: true },
				newComments: { type: Boolean, default: true },
				systemUpdates: { type: Boolean, default: true }
			}
		},
		push: {
			enabled: { type: Boolean, default: false },
			types: {
				statusUpdates: { type: Boolean, default: true },
				newComments: { type: Boolean, default: true },
				systemUpdates: { type: Boolean, default: true }
			},
			token: String
		}
	},
	preferences: {
		language: {
			type: String,
			enum: ['en', 'es', 'fr', 'de', 'hi'],
			default: 'en'
		},
		theme: {
			type: String,
			enum: ['light', 'dark', 'system'],
			default: 'system'
		},
		timezone: {
			type: String,
			default: 'UTC'
		}
	},
	security: {
		twoFactorAuth: {
			enabled: { type: Boolean, default: false },
			secret: String,
			backupCodes: [String]
		},
		loginNotifications: { type: Boolean, default: true },
		lastPasswordChange: Date
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

userSettingsSchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	next();
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

module.exports = UserSettings; 