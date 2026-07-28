const mongoose = require('mongoose');

/**
 * هيكل بيانات الإشعارات والإنذارات الصوتية الحية بـ MongoDB Atlas
 * Enterprise Real-Time Notification & Low-Stock Sound Alert Schema
 */
const notificationSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    title: { 
        type: String, 
        required: [true, 'عنوان الإشعار مطلوب'],
        trim: true 
    },
    message: { 
        type: String, 
        required: [true, 'نص الإشعار مطلوب'],
        trim: true 
    },
    type: { 
        type: String, 
        enum: ['NEW_ORDER', 'CANCELLED_ORDER', 'LOW_STOCK', 'COUPON_EXPIRED', 'SYSTEM'], 
        required: true,
        index: true 
    },
    relatedId: { 
        type: String, 
        default: '' // معرف الطلب أو المنتج والمرجع المرتبط بـ الإشعار
    },
    relatedModel: {
        type: String,
        enum: ['Order', 'Product', 'Coupon', 'Restaurant', 'System'],
        default: 'System' // نوع الكائن المرتبط لإنشاء روابط التوجيه الذكي باللوحة
    },
    isRead: { 
        type: Boolean, 
        default: false,
        index: true
    },
    soundAlert: { 
        type: Boolean, 
        default: true // تشغيل ملف الصوت التلقائي عند جلب الإشعار
    }
}, { 
    timestamps: true 
});

// ⚡ فهارس استعلام مركبة فائقة السرعة لجلب أحدث الإشعارات والإنذارات الغير مقروءة
notificationSchema.index({ restaurantId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ restaurantId: 1, createdAt: -1 });

// ⚡ تنظيف وتفريغ أوتوماتيكي للإشعارات القديمة جداً بعد 60 يوماً لحماية ذاكرة MongoDB Atlas
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);