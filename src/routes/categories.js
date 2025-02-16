const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, adminAuth } = require('../middleware/auth');

// Public routes
router.get('/', auth, categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);

// Protected routes (admin only)
router.post('/', adminAuth, categoryController.createCategory);
router.put('/:id', adminAuth, categoryController.updateCategory);
router.delete('/:id', adminAuth, categoryController.deleteCategory);

// Subcategory routes (admin only)
router.post('/:id/subcategories', adminAuth, categoryController.addSubCategory);
router.put('/:categoryId/subcategories/:subCategoryId', adminAuth, categoryController.updateSubCategory);
router.delete('/:categoryId/subcategories/:subCategoryId', adminAuth, categoryController.deleteSubCategory);

module.exports = router; 