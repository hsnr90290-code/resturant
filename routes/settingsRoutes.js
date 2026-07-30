const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, updateElementOverride } = require('../controllers/settingsController');
const { protect, superAdminOnly, staffOrAdminOnly } = require('../middleware/authMiddleware');

/**
 * ==============================================================================
 * مسارات إعدادات المطعم والتعديل البصري المباشر (Restaurant Settings & Visual Live Editor Routes)
 * ==============================================================================
 */

// 1. جلب إعدادات المطعم، الألوان، النصوص، والتعديلات البصرية المباشرة (متاح للجميع)
router.get('/', getSettings);

// 2. حفظ وتحديث إعدادات المطعم العامة وساعات العمل والهوية
router.put('/', protect, staffOrAdminOnly, updateSettings);

// 3. مسار التعديل البصري بالنقر الأيمن المباشر من المالك/الإدارة على العناصر بـ Hostinger-Style
router.put('/element', protect, staffOrAdminOnly, updateElementOverride);

module.exports = router;