const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * هيكل بيانات العملاء والحسابات التجاري العالمي بـ MongoDB Atlas
 * McDonald's Grade User Schema with Analytics & Recently Viewed Products
 */
const userSchema = new mongoose.Schema({
    restaurantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Restaurant', 
        required: [true, 'معرف المطعم مطلوب'] 
    },
    avatar: { 
        type: String, 
        default: 'default-avatar.png' // صورة العميل الشخصية
    },
    name: { 
        type: String, 
        required: [true, 'اسم المستخدم مطلوب'],
        trim: true 
    },
    email: { 
        type: String, 
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    phone: { 
        type: String, 
        required: [true, 'رقم الهاتف مطلوب'],
        trim: true,
        index: true
    },
    password: { 
        type: String, 
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف']
    },
    role: { 
        type: String, 
        enum: ['customer', 'staff', 'superadmin'], 
        default: 'customer',
        index: true 
    },
    isBanned: { 
        type: Boolean, 
        default: false 
    },
    ordersCount: { 
        type: Number, 
        default: 0 // عدد الطلبات الكلي التي أجرها العميل
    },
    totalSpent: { 
        type: Number, 
        default: 0 // إجمالي إنفاق العميل المالي Lifetime Value
    },
    lastOrderAt: { 
        type: Date // تاريخ آخر طلب أجرها العميل
    },
    lastLoginIP: { 
        type: String, 
        default: '' 
    },
    lastLoginAt: { 
        type: Date 
    },
    addresses: [{
        title: { type: String, default: 'العنوان الرئيسي' },
        address: { type: String, required: true },
        lat: { type: Number },
        lng: { type: Number },
        isDefault: { type: Boolean, default: false }
    }],
    favorites: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' // المنتجات المفضلة للعميل
    }],
    recentlyViewed: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product' // المنتجات التي شاهدها العميل مؤخراً لدعم الاقتراحات الذكية
    }],
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, { 
    timestamps: true 
});

// تشفير كلمة المرور تلقائياً بواسطة Bcrypt
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// دالة فحص ومطابقة كلمة المرور
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);