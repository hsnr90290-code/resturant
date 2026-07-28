const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
    createReview,
    getProductReviews,
    getAllReviewsAdmin,
    toggleReviewApproval,
    deleteReview
} = require('../controllers/reviewController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * 🔒 حماية ضد نشر التقييمات السبام والمزيفة بكثرة
 */
const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // ساعة واحدة
    max: 5, // حد أقصى 5 تقييمات في الساعة لكل IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'تجاوزت الحد المسموح لكتابة التقييمات، يرجى المحاولة لاحقاً.' }
});

// ==============================================================================
// 1. مسارات التقييمات الخاصة بالعملاء
// ==============================================================================
// 🔒 إنشاء تقييم جديد (محمي بـ protect لضمان هويّة العميل + rate limit لمنع السبام)
router.post('/', protect, reviewLimiter, createReview);

// جلب التقييمات المعتمدة لوجبة معينة (متاح للجميع)
router.get('/product/:productId', getProductReviews);

// ==============================================================================
// 2. مسارات إدارة التقييمات للمدراء والموظفين
// ==============================================================================
// استعراض كافة التقييمات للوحة التحكم
router.get('/admin/all', protect, staffOrAdminOnly, getAllReviewsAdmin);

// الموافقة على نشر التقييم أو إخفائه من القائمة (متاح للإدارة والموظفين لتسهيل العمل)
router.put('/:id/toggle-approval', protect, staffOrAdminOnly, toggleReviewApproval);

// ==============================================================================
// 3. الحذف النهائي للتقييم (مقتصر حصرياً على المالك الأصلي SuperAdmin Only)
// ==============================================================================
router.delete('/:id', protect, superAdminOnly, deleteReview);

module.exports = router;