const mongoose = require('mongoose');

/**
 * هيكل بيانات أقسام المنيو العالمي بـ MongoDB Atlas
 * McDonald's Grade Category Schema with Icon, Description & Auto Products Count
 */
const categorySchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    name: { 
        type: String, 
        required: [true, 'اسم القسم بالعربية مطلوب'],
        trim: true 
    },
    nameEn: { 
        type: String, 
        default: '',
        trim: true 
    },
    slug: {
        type: String,
        lowercase: true,
        trim: true
    },
    description: { 
        type: String, 
        default: '',
        trim: true // وصف القسم (مثال: أشهى الطواجن الفخارية المحضرة بالسمن البلدي)
    },
    image: { 
        type: String, 
        default: 'default-category.png' // صورة غلاف القسم
    },
    icon: { 
        type: String, 
        default: '🍔' // أيقونة القسم التعبيرية
    },
    sortOrder: { 
        type: Number, 
        default: 0 // ترتيب ظهور القسم في المنيو والصفحة الرئيسية
    },
    isHidden: { 
        type: Boolean, 
        default: false // إمكانية إخفاء القسم بالكامل بقرار من الأدمن
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ⚡ ربط افتراضي (Virtual Population) لحساب عدد الوجبات التابعة للقسم تلقائياً بـ MongoDB
categorySchema.virtual('productsCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'categoryId',
    count: true
});

// ⚡ منع تكرار اسم القسم لنفس المطعم بـ MongoDB Atlas
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

// ⚡ فهرس مركب محسن وفق قاعدة ESR (Equality, Sort, Range) للاستعلام السريع
categorySchema.index({ restaurantId: 1, isActive: 1, isHidden: 1, sortOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);