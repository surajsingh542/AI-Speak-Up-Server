const Joi = require('joi');

const categorySchema = Joi.object({
	name: Joi.string()
		.required()
		.min(2)
		.max(50)
		.trim()
		.messages({
			'string.empty': 'Category name is required',
			'string.min': 'Category name must be at least 2 characters long',
			'string.max': 'Category name cannot exceed 50 characters'
		}),
	icon: Joi.string()
		.required()
		.pattern(/^data:image\/[a-zA-Z+]+;base64,/)
		.messages({
			'string.empty': 'Category icon is required',
			'string.pattern.base': 'Invalid image format. Must be a base64 encoded image'
		}),
	isFrequentlyUsed: Joi.boolean()
		.default(false),
	description: Joi.string()
		.required()
		.min(10)
		.max(500)
		.trim()
		.messages({
			'string.empty': 'Category description is required',
			'string.min': 'Category description must be at least 10 characters long',
			'string.max': 'Category description cannot exceed 500 characters'
		})
});

const subCategorySchema = Joi.object({
	name: Joi.string()
		.required()
		.min(2)
		.max(50)
		.trim()
		.messages({
			'string.empty': 'Subcategory name is required',
			'string.min': 'Subcategory name must be at least 2 characters long',
			'string.max': 'Subcategory name cannot exceed 50 characters'
		}),
	description: Joi.string()
		.required()
		.min(10)
		.max(500)
		.trim()
		.messages({
			'string.empty': 'Subcategory description is required',
			'string.min': 'Subcategory description must be at least 10 characters long',
			'string.max': 'Subcategory description cannot exceed 500 characters'
		})
});

exports.validateCategory = (data) => {
	return categorySchema.validate(data, { abortEarly: false });
};

exports.validateSubCategory = (data) => {
	return subCategorySchema.validate(data, { abortEarly: false });
}; 