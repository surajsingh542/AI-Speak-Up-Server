require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const winston = require('winston');

// Import routes
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const settingsRoutes = require('./routes/settings');
const faqRoutes = require('./routes/faqs');
const adminRoutes = require('./routes/admin');

// Import error handler
const errorHandler = require('./middleware/errorHandler');

// Create Express app
const app = express();

// Logger configuration
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.File({ filename: 'combined.log' })
	]
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.simple()
	}));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true
})
	.then(() => logger.info('Connected to MongoDB'))
	.catch((err) => logger.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	logger.info(`Server is running on port ${PORT}`);
}); 