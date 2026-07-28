const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
    checkSuperAdminExists,
    registerSuperAdmin,
    getMe,
    loginAdmin,
    promoteToStaff,
    banUserToggle,
    deleteUser,
    getAllUsers,
    registerUser,
    loginUser,
    logoutUser
} = require('../controllers/authController');

const { protect, superAdminOnly } = require('../middleware/authMiddleware');

/**
 * 🔒 حماية إضافية ضد هجمات التخمين (Brute-Force Protection)
 * تمنع المهاجمين من تجربة كلمات المرور أوتوماتيكياً على مسارات تسجيل الدخول
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 10, // حد أقصى 10 محاولات دخول فقط لكل IP لمنع التخمين
    standardHeaders: true,
    legacyHeaders: false,
    message: { 
        status: 429, 
        message: 'تم تجاوز عدد محاولات تسجيل الدخول المسموحة. يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً.' 
    }
});

// ==============================================================================
// 1. مسارات فحص وجود المالك الأصلي واسترجاع هويّة الجلسة الحالية
// ==============================================================================
// فحص وجود سوبر آدمن (تم الدمج برامتر اختياري لمنع التكرار)
router.get('/check-superadmin/:restaurantId?', checkSuperAdminExists);

// 🔒 إصلاح الثغرة: إضافة protect للتأكد من فحص التوكن وجلب بيانات req.user بأمان
router.get('/me', protect, getMe);

// ==============================================================================
// 2. مسارات تسجيل وحفظ دخول الإدارة والعملاء (مربوطة بـ authLimiter لحظر التخمين)
// ==============================================================================
// إنشاء حساب السوبر آدمن الأول فقط (يفحص الكنترولر عدم وجود مالك سابق)
router.post('/register-superadmin', authLimiter, registerSuperAdmin);

// 🔒 تسجيل دخول الإدارة والموظفين حصراً (يجب أن يمنع الكنترولر أي مستخدم برتبة user من الدخول هنا)
router.post('/login-admin', authLimiter, loginAdmin);

// تسجيل حساب عميل جديد وتسجيل دخول العملاء العاديين
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// تسجيل الخروج
router.post('/logout', logoutUser);

// ==============================================================================
// 3. مسارات إدارية حصرية تماماً للمالك الأصلي (SuperAdmin Only)
// ==============================================================================
// جلب كافة المستخدمين بالنظام
router.get('/users/:restaurantId?', protect, superAdminOnly, getAllUsers);

// ترقية مستخدم إلى موظف (Staff)
router.put('/promote/:userId', protect, superAdminOnly, promoteToStaff);

// حظر أو إلغاء حظر مستخدم (Ban / Unban)
router.put('/ban/:userId', protect, superAdminOnly, banUserToggle);

// حذف مستخدم نهائياً من قاعدة البيانات
router.delete('/users/:userId', protect, superAdminOnly, deleteUser);

module.exports = router;