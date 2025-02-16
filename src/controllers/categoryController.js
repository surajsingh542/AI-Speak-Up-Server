const Category = require('../models/Category');
const { validateCategory, validateSubCategory } = require('../validators/categoryValidator');
const ApiError = require('../utils/ApiError');

// Get all categories
exports.getCategories = async (req, res, next) => {
	try {
		const categories = await Category.find().populate('userCounts.user', 'name');
		const totalComplaints = categories.reduce((sum, cat) => sum + cat.totalComplaints, 0);

		// Get frequent categories for logged-in user
		let frequentCategories = [];
		if (req.user) {
			frequentCategories = categories
				.filter(cat => {
					const userCount = cat.userCounts.find(uc => uc.user.equals(req.user._id));
					return userCount && userCount.count > 0;
				})
				.sort((a, b) => {
					const countA = a.userCounts.find(uc => uc.user.equals(req.user._id)).count;
					const countB = b.userCounts.find(uc => uc.user.equals(req.user._id)).count;
					return countB - countA;
				})
				.slice(0, 3);
		}

		res.json({
			categories,
			frequentCategories,
			totalComplaints
		});
	} catch (error) {
		next(error);
	}
};

// Create new category
exports.createCategory = async (req, res, next) => {
	try {
		const { name, description, icon } = req.body;

		const categoryData = {
			name,
			description,
			icon
		};

		const { error } = validateCategory(categoryData);
		if (error) {
			throw new ApiError(400, error.details[0].message);
		}

		if (!icon || !icon.startsWith('data:image/')) {
			throw new ApiError(400, 'Invalid image format. Must be a base64 encoded image');
		}

		const existingCategory = await Category.findOne({ name });
		if (existingCategory) {
			throw new ApiError(400, 'Category already exists');
		}

		const category = new Category({
			...categoryData,
			subCategories: []
		});

		await category.save();
		res.status(201).json(category);
	} catch (error) {
		next(error);
	}
};

// Add subcategory
exports.addSubCategory = async (req, res, next) => {
	try {
		const { name, description, icon } = req.body;

		if (!icon) {
			throw new ApiError(400, 'Subcategory icon is required');
		}

		// Validate base64 image
		if (!icon.startsWith('data:image/')) {
			throw new ApiError(400, 'Invalid image format');
		}

		const { error } = validateSubCategory({ name, description });
		if (error) {
			throw new ApiError(400, error.details[0].message);
		}

		const category = await Category.findById(req.params.id);
		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		const existingSubCategory = category.subCategories.find(sub => sub.name === name);
		if (existingSubCategory) {
			throw new ApiError(400, 'Subcategory already exists in this category');
		}

		category.subCategories.push({
			name,
			description,
			icon
		});

		await category.save();
		res.status(201).json(category);
	} catch (error) {
		next(error);
	}
};

// Update category
exports.updateCategory = async (req, res, next) => {
	try {
		const { name, description, icon } = req.body;
		const category = await Category.findById(req.params.id);

		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		if (name !== category.name) {
			const existingCategory = await Category.findOne({ name });
			if (existingCategory) {
				throw new ApiError(400, 'Category name already exists');
			}
		}

		const updateData = {
			name,
			description
		};

		if (icon) {
			if (!icon.startsWith('data:image/')) {
				throw new ApiError(400, 'Invalid image format');
			}
			updateData.icon = icon;
		}

		const { error } = validateCategory({
			...updateData,
			icon: updateData.icon || category.icon
		});
		if (error) {
			throw new ApiError(400, error.details[0].message);
		}

		Object.assign(category, updateData);
		await category.save();
		res.json(category);
	} catch (error) {
		next(error);
	}
};

// Update subcategory
exports.updateSubCategory = async (req, res, next) => {
	try {
		const { name, description, icon } = req.body;
		const category = await Category.findById(req.params.categoryId);

		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		const subCategory = category.subCategories.id(req.params.subCategoryId);
		if (!subCategory) {
			throw new ApiError(404, 'Subcategory not found');
		}

		const updateData = {
			name,
			description
		};

		if (icon) {
			if (!icon.startsWith('data:image/')) {
				throw new ApiError(400, 'Invalid image format');
			}
			updateData.icon = icon;
		}

		const { error } = validateSubCategory({
			name: updateData.name,
			description: updateData.description
		});
		if (error) {
			throw new ApiError(400, error.details[0].message);
		}

		Object.assign(subCategory, updateData);
		await category.save();
		res.json(category);
	} catch (error) {
		next(error);
	}
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
	try {
		const category = await Category.findById(req.params.id);
		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		if (category.totalComplaints > 0) {
			throw new ApiError(400, 'Cannot delete category with existing complaints');
		}

		await category.deleteOne();
		res.status(204).send();
	} catch (error) {
		next(error);
	}
};

// Delete subcategory
exports.deleteSubCategory = async (req, res, next) => {
	try {
		const category = await Category.findById(req.params.categoryId);
		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		const subCategory = category.subCategories.id(req.params.subCategoryId);
		if (!subCategory) {
			throw new ApiError(404, 'Subcategory not found');
		}

		if (subCategory.totalComplaints > 0) {
			throw new ApiError(400, 'Cannot delete subcategory with existing complaints');
		}

		category.subCategories.pull(req.params.subCategoryId);
		await category.save();
		res.status(204).send();
	} catch (error) {
		next(error);
	}
};

// Toggle frequently used status
exports.toggleFrequentStatus = async (req, res, next) => {
	try {
		const category = await Category.findById(req.params.id);
		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		category.isFrequentlyUsed = !category.isFrequentlyUsed;
		await category.save();

		res.json(category);
	} catch (error) {
		next(error);
	}
};

// Get category by ID
exports.getCategoryById = async (req, res, next) => {
	try {
		const category = await Category.findById(req.params.id);
		if (!category) {
			throw new ApiError(404, 'Category not found');
		}

		res.json(category);
	} catch (error) {
		next(error);
	}
}; 