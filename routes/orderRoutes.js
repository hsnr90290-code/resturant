const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
    createOrder,
    getOrdersByPhoneOrUser,
    getPublicOrderInvoice,
    getOrders,
    getOrderById,
    updateOrderStatus,
    deleteOrder,
    cancelOrder
} = require('../controllers/orderController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');
const { checkWorkingHours } = require('../middleware/workingHoursMiddleware');

/**
 * 🔒 حماية السيرفر والداتا بيز من إنشاء طلبات وهمية بكثرة (Spam Protection)
 */
const orderLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 دقائق
    max: 10, // حد أقصى 10 طلبات شراء خلال 10 دقائق من نفس الـ IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'تجاوزت حد إنشاء الطلبات المسموح به خلال فترة قصيرة، يرجى الانتظار قليلاً.' }
});

// ==============================================================================
// 1. مسارات إنشاء الطلبات والتتبع الفوري
// ==============================================================================
// ⚡ إنشاء طلب جديد محمي بساعات العمل + Rate Limiter لحظر الإغراق
router.post('/', orderLimiter, checkWorkingHours, createOrder);

// تتبع الطلب برقم الهاتف أو اسم المستخدم
router.get('/track/:query', getOrdersByPhoneOrUser);

// الفاتورة الرقمية المباشرة (الممسوحة عبر كود الـ QR)
router.get('/invoice/:id', getPublicOrderInvoice);

// ==============================================================================
// 2. مسارات جلب وإدارة الطلبات (مرتبة برمجياً بشكل صحيح لمنع التعارض)
// ==============================================================================
// ⚡ جلب كافة الطلبات (مخصص للإدارة والموظفين - وضع قبل :id لمنع تعارض Express)
router.get('/', protect, staffOrAdminOnly, getOrders);

// جلب تفاصيل طلب محدد بالمعرف
router.get('/:id', getOrderById);

// تحديث حالة الطلب (قيد التحضير، تم التوصيل... إلخ)
router.put('/:id/status', protect, staffOrAdminOnly, updateOrderStatus);

// إلغاء الطلب (متاح للإدارة وللعملاء المسجلين)
router.put('/:id/cancel', protect, cancelOrder);

// ==============================================================================
// 3. الحذف النهائي للطلب من الداتا بيز (حسّاس جداً ومقتصر على SuperAdmin)
// ==============================================================================
router.delete('/:id', protect, superAdminOnly, deleteOrder);

module.exports = router;