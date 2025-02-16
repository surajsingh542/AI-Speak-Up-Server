const nodemailer = require('nodemailer');
const winston = require('winston');

class EmailService {
	constructor() {
		// Create a logger instance
		this.logger = winston.createLogger({
			level: 'info',
			format: winston.format.json(),
			transports: [
				new winston.transports.File({ filename: 'error.log', level: 'error' }),
				new winston.transports.File({ filename: 'combined.log' })
			]
		});

		if (process.env.NODE_ENV !== 'production') {
			this.logger.add(new winston.transports.Console({
				format: winston.format.simple()
			}));
		}

		// Configure nodemailer
		this.transporter = nodemailer.createTransport({
			service: process.env.EMAIL_SERVICE,
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS
			}
		});

		// Verify transporter
		this.transporter.verify((error, success) => {
			if (error) {
				this.logger.error('Email service error:', error);
			} else {
				this.logger.info('Email service is ready');
			}
		});
	}

	async sendVerificationEmail(email, token) {
		try {
			const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

			const mailOptions = {
				from: `"Speak Up" <${process.env.EMAIL_USER}>`,
				to: email,
				subject: 'Verify Your Email - Speak Up',
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h1 style="color: #FF5A5F;">Welcome to Speak Up!</h1>
						<p>Thank you for registering. Please verify your email address by clicking the button below:</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${verificationUrl}" 
								style="background-color: #FF5A5F; 
								color: white; 
								padding: 12px 24px; 
								text-decoration: none; 
								border-radius: 4px;
								display: inline-block;">
								Verify Email
							</a>
						</div>
						<p>Or copy and paste this link in your browser:</p>
						<p>${verificationUrl}</p>
						<p>This link will expire in 24 hours.</p>
						<p>If you didn't create an account, please ignore this email.</p>
						<hr style="border: 1px solid #eee; margin: 20px 0;">
						<p style="color: #666; font-size: 12px;">
							This is an automated message, please do not reply to this email.
						</p>
					</div>
				`
			};

			const info = await this.transporter.sendMail(mailOptions);
			this.logger.info('Verification email sent:', info.messageId);
			return info;
		} catch (error) {
			this.logger.error('Error sending verification email:', error);
			throw error;
		}
	}

	async sendPasswordResetEmail(email, token) {
		const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

		console.log(resetUrl)

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: email,
			subject: 'Reset Your Password - Speak Up',
			html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      `
		};

		return this.transporter.sendMail(mailOptions);
	}

	async sendPasswordResetConfirmationEmail(email) {
		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: email,
			subject: 'Password Reset Successful - Speak Up',
			html: `
				<h1>Password Reset Successful</h1>
				<p>Your password has been successfully reset.</p>
				<p>If you did not perform this action, please contact our support team immediately.</p>
				<p>You can now log in with your new password.</p>
				<a href="${process.env.FRONTEND_URL}/login">Login to your account</a>
			`
		};

		return this.transporter.sendMail(mailOptions);
	}

	async sendComplaintShareEmail(to, complaint, sharedBy) {
		const complaintUrl = `${process.env.FRONTEND_URL}/complaints/${complaint._id}`;

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to,
			subject: `Complaint Shared: ${complaint.title}`,
			html: `
        <h1>Complaint Details</h1>
        <p><strong>Shared by:</strong> ${sharedBy.name} (${sharedBy.email})</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>Category:</strong> ${complaint.category}</p>
        <p><strong>Status:</strong> ${complaint.status}</p>
        <p><strong>Description:</strong></p>
        <p>${complaint.description}</p>
        <p>View the complete complaint here:</p>
        <a href="${complaintUrl}">View Complaint</a>
      `
		};

		return this.transporter.sendMail(mailOptions);
	}

	async sendStatusUpdateEmail(complaint) {
		const complaintUrl = `${process.env.FRONTEND_URL}/complaints/${complaint._id}`;

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: complaint.user.email,
			subject: `Complaint Status Updated: ${complaint.title}`,
			html: `
        <h1>Complaint Status Update</h1>
        <p>Your complaint status has been updated.</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>New Status:</strong> ${complaint.status}</p>
        <p>View the complete complaint here:</p>
        <a href="${complaintUrl}">View Complaint</a>
      `
		};

		return this.transporter.sendMail(mailOptions);
	}

	async sendNewCommentEmail(complaint, comment) {
		const complaintUrl = `${process.env.FRONTEND_URL}/complaints/${complaint._id}`;

		const mailOptions = {
			from: process.env.EMAIL_USER,
			to: complaint.user.email,
			subject: `New Comment on Your Complaint: ${complaint.title}`,
			html: `
        <h1>New Comment</h1>
        <p>A new comment has been added to your complaint.</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>Comment:</strong> ${comment.text}</p>
        <p><strong>By:</strong> ${comment.user.name}</p>
        <p>View the complete complaint here:</p>
        <a href="${complaintUrl}">View Complaint</a>
      `
		};

		return this.transporter.sendMail(mailOptions);
	}

	async sendComplaintCreationEmail(email, complaint) {
		try {
			const complaintUrl = `${process.env.FRONTEND_URL}/complaints/${complaint._id}`;

			const mailOptions = {
				from: `"Speak Up" <${process.env.EMAIL_USER}>`,
				to: email,
				subject: `Complaint Created: ${complaint.title}`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h1 style="color: #FF5A5F;">Complaint Created Successfully</h1>
						<p>Your complaint has been successfully created and is being processed.</p>
						<div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
							<p><strong>Title:</strong> ${complaint.title}</p>
							<p><strong>Category:</strong> ${complaint.category}</p>
							<p><strong>Status:</strong> ${complaint.status}</p>
							<p><strong>Reference ID:</strong> ${complaint._id}</p>
						</div>
						<p>You can track your complaint status by clicking the button below:</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${complaintUrl}" 
								style="background-color: #FF5A5F; 
								color: white; 
								padding: 12px 24px; 
								text-decoration: none; 
								border-radius: 4px;
								display: inline-block;">
								View Complaint
							</a>
						</div>
						<p>Or copy and paste this link in your browser:</p>
						<p>${complaintUrl}</p>
						<hr style="border: 1px solid #eee; margin: 20px 0;">
						<p style="color: #666; font-size: 12px;">
							This is an automated message, please do not reply to this email.
						</p>
					</div>
				`
			};

			const info = await this.transporter.sendMail(mailOptions);
			this.logger.info('Complaint creation email sent:', info.messageId);
			return info;
		} catch (error) {
			this.logger.error('Error sending complaint creation email:', error);
			throw error;
		}
	}
}

module.exports = new EmailService(); 