const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * ==============================================================================
 * مسارات المنتجات والوجبات (Products & Menu Routes)
 * ==============================================================================
 */

// 1. مسارات جلب المنتجات والفلترة والبحث والترقيم (Pagination)
// ⚡ مسار حرج جداً للسرعة: يتم استدعاؤه بكثرة لعرض المنيو والواجهة الرئيسية
router.get('/', getProducts);

// جلب تفاصيل وجبة محددة بـ ID
router.get('/:id', getProductById);

// 2. مسارات الإضافة والتعديل المتاحة للمدراء والموظفين المرقين (Staff & Admin)
router.post('/', protect, staffOrAdminOnly, createProduct);
router.put('/:id', protect, staffOrAdminOnly, updateProduct);

// 3. مسار الحذف النهائي للمنتج من قاعدة البيانات (مقتصر حصرياً على المالك الأصلي SuperAdmin)
router.delete('/:id', protect, superAdminOnly, deleteProduct);

module.exports = router;