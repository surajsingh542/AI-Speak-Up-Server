const mongoose = require('mongoose');
require('dotenv').config();

async function migratePriorityValues() {
	try {
		// Connect to MongoDB
		await mongoose.connect(process.env.MONGODB_URI);
		console.log('Connected to MongoDB');

		// Update all complaints with low priority
		await mongoose.connection.collection('complaints').updateMany(
			{ priority: 'low' },
			{ $set: { priorityValue: 0 } }
		);

		// Update all complaints with medium priority
		await mongoose.connection.collection('complaints').updateMany(
			{ priority: 'medium' },
			{ $set: { priorityValue: 1 } }
		);

		// Update all complaints with high priority
		await mongoose.connection.collection('complaints').updateMany(
			{ priority: 'high' },
			{ $set: { priorityValue: 2 } }
		);

		console.log('Migration completed successfully');
		process.exit(0);
	} catch (error) {
		console.error('Migration failed:', error);
		process.exit(1);
	}
}

migratePriorityValues(); 