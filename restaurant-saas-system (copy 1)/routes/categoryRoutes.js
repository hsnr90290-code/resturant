const express = require('express');
const router = express.Router();
const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * ==============================================================================
 * مسارات إدارة أقسام المنيو (Categories Routes)
 * ==============================================================================
 */

// 1. جلب كافة الأقسام أو قسم محدد (متاح علنياً للعملاء والزوار)
// ⚡ هذا المسار يتم استدعاؤه بكثرة عند فتح القائمة ويتم تحسينه في الكنترولر عبر Lean Queries
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// 2. إنشاء وتعديل أقسام المنيو (متاح للإدارة والموظفين المرقين لتسهيل العمل اليومي)
router.post('/', protect, staffOrAdminOnly, createCategory);
router.put('/:id', protect, staffOrAdminOnly, updateCategory);

// 3. الحذف النهائي للقسم (محمي تماماً حصرياً للمالك الأصلي SuperAdmin لضمان سلامة الداتا)
router.delete('/:id', protect, superAdminOnly, deleteCategory);

module.exports = router;