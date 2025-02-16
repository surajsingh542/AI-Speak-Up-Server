const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	title: {
		type: String,
		required: true,
		trim: true
	},
	description: {
		type: String,
		required: true,
		trim: true
	},
	category: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Category',
		required: true
	},
	subCategory: {
		type: mongoose.Schema.Types.ObjectId,
		required: true
	},
	status: {
		type: String,
		enum: ['pending', 'in-progress', 'resolved', 'rejected'],
		default: 'pending'
	},
	priority: {
		type: String,
		enum: ['low', 'medium', 'high'],
		default: 'medium'
	},
	priorityValue: {
		type: Number,
		default: 1 // 0 for low, 1 for medium, 2 for high
	},
	attachments: [{
		type: String // URLs to uploaded files
	}],
	aiResponse: {
		category: String,
		suggestion: String,
		confidence: Number
	},
	assignedTo: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	resolution: {
		text: String,
		date: Date,
		by: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	},
	comments: [{
		text: String,
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	}],
	sharedOn: {
		email: [{
			to: String,
			date: Date
		}],
		social: [{
			platform: String,
			date: Date
		}]
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

// Update the updatedAt timestamp on save
complaintSchema.pre('save', function (next) {
	this.updatedAt = Date.now();

	// Set priorityValue based on priority string
	switch (this.priority) {
		case 'low':
			this.priorityValue = 0;
			break;
		case 'high':
			this.priorityValue = 2;
			break;
		default: // medium
			this.priorityValue = 1;
	}

	next();
});

// Update category and subcategory complaint counts
complaintSchema.post('save', async function () {
	const Category = mongoose.model('Category');
	const category = await Category.findById(this.category);

	if (category) {
		const subCategory = category.subCategories.id(this.subCategory);
		if (subCategory) {
			subCategory.totalComplaints = await this.constructor.countDocuments({
				category: this.category,
				subCategory: this.subCategory
			});
		}

		// Update user count
		let userCount = category.userCounts.find(uc => uc.user.equals(this.user));
		if (!userCount) {
			category.userCounts.push({
				user: this.user,
				count: 1
			});
		} else {
			userCount.count = await this.constructor.countDocuments({
				category: this.category,
				user: this.user
			});
		}

		category.calculateTotalComplaints();
		await category.save();
	}
});

// Index for faster queries
complaintSchema.index({ user: 1, status: 1 });
complaintSchema.index({ category: 1, subCategory: 1 });
complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint; 