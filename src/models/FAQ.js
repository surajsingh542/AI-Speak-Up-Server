const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
	question: {
		type: String,
		required: true,
		trim: true
	},
	answer: {
		type: String,
		required: true,
		trim: true
	},
	category: {
		type: String,
		required: true,
		trim: true
	},
	order: {
		type: Number,
		default: 0
	},
	isActive: {
		type: Boolean,
		default: true
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

faqSchema.pre('save', function (next) {
	this.updatedAt = Date.now();
	next();
});

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ; 