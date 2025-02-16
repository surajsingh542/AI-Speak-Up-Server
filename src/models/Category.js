const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	icon: {
		type: String,
		required: true,
		// Store base64 string
		maxLength: 5242880 // 5MB max size
	},
	description: {
		type: String,
		required: true,
		trim: true
	},
	totalComplaints: {
		type: Number,
		default: 0
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

const categorySchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	icon: {
		type: String,
		required: true,
		// Store base64 string
		maxLength: 5242880 // 5MB max size
	},
	description: {
		type: String,
		required: true,
		trim: true
	},
	subCategories: [subCategorySchema],
	totalComplaints: {
		type: Number,
		default: 0
	},
	userCounts: [{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		},
		count: {
			type: Number,
			default: 0
		}
	}],
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

// Update timestamps on save
categorySchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	if (this.subCategories && this.subCategories.length > 0) {
		this.subCategories.forEach(sub => {
			sub.updatedAt = Date.now();
		});
	}
	next();
});

// Calculate total complaints from subcategories
categorySchema.methods.calculateTotalComplaints = function () {
	if (this.subCategories && this.subCategories.length > 0) {
		this.totalComplaints = this.subCategories.reduce((sum, sub) => sum + sub.totalComplaints, 0);
	}
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category; 