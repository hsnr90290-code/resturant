const mongoose = require('mongoose');

/**
 * هيكل بيانات تقييمات وآراء العملاء الشاملة بـ MongoDB Atlas
 * Enterprise Multi-Aspect Review Schema with Food, Delivery, Service & Image Uploads
 */
const reviewSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: [true, 'معرف الوجبة مطلوب'],
        index: true 
    },
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order',
        default: null 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, 'معرف العميل مطلوب'] 
    },
    userName: { 
        type: String, 
        required: [true, 'اسم العميل مطلوب'],
        trim: true 
    },
    foodRating: { 
        type: Number, 
        required: [true, 'تقييم الوجبة مطلوب'],
        min: [1, 'التقييم لا يقل عن 1'],
        max: [5, 'التقييم لا يتجاوز 5'] 
    },
    deliverySpeedRating: { 
        type: Number, 
        default: 5,
        min: 1,
        max: 5 // تقييم سرعة التوصيل
    },
    serviceRating: { 
        type: Number, 
        default: 5,
        min: 1,
        max: 5 // تقييم مستوى الخدمة والمعاملة
    },
    comment: { 
        type: String, 
        default: '',
        trim: true // تعليق وملاحظة العميل
    },
    images: [{ 
        type: String // صور الوجبة المرفقة من العميل
    }],
    isApproved: { 
        type: Boolean, 
        default: true // إمكانية الموافقة على النشر العلني أو الإخفاء بقرار الإدارة
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// حساب التقييم الإجمالي المتوسط أوتوماتيكياً للوجبة عبر Virtual
reviewSchema.virtual('overallRating').get(function () {
    return Number(((this.foodRating + this.deliverySpeedRating + this.serviceRating) / 3).toFixed(1));
});

// فهارس استعلام سريعة للـ APIS
reviewSchema.index({ productId: 1, isApproved: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);