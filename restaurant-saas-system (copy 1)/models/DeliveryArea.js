const mongoose = require('mongoose');

/**
 * هيكل بيانات مناطق وسعر التوصيل بـ MongoDB Atlas
 * Enterprise Delivery Zone & Pricing Schema
 */
const deliveryAreaSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    areaName: { 
        type: String, 
        required: [true, 'اسم منطقة التوصيل مطلوب'],
        trim: true 
    },
    deliveryFee: { 
        type: Number, 
        required: [true, 'سعر التوصيل مطلوب'],
        min: [0, 'رسوم التوصيل يجب أن تكون رقماً موجباً'] 
    },
    minOrderAmount: { 
        type: Number, 
        default: 0,
        min: [0, 'الحد الأدنى لقيمة الطلب يجب أن يكون رقماً موجباً'] // الحد الأدنى لقيمة المشتريات للقبول بالتوصيل لهذه المنطقة
    },
    estimatedTimeMinutes: { 
        type: Number, 
        default: 30,
        min: [1, 'الوقت المتوقع للتوصيل يجب أن يكون دقيقة واحدة على الأقل'] // الوقت المتوقع للتوصيل بالدقائق
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true 
});

// ⚡ منع تكرار اسم منطقة التوصيل لنفس المطعم بـ MongoDB Atlas
deliveryAreaSchema.index({ restaurantId: 1, areaName: 1 }, { unique: true });

// ⚡ فهرس مركب لجلب وترتيب المناطق النشطة أونلاين بـ 0ms وبدون In-Memory Sort
deliveryAreaSchema.index({ restaurantId: 1, isActive: 1, areaName: 1 });

module.exports = mongoose.model('DeliveryArea', deliveryAreaSchema);