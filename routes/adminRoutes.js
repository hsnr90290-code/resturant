const express = require('express');
const router = express.Router();
const {
    getAdminStats,
    getAllOrders,
    getSalesReport
} = require('../controllers/adminController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * ==============================================================================
 * مسارات لوحة الإدارة والتقارير (Admin & Management Routes)
 * ==============================================================================
 * 🔒 أمان صارم:
 * - جميع المسارات هنا محمية ببرمجية protect للتأكد من تسجيل الدخول أولاً.
 * - يمنع منعاً باتاً على العميل أو المستخدم العادي (role: 'user') الوصول لهذه المسارات.
 * - فقط (superadmin, admin, staff) هم من يمتلكون الصلاحية.
 */

// 1. جلب الإحصائيات والطلبات الحية من داتا بيز MongoDB
// ⚡ تم جعل :restaurantId? اختياري لتجنب أخطاء 404 عند عدم تمريره في الواجهة
router.get('/stats/:restaurantId?', protect, staffOrAdminOnly, getAdminStats);
router.get('/orders/:restaurantId?', protect, staffOrAdminOnly, getAllOrders);

// 2. جلب تقرير تحليل المبيعات والتقارير المالية المقتصرة حصرياً على المالك الأصلي (SuperAdmin Only)
router.get('/reports/sales', protect, superAdminOnly, getSalesReport);

module.exports = router;