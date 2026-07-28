const mongoose = require('mongoose');

/**
 * هيكل بيانات كوبونات وأكواد الخصم التجاري العالمي بـ MongoDB Atlas
 * McDonald's Grade Coupon Schema with Per-User Usage Limits
 */
const couponSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    code: { 
        type: String, 
        required: [true, 'كود الخصم مطلوب'],
        uppercase: true,
        trim: true 
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage' // نسبة مئوية (%) أو مبلغ ثابت (ج.م)
    },
    discountPercentage: { 
        type: Number, 
        default: 0,
        min: [0, 'نسبة الخصم لا تقل عن 0%'],
        max: [100, 'نسبة الخصم لا تتجاوز 100%']
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: [0, 'قيمة الخصم الثابت يجب أن تكون موجبة'] // المبلغ الثابت المخصوم بالجنيه
    },
    maxDiscountAmount: { 
        type: Number, 
        default: 0 // الحد الأقصى لقيمة الخصم المئوي
    },
    minOrderAmount: { 
        type: Number, 
        default: 0 // الحد الأدنى لقيمة الطلب لتطبيق الخصم
    },
    startDate: {
        type: Date,
        default: Date.now // تاريخ بداية تفعيل الكوبون
    },
    expirationDate: { 
        type: Date, 
        required: [true, 'تاريخ انتهاء الكوبون مطلوب'],
        validate: {
            validator: function (value) {
                return !this.startDate || value >= this.startDate;
            },
            message: 'تاريخ انتهاء الكوبون يجب أن يكون بعد تاريخ بداية التفعيل'
        }
    },
    usageLimit: { 
        type: Number, 
        default: 100 // عدد مرات الاستخدام الكلي المسموح بها للكوبون
    },
    usageLimitPerUser: { 
        type: Number, 
        default: 1 // عدد مرات الاستخدام المسموح بها للعميل الواحد
    },
    usedCount: { 
        type: Number, 
        default: 0 
    },
    usedByUsers: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        phone: { type: String, trim: true },
        usedAt: { type: Date, default: Date.now }
    }],
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true 
});

// ⚡ منع تكرار كود الخصم لنفس المطعم بـ MongoDB Atlas
couponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

// ⚡ فهرس مركب استباقي للتحقق الفوري المباشر من صلاحية الكوبون زمنياً
couponSchema.index({ restaurantId: 1, isActive: 1, expirationDate: 1 });

// ⚡ فهرس فرعي لتسريع تتبع استخدام العميل بالكوبون
couponSchema.index({ 'usedByUsers.phone': 1 });
couponSchema.index({ 'usedByUsers.userId': 1 });

module.exports = mongoose.model('Coupon', couponSchema);