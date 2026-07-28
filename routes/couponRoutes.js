const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
    applyCoupon,
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon
} = require('../controllers/couponController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * 🔒 حماية خفيفة وصارمة ضد تخمين أكواد الخصم والتكرار العشوائي
 */
const couponLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 10, // حد أقصى 10 محاولات تطبيق كوبون لكل 15 دقيقة لكل IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'تجاوزت عدد محاولات تجربة الكوبونات المسموحة، يرجى المحاولة لاحقاً.' }
});

// ==============================================================================
// 1. تطبيق الخصم للعميل (متاح عند الشراء ومحمي بـ Rate Limiting لمنع التخمين)
// ==============================================================================
router.post('/apply', couponLimiter, applyCoupon);

// ==============================================================================
// 2. إدارة الكوبونات كاملة من قِبل الإدارة والموظفين
// ==============================================================================
// جلب قائمة الكوبونات وإنشاؤها وتحديثها (متاح للمدراء والموظفين المرقين)
router.get('/', protect, staffOrAdminOnly, getCoupons);
router.post('/', protect, staffOrAdminOnly, createCoupon);
router.put('/:id', protect, staffOrAdminOnly, updateCoupon);

// الحذف النهائي للكوبون (مقتصر حصرياً على المالك الأصلي SuperAdmin Only)
router.delete('/:id', protect, superAdminOnly, deleteCoupon);

module.exports = router;