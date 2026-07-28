const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * برمجية فحص حماية الجلسة والتوكين وفحص حظر الحسابات
 */
const protect = async (req, res, next) => {
    let token = null;

    // ⚡ إعطاء الأولوية لتوكن الهيدر المحدث
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '🚫 غير مصرح لك! يرجى تسجيل الدخول أولاً للوصول لهذه الصفحة.' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ORA_SECRET_KEY_2026');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: '🚫 المستخدم غير موجود بقاعدة البيانات.' 
            });
        }

        if (user.isBanned) {
            return res.status(403).json({ 
                success: false, 
                message: '❌ تم حظر حسابك من قبل الإدارة.' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: '🚫 رمز الحماية غير صالح أو انتهت صلاحية الجلسة.' 
        });
    }
};

const superAdminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: '🚫 عفواً! هذه العملية مخصصة حصرياً للمالك الأصلي والوحيد للنظام (SuperAdmin).' 
        });
    }
};

const staffOrAdminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'staff' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: '🚫 عفواً! هذه المنطقة مخصصة لإدارة المطعم والموظفين المصرح لهم فقط.' 
        });
    }
};

module.exports = { 
    protect, 
    superAdminOnly, 
    staffOrAdminOnly,
    adminOnly: staffOrAdminOnly 
};