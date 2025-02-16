const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const OpenAI = require('openai');
const Complaint = require('../models/Complaint');
const { auth, verifiedAuth } = require('../middleware/auth');
const router = express.Router();
const aiService = require('../utils/aiService');
const emailService = require('../utils/emailService');
const cloudinary = require('../utils/cloudinaryConfig');

// Configure OpenAI
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads/');
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname));
	}
});

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
	fileFilter: (req, file, cb) => {
		const allowedTypes = /jpeg|jpg|png|pdf/;
		const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
		const mimetype = allowedTypes.test(file.mimetype);
		if (extname && mimetype) {
			return cb(null, true);
		}
		cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and PDF files are allowed.'));
	}
});

// Validation middleware
const complaintValidation = [
	body('title').trim().isLength({ min: 5 }),
	body('description').trim().isLength({ min: 10 }),
	body('category').trim().notEmpty()
];

// Create complaint
router.post('/',
	verifiedAuth,
	upload.array('attachments', 5),
	complaintValidation,
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { title, description, category, subCategory, priority } = req.body;
			const attachments = [];

			// Upload files to Cloudinary
			if (req.files) {
				for (const file of req.files) {
					const result = await cloudinary.uploader.upload(file.path);
					attachments.push(result.secure_url); // Store the secure URL
				}
			}

			// Get AI categorization and suggestion
			// const completion = await openai.chat.completions.create({
			// 	model: "gpt-3.5-turbo",
			// 	messages: [
			// 		{
			// 			role: "system",
			// 			content: "You are a helpful assistant that analyzes complaints and provides suggestions."
			// 		},
			// 		{
			// 			role: "user",
			// 			content: `Analyze this complaint and provide suggestions:
			//     Title: ${title}
			//     Description: ${description}`
			// 		}
			// 	],
			// 	max_tokens: 150
			// });

			// const aiSuggestion = completion.choices[0].message.content;
			const aiSuggestion = "Can't provide suggestion as the developer was broke and not able to afford the key as he already have utilized the free credits on his other personal projects";

			const complaint = new Complaint({
				user: req.user._id,
				title,
				description,
				category,
				subCategory,
				priority: priority || 'medium',
				attachments,
				aiResponse: {
					category: category,
					suggestion: aiSuggestion,
					confidence: 0.9
				}
			});

			await complaint.save();

			// Send notification email
			await emailService.sendComplaintCreationEmail(req.user.email, complaint);

			res.status(201).json(complaint);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Get all complaints with filters and pagination
router.get('/', auth, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Check if the user is an admin
		const query = req.user.role === 'admin' ? {} : { user: req.user._id };
		if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
		if (req.query.priority) query.priority = req.query.priority;
		if (req.query.category) query.category = req.query.category;
		if (req.query.search) {
			query.$or = [
				{ title: { $regex: req.query.search, $options: 'i' } },
				{ description: { $regex: req.query.search, $options: 'i' } }
			];
		}

		let sortOptions = { createdAt: -1 }; // default sort

		// Handle different sort options
		switch (req.query.sort) {
			case 'oldest':
				sortOptions = { createdAt: 1 };
				break;
			case 'priority-high':
				sortOptions = {
					priorityValue: -1, // high to low (2 to 0)
					createdAt: -1  // then by date
				};
				break;
			case 'priority-low':
				sortOptions = {
					priorityValue: 1,  // low to high (0 to 2)
					createdAt: -1 // then by date
				};
				break;
			case 'status':
				sortOptions = { status: 1, createdAt: -1 };
				break;
			default: // 'newest' or undefined
				sortOptions = { createdAt: -1 };
		}

		const [complaints, total] = await Promise.all([
			Complaint.find(query)
				.sort(sortOptions)
				.skip(skip)
				.limit(limit)
				.populate('user', 'name email')
				.populate('category')
				.populate('subCategory'),
			Complaint.countDocuments(query)
		]);

		res.json({
			complaints,
			currentPage: page,
			totalPages: Math.ceil(total / limit),
			totalComplaints: total
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Get complaint statistics
router.get('/stats', auth, async (req, res) => {
	try {
		const stats = await Complaint.aggregate([
			{ $match: { user: req.user._id } },
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					resolved: {
						$sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
					},
					pending: {
						$sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
					},
					inProgress: {
						$sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
					}
				}
			}
		]);

		const frequentCategories = await Complaint.aggregate([
			{ $match: { user: req.user._id } },
			{ $group: { _id: '$category', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 5 }
		]);

		res.json({
			stats: stats[0] || {
				total: 0,
				resolved: 0,
				pending: 0,
				inProgress: 0
			},
			frequentCategories
		});
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Get complaint history
router.get('/history', auth, async (req, res) => {
	try {
		const history = await Complaint.find({ user: req.user._id })
			.sort({ updatedAt: -1 })
			.limit(10)
			.select('title status updatedAt');
		res.json(history);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Get single complaint
router.get('/:id', auth, async (req, res) => {
	try {

		const userFilter = req.user.role === 'admin' ? {} : { user: req.user._id };

		const complaint = await Complaint.findOne({
			_id: req.params.id,
			...userFilter
		})
			.populate('user', 'name email')
			.populate('assignedTo', 'name email')
			.populate('comments.user', 'name email')
			.populate('resolution.by', 'name email')
			.populate('category', 'name');

		if (!complaint) {
			return res.status(404).json({ message: 'Complaint not found' });
		}

		res.json(complaint);
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Update complaint
router.put('/:id',
	auth,
	[
		body('title').optional().trim().notEmpty(),
		body('description').optional().trim().notEmpty(),
		body('category').optional().trim().notEmpty(),
		body('priority').optional().isIn(['low', 'medium', 'high'])
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const complaint = await Complaint.findOneAndUpdate(
				{ _id: req.params.id, user: req.user._id },
				{ $set: req.body },
				{ new: true }
			);

			if (!complaint) {
				return res.status(404).json({ message: 'Complaint not found' });
			}

			// Send status update email
			await emailService.sendStatusUpdateEmail(complaint);

			res.json(complaint);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Delete complaint
router.delete('/:id', auth, async (req, res) => {
	try {
		const complaint = await Complaint.findOneAndDelete({
			_id: req.params.id,
			user: req.user._id
		});

		if (!complaint) {
			return res.status(404).json({ message: 'Complaint not found' });
		}

		// TODO: Delete associated files

		res.json({ message: 'Complaint deleted successfully' });
	} catch (error) {
		res.status(500).json({ message: 'Server error', error: error.message });
	}
});

// Add comment to complaint
router.post('/:id/comments',
	auth,
	body('text').trim().notEmpty(),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const complaint = await Complaint.findOne({
				_id: req.params.id,
				user: req.user._id
			}).populate('user', 'name email');

			if (!complaint) {
				return res.status(404).json({ message: 'Complaint not found' });
			}

			const comment = {
				text: req.body.text,
				user: req.user._id,
				createdAt: new Date()
			};

			complaint.comments.push(comment);
			await complaint.save();

			// Populate the user information for the new comment
			const populatedComplaint = await Complaint.findById(complaint._id)
				.populate('user', 'name email')
				.populate('comments.user', 'name email');

			const newComment = populatedComplaint.comments[populatedComplaint.comments.length - 1];

			// Only send email notification if the comment is from someone other than the complaint owner
			if (req.user._id.toString() !== complaint.user._id.toString()) {
				try {
					await emailService.sendNewCommentEmail(complaint, newComment);
				} catch (emailError) {
					console.error('Failed to send comment notification email:', emailError);
					// Continue with the response even if email fails
				}
			}

			res.json(newComment);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Share complaint via email
router.post('/:id/share/email',
	auth,
	[
		body('email').isEmail().normalizeEmail()
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const complaint = await Complaint.findById(req.params.id).populate('user', 'name email');
			if (!complaint) {
				return res.status(404).json({ message: 'Complaint not found' });
			}

			// Send email
			await emailService.sendComplaintShareEmail(req.body.email, complaint, req.user);

			// Update share history
			complaint.sharedOn.email.push({
				to: req.body.email,
				date: new Date()
			});
			await complaint.save();

			res.json({ message: 'Complaint shared successfully' });
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Share complaint on social media
router.post('/:id/share/social',
	auth,
	body('platform').isIn(['twitter', 'facebook', 'linkedin']),
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const complaint = await Complaint.findOne({
				_id: req.params.id,
				user: req.user._id
			});

			if (!complaint) {
				return res.status(404).json({ message: 'Complaint not found' });
			}

			// TODO: Implement social media sharing logic

			complaint.sharedOn.social.push({
				platform: req.body.platform,
				date: Date.now()
			});

			await complaint.save();
			res.json({ message: 'Complaint shared on social media successfully' });
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

// Update complaint status
router.patch('/:id/status',
	auth,
	[
		body('status').isIn(['pending', 'in-progress', 'resolved', 'rejected']),
		body('resolution').optional().trim().notEmpty()
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { status, resolution } = req.body;
			const complaint = await Complaint.findById(req.params.id);

			if (!complaint) {
				return res.status(404).json({ message: 'Complaint not found' });
			}

			// Only admin can update status
			if (req.user.role !== 'admin') {
				return res.status(403).json({ message: 'Not authorized to update complaint status' });
			}

			complaint.status = status;
			if (resolution) {
				complaint.resolution = {
					text: resolution,
					by: req.user._id,
					date: new Date()
				};
			}

			await complaint.save();

			// Populate user information before sending email
			const populatedComplaint = await Complaint.findById(complaint._id)
				.populate('user', 'name email');

			// Send status update email
			await emailService.sendStatusUpdateEmail(populatedComplaint);

			res.json(complaint);
		} catch (error) {
			res.status(500).json({ message: 'Server error', error: error.message });
		}
	}
);

module.exports = router; 