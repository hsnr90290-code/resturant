const mongoose = require('mongoose');

/**
 * هيكل بيانات الوجبات التجاري العالمي بـ MongoDB Atlas
 * McDonald's Grade Product Schema with Multi-Images, Stock & Auto Discount
 */
const productSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    categoryId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: [true, 'قسم الوجبة مطلوب'],
        index: true 
    },
    title: { 
        type: String, 
        required: [true, 'اسم المنتج بالعربية مطلوب'],
        trim: true 
    },
    titleEn: { 
        type: String, 
        default: '',
        trim: true 
    },
    shortDescription: { 
        type: String, 
        default: '',
        trim: true 
    },
    fullDescription: { 
        type: String, 
        default: '',
        trim: true 
    },
    images: [{ 
        type: String, 
        default: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1' 
    }],
    price: { 
        type: Number, 
        required: [true, 'السعر الأساسي مطلوب'],
        min: [0, 'السعر يجب أن يكون رقماً موجباً'] 
    },
discountPrice: { 
        type: Number, 
        default: 0,
        min: [0, 'سعر الخصم يجب أن يكون رقماً موجباً'],
        validate: {
            validator: function (val) {
                // إذا كان سعر الخصم 0 أو غير مدخل، فالحقل صالح
                if (!val || Number(val) === 0) return true;

                // استخراج السعر الأساسي حسب سياق التشغيل (إنشاء أو تحديث)
                let basePrice = this.price;

                // في حالة التحديث عبر findByIdAndUpdate، جلب السعر من كائن التحديث
                if (basePrice === undefined && typeof this.getUpdate === 'function') {
                    const update = this.getUpdate();
                    basePrice = update.price ?? update.$set?.price;
                }

                // إذا تعذر جلب السعر الأساسي من كائن التعديل، يتخطى الفحص ويترك الفحص للكنترولر
                if (basePrice === undefined || basePrice === null) return true;

                return Number(val) <= Number(basePrice);
            },
            message: 'سعر الخصم لا يمكن أن يكون أكبر من السعر الأساسي'
        }
    },
    isAvailable: { 
        type: Boolean, 
        default: true,
        index: true 
    },
    isFeatured: { 
        type: Boolean, 
        default: false // ظهور المنتج في الصفحة الرئيسية
    },
    isDeal: { 
        type: Boolean, 
        default: false // ظهور المنتج ضمن عروض اليوم
    },
    isTopSeller: { 
        type: Boolean, 
        default: false // وسام الأكثر مبيعاً
    },
    isNewArrival: { 
        type: Boolean, 
        default: false // وسام منتج جديد
    },
    stockQuantity: { 
        type: Number, 
        default: 100, // الكمية المتوفرة بالمخزن
        min: [0, 'الكمية بالمخزن لا تكون سالبة'] 
    },
    maxOrderLimit: { 
        type: Number, 
        default: 10, // الحد الأقصى للطلب للفرد
        min: [1, 'حد الطلب الأقصى لا يقل عن قطعة واحدة'] 
    },
    keywords: [{ 
        type: String, 
        trim: true 
    }],
    sizes: [{
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 }
    }],
    addons: [{
        name: { type: String, required: true, trim: true },
        price: { type: Number, default: 0, min: 0 },
        image: { type: String, default: '' },
        isHidden: { type: Boolean, default: false } // إمكانية إخفاء الإضافة
    }],
    salesCount: { 
        type: Number, 
        default: 0,
        min: 0,
        index: true 
    },
    rating: { 
        type: Number, 
        default: 5.0,
        min: 1,
        max: 5,
        index: true 
    },
    ratingsCount: { 
        type: Number, 
        default: 1,
        min: 0 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ⚡ خاصية وهمية حاسبة أوتوماتيكياً لنسبة الخصم المئوية
productSchema.virtual('discountPercentage').get(function () {
    if (this.discountPrice > 0 && this.discountPrice < this.price) {
        return Math.round(((this.price - this.discountPrice) / this.price) * 100);
    }
    return 0;
});

// ⚡ إنشاء فهرس البحث النصي الترجيحي بدعم اللغة العربية ومنع التشتت
productSchema.index(
    { 
        title: 'text', 
        keywords: 'text', 
        shortDescription: 'text', 
        fullDescription: 'text' 
    },
    {
        weights: {
            title: 10,
            keywords: 5,
            shortDescription: 2,
            fullDescription: 1
        },
        default_language: 'none',
        name: 'ProductTextSearchIndex'
    }
);

//  فهارس الفرز والاستعلام المركب السريع جداً
productSchema.index({ restaurantId: 1, categoryId: 1, isAvailable: 1, createdAt: -1 });
productSchema.index({ restaurantId: 1, isAvailable: 1, salesCount: -1 });
productSchema.index({ restaurantId: 1, isAvailable: 1, rating: -1 });
productSchema.index({ restaurantId: 1, isAvailable: 1, price: 1 });
productSchema.index({ restaurantId: 1, isDeal: 1, isAvailable: 1 });

module.exports = mongoose.model('Product', productSchema);