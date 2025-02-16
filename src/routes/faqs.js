const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const FAQ = require('../models/FAQ');
const router = express.Router();

// Get all FAQs (public)
router.get('/', async (req, res) => {
	try {
		const category = req.query.category;
		const query = { isActive: true };
		if (category) {
			query.category = category;
		}

		const faqs = await FAQ.find(query).sort({ order: 1, createdAt: -1 });
		res.json(faqs);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Get FAQ by ID (public)
router.get('/:id', async (req, res) => {
	try {
		const faq = await FAQ.findOne({ _id: req.params.id, isActive: true });
		if (!faq) {
			return res.status(404).json({ message: 'FAQ not found' });
		}
		res.json(faq);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Create FAQ (admin only)
router.post('/',
	adminAuth,
	[
		body('question').trim().notEmpty(),
		body('answer').trim().notEmpty(),
		body('category').isIn(['general', 'account', 'complaints', 'technical', 'security']),
		body('order').optional().isNumeric()
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
router.put('/:id',
	adminAuth,
	[
		body('question').optional().trim().notEmpty(),
		body('answer').optional().trim().notEmpty(),
		body('category').optional().isIn(['general', 'account', 'complaints', 'technical', 'security']),
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
router.delete('/:id', adminAuth, async (req, res) => {
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

// Reorder FAQs (admin only)
router.post('/reorder',
	adminAuth,
	body('orders').isArray(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { orders } = req.body;
			const updates = orders.map(({ id, order }) => ({
				updateOne: {
					filter: { _id: id },
					update: { $set: { order } }
				}
			}));

			await FAQ.bulkWrite(updates);
			const faqs = await FAQ.find().sort({ order: 1, createdAt: -1 });
			res.json(faqs);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

module.exports = router; 