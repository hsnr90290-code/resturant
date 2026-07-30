const express = require('express');
const router = express.Router();
const {
    getDeliveryAreas,
    createDeliveryArea,
    updateDeliveryArea,
    deleteDeliveryArea
} = require('../controllers/deliveryAreaController');

const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * ==============================================================================
 * مسارات مناطق ورسوم التوصيل (Delivery Areas Routes)
 * ==============================================================================
 */

// 1. جلب مناطق ورسوم التوصيل المتاحة (متاح علنياً للعملاء لحساب الدليفري بسرعة)
router.get('/', getDeliveryAreas);

// 2. إنشاء وتعديل مناطق ورسوم التوصيل (متاح للإدارة والموظفين لتحديث الأسعار والطقس والمناطق)
router.post('/', protect, staffOrAdminOnly, createDeliveryArea);
router.put('/:id', protect, staffOrAdminOnly, updateDeliveryArea);

// 3. حذف منطقة توصيل نهائياً (مقتصر حصرياً على المالك الأصلي SuperAdmin Only)
router.delete('/:id', protect, superAdminOnly, deleteDeliveryArea);

module.exports = router;