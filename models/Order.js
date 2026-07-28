const mongoose = require('mongoose');

/**
 * هيكل بيانات الطلبات التجاري فائق السرعة بـ MongoDB Atlas
 * McDonald's Grade Fast Order Schema with Dedicated Customer WhatsApp Field
 */
const orderSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'],
        index: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: null,
        index: true
    },
    orderNumber: { 
        type: String, 
        required: [true, 'رقم الطلب الفريد مطلوب'], 
        unique: true,
        uppercase: true,
        trim: true,
        index: true 
    },
    orderDate: { 
        type: Date, 
        default: Date.now 
    },
    orderTime: { 
        type: String, 
        default: '',
        trim: true
    },
    scheduledDeliveryTime: { 
        type: String, 
        default: 'في أسرع وقت (ASAP)',
        trim: true 
    },
    status: { 
        type: String, 
        enum: ['New', 'Reviewed', 'Preparing', 'Ready', 'OutForDelivery', 'Delivered', 'Cancelled', 'Rejected'], 
        default: 'New',
        index: true 
    },
    customer: {
        name: { type: String, required: [true, 'اسم العميل مطلوب'], trim: true },
        phone: { type: String, required: [true, 'رقم الهاتف مطلوب'], trim: true },
        whatsappPhone: { type: String, default: '', trim: true }, // رقم الواتساب المخصص لمراسلة العميل
        address: { type: String, required: [true, 'عنوان التوصيل مطلوب'], trim: true },
        notes: { type: String, default: '', trim: true },
        gpsLocation: {
            lat: { type: Number, default: 0 },
            lng: { type: Number, default: 0 },
            mapUrl: { type: String, default: '', trim: true }
        }
    },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        title: { type: String, required: true, trim: true },
        selectedSize: {
            name: { type: String, default: '' },
            price: { type: Number, default: 0 }
        },
        selectedAddons: [{
            name: { type: String },
            price: { type: Number, default: 0 }
        }],
        unitPrice: { type: Number, required: true, min: [0, 'السعر لا يكون سالباً'] },
        quantity: { type: Number, required: true, min: [1, 'الكمية يجب أن تكون 1 على الأقل'], default: 1 },
        itemTotal: { type: Number, required: true, min: [0, 'إجمالي الصنف لا يكون سالباً'] }
    }],
    subtotal: { 
        type: Number, 
        required: true,
        min: [0, 'المجموع الفرعي لا يكون سالباً'] 
    },
    deliveryFee: { 
        type: Number, 
        default: 0,
        min: [0, 'رسوم التوصيل يجب أن تكون موجبة'] 
    },
    discountAmount: { 
        type: Number, 
        default: 0,
        min: [0, 'قيمة الخصم يجب أن تكون موجبة'] 
    },
    couponApplied: {
        code: { type: String, default: '', uppercase: true, trim: true },
        percentage: { type: Number, default: 0 }
    },
    taxAmount: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    totalPrice: { 
        type: Number, 
        required: true,
        min: [0, 'الإجمالي الصافي لا يكون سالباً'] 
    },
    qrCodeData: { 
        type: String, 
        default: '' 
    },
    qrCodeImage: { 
        type: String, 
        default: '' // صورة الـ QR الفعلية Base64
    },
    qrCodeSignature: { 
        type: String, 
        default: '' // التوقيع الرقمي HMAC لمنع التزوير
    },
    paymentMethod: { 
        type: String, 
        enum: ['COD', 'Online', 'VodafoneCash'], 
        default: 'COD' 
    },
    paymentStatus: { 
        type: String, 
        enum: ['Unpaid', 'Paid'], 
        default: 'Unpaid' 
    },
    statusTimeline: [{
        status: { type: String },
        updatedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' }
    }]
}, { 
    timestamps: true 
});

// ⚡ فهارس استعلام مركبة فائقة السرعة لاستجابة لوحة التحكم واستعلام العميل بـ 0ms
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'customer.phone': 1, createdAt: -1 });
orderSchema.index({ 'customer.whatsappPhone': 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);