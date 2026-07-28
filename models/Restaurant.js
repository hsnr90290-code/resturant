const mongoose = require('mongoose');

/**
 * هيكل بيانات إعدادات المطعم والتعديل البصري المباشر بـ MongoDB Atlas
 * Enterprise Restaurant Config & Hostinger-Style Visual Live Editor Schema
 */
const restaurantSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'اسم المطعم مطلوب'],
        default: 'مطبخ أبو قورة الفلاحي',
        trim: true 
    },
    slug: { 
        type: String, 
        required: [true, 'رابط المطعم مطلوب'],
        unique: true,
        lowercase: true,
        trim: true,
        default: 'abu-qoura',
        index: true
    },
    logo: { 
        type: String, 
        default: 'default-logo.png',
        trim: true 
    },
    coverImage: { 
        type: String, 
        default: 'default-cover.jpg',
        trim: true 
    },
    description: { 
        type: String, 
        default: 'أشهى المأكولات والمشويات الفلاحية والبلدي الأصيل',
        trim: true 
    },
    whatsappPhone: { 
        type: String, 
        required: [true, 'رقم الواتساب التجاري مطلوب'],
        default: '01120751467',
        trim: true 
    },
    phone: { 
        type: String, 
        default: '01120751467',
        trim: true 
    },
    address: { 
        type: String, 
        default: 'القاهرة - شارع المعز - مصر',
        trim: true 
    },
    currency: { 
        type: String, 
        default: 'ج.م',
        trim: true 
    },
    isAcceptingOrders: { 
        type: Boolean, 
        default: true // مفتاح التحكم اليدوي لفتح/إغلاق المطبخ
    },
    autoCloseOutsideWorkingHours: { 
        type: Boolean, 
        default: true // إيقاف استقبال الطلبات أوتوماتيكياً خارج ساعات العمل
    },
    openingTime: { 
        type: String, 
        default: '10:00', // توقيت فتح المطبخ بنظام 24 ساعة (HH:mm)
        trim: true,
        validate: {
            validator: function (v) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: 'صيغة توقيت الفتح غير صالحة. يرجى استخدام نظام 24 ساعة (مثال: 10:00)'
        }
    },
    closingTime: { 
        type: String, 
        default: '23:59', // توقيت إغلاق المطبخ بنظام 24 ساعة (HH:mm)
        trim: true,
        validate: {
            validator: function (v) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: 'صيغة توقيت الإغلاق غير صالحة. يرجى استخدام نظام 24 ساعة (مثال: 23:59)'
        }
    },
    workingHoursText: { 
        type: String, 
        default: 'يومياً من 10:00 صباحاً حتى 12:00 منتصف الليل',
        trim: true 
    },
    taxPercentage: { 
        type: Number, 
        default: 0,
        min: [0, 'نسبة الضريبة يجب أن لا تكون سالبة'],
        max: [100, 'نسبة الضريبة لا تتجاوز 100%']
    },
    serviceCharge: { 
        type: Number, 
        default: 0,
        min: [0, 'رسوم الخدمة يجب أن لا تكون سالبة']
    },

    // =========================================================================
    // 🎨 نظام التعديل البصري المباشر لكل عنصر بالموقع (Visual Live Editor Map)
    // Hostinger-Style Element-Level Dynamic Overrides Map
    // =========================================================================
    elementOverrides: {
        type: Map,
        of: new mongoose.Schema({
            text: { type: String, default: '' },
            color: { type: String, default: '' },
            bgColor: { type: String, default: '' },
            fontSize: { type: String, default: '' },
            borderRadius: { type: String, default: '' },
            bgImage: { type: String, default: '' },
            isHidden: { type: Boolean, default: false }
        }, { _id: false }),
        default: {}
    },

    // =========================================================================
    // 🎨 نظام التخصيص العام للشكل والألوان (Global Theme Palette)
    // =========================================================================
    theme: {
        primaryColor: { type: String, default: '#a82810' },       // اللون الرئيسي (الأزرار والوسوم)
        primaryHover: { type: String, default: '#8e1f0b' },       // لون التفاعل عند مرور الماوس
        secondaryColor: { type: String, default: '#5a4b10' },     // اللون الثانوي / الذهبي
        goldLight: { type: String, default: '#f7f3e8' },          // خلفيات الأزرار والبادجات الخفيفة
        darkColor: { type: String, default: '#1a1816' },          // الهيدر والفوتر والداكن
        bgColor: { type: String, default: '#fbf9f5' },            // خلفية الموقع العامة
        cardBgColor: { type: String, default: '#ffffff' },        // خلفية الكروت والمودالات
        textColor: { type: String, default: '#1a1816' },          // لون النصوص الرئيسية
        textMutedColor: { type: String, default: '#726b65' },     // لون النصوص الفرعية والتلميحات
        borderColor: { type: String, default: '#eee9e0' },        // لون الحدود والفاصل
        borderRadius: { type: String, default: '20px' },          // انحناء حواف الكروت والأزرار
        fontFamily: { type: String, default: 'Tajawal' },         // الخط العربي الرئيسي
        customCss: { type: String, default: '' }                  // أكواد CSS مخصصة يحقنها السوبر أدمن مباشرة
    },

    // =========================================================================
    // 📝 نصوص ومحتويات الواجهة الأساسية (Content Studio)
    // =========================================================================
    content: {
        brandName: { type: String, default: 'أبو قورة ✨' },
        brandTagline: { type: String, default: 'مطبخ المشويات والبلدي الأصيل' },
        heroTitle: { type: String, default: 'أورا' },
        heroSubtitle: { type: String, default: 'طعم أصيل من قلب مصر' },
        heroBtn1Text: { type: String, default: 'اطلب الآن 🍱' },
        heroBtn2Text: { type: String, default: '🔥 عروض اليوم' },
        heroBgImage: { type: String, default: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600' },
        dealsSectionTitle: { type: String, default: '🔥 أقوى عروض اليوم والخصومات' },
        dealsSectionSubtitle: { type: String, default: 'وجبات فاخرة بأسعار مخفضة لفترة محدودة' },
        topSellersTitle: { type: String, default: '🏆 أفضل 10 أصناف الأكثر طلباً ومبيعاً' },
        topSellersSubtitle: { type: String, default: 'تشكيلة الوجبات الذهبية التي حازت على أعجاب وإقبال عملائنا في مطبخ أبو قورة' },
        menuPageTitle: { type: String, default: 'قائمة الطعام الكاملة 📜' },
        menuPageSubtitle: { type: String, default: 'تصفح أشهى المشويات والطواجن والمخبوزات الفلاحية المجهزة طازجة يومياً' },
        announcementText: { type: String, default: '🎉 أهلاً بكم! خصم 20% لفترة محدودة على جميع المشويات الفلاحية' },
        showAnnouncement: { type: Boolean, default: false },
        footerText: { type: String, default: 'جميع الحقوق محفوظة © 2026 مطبخ أبو قورة - طعم بلدي أصيل' }
    },

    socialLinks: {
        facebook: { type: String, default: '', trim: true },
        instagram: { type: String, default: '', trim: true },
        tiktok: { type: String, default: '', trim: true }
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Restaurant', restaurantSchema);