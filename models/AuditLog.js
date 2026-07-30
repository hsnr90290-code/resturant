const mongoose = require('mongoose');

/**
 * هيكل بيانات سجل الأمان ومراقبة النظام بـ MongoDB Atlas
 * Enterprise Security & Action Audit Log Schema
 */
const auditLogSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant',
        index: true,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    adminName: { 
        type: String, 
        required: [true, 'اسم المسئول مطلوب'],
        trim: true 
    },
    adminEmail: { 
        type: String, 
        required: [true, 'البريد الإلكتروني للمسئول مطلوب'],
        trim: true,
        lowercase: true
    },
    action: { 
        type: String, 
        required: [true, 'نوع الإجراء مطلوب'], // مثال: LOGIN_SUCCESS, BAN_USER, PROMOTE_STAFF, DELETE_PRODUCT
        trim: true,
        index: true
    },
    status: { 
        type: String, 
        enum: ['SUCCESS', 'FAILED', 'WARNING'], 
        default: 'SUCCESS',
        index: true
    },
    ipAddress: { 
        type: String, 
        default: '127.0.0.1',
        trim: true
    },
    userAgent: { 
        type: String, 
        default: '',
        trim: true 
    },
    details: { 
        type: String, 
        default: '',
        trim: true 
    }
}, { 
    timestamps: true 
});

// ⚡ فهارس مركبة استباقية لجلب السجلات زمنياً حسب المطعم وحسب الإجراء بسرعة 0ms
auditLogSchema.index({ restaurantId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ adminEmail: 1, createdAt: -1 });

// ⚡ فهرس تنظيف أوتوماتيكي للبيانات القديمة بعد 180 يوماً لحماية مساحة MongoDB Atlas
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);