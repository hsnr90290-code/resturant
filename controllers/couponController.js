const Coupon = require('../models/Coupon');
const Restaurant = require('../models/Restaurant');

/**
 * متحكم الكوبونات والعروض المتقدم بـ MongoDB Atlas
 * McDonald's Grade Coupon Controller with Per-Customer Limits & Fixed/Percentage Discounts
 */

// 1. التحقق وتطبيق كود الخصم بـ MongoDB مع فحص الحد الأقصى لاستخدام العميل الواحد
exports.applyCoupon = async (req, res) => {
    try {
        const { code, subtotal, customerPhone } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال كود الخصم' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        const restaurantId = restaurant ? restaurant._id : null;

        const coupon = await Coupon.findOne({
            code: code.toUpperCase().trim(),
            restaurantId,
            isActive: true
        });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'كود الخصم غير صحيح أو غير متاح' });
        }

        const now = new Date();

        // أ) فحص تاريخ بداية وتفعيل الكوبون
        if (coupon.startDate && new Date(coupon.startDate) > now) {
            return res.status(400).json({ success: false, message: 'عفواً! هذا الكوبون لم يبدأ تفعيله بعد.' });
        }

        // ب) فحص تاريخ انتهاء الكوبون
        if (new Date(coupon.expirationDate) < now) {
            return res.status(400).json({ success: false, message: 'عفواً! لقد انتهت صلاحية هذا الكوبون' });
        }

        // ج) فحص عدد مرات الاستخدام الإجمالي الكلي
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'عفواً! تم استنفاد الحد الأقصى لاستخدام هذا الكوبون' });
        }

        // د) فحص حظر الاستخدام المكرر لنفس العميل (بواسطة رقم الهاتف أو الـ UserId)
        const currentPhone = customerPhone || (req.user ? req.user.phone : '');

        if (currentPhone && coupon.usageLimitPerUser > 0) {
            const userUsedCount = coupon.usedByUsers.filter(u => u.phone === currentPhone).length;
            if (userUsedCount >= coupon.usageLimitPerUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: `عفواً! لقد استنفدت الحد المسموح لك به لاستخدام هذا الكوبون (${coupon.usageLimitPerUser} مرة).` 
                });
            }
        }

        // هـ) فحص الحد الأدنى لقيمة الطلب
        const subtotalNum = Number(subtotal) || 0;
        if (subtotalNum < coupon.minOrderAmount) {
            return res.status(400).json({ 
                success: false, 
                message: `هذا الكوبون يتطلب حداً أدنى للطلب بقيمة [${coupon.minOrderAmount} ج.م]` 
            });
        }

        // و) حساب قيمة الخصم المستحق (خصم مئوي أو مبلغ ثابت)
        let discountAmount = 0;

        if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discountAmount;
        } else {
            discountAmount = (subtotalNum * coupon.discountPercentage) / 100;
            if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
                discountAmount = coupon.maxDiscountAmount;
            }
        }

        res.json({
            success: true,
            message: `🎉 تم تطبيق الخصم بنجاح!`,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountPercentage: coupon.discountPercentage,
                discountAmount: Math.round(discountAmount)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب جميع الكوبونات المسجلة بالداتا بيز للوحة الأدمن
exports.getCoupons = async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        const restaurantId = restaurant ? restaurant._id : null;

        const coupons = await Coupon.find({ restaurantId }).sort({ createdAt: -1 });
        res.json({ success: true, count: coupons.length, coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. إنشاء كوبون خصم جديد بمواصفات تجارية كاملة بـ MongoDB
exports.createCoupon = async (req, res) => {
    try {
        const { 
            code, 
            discountType, 
            discountPercentage, 
            discountAmount, 
            maxDiscountAmount, 
            minOrderAmount, 
            startDate, 
            expirationDate, 
            usageLimit, 
            usageLimitPerUser 
        } = req.body;

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        const formattedCode = code.toUpperCase().trim();

        const existingCoupon = await Coupon.findOne({ restaurantId: restaurant._id, code: formattedCode });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'كود الخصم هذا مسجل بالفعل مسبقاً' });
        }

        const coupon = await Coupon.create({
            restaurantId: restaurant._id,
            code: formattedCode,
            discountType: discountType || 'percentage',
            discountPercentage: Number(discountPercentage) || 0,
            discountAmount: Number(discountAmount) || 0,
            maxDiscountAmount: Number(maxDiscountAmount) || 0,
            minOrderAmount: Number(minOrderAmount) || 0,
            startDate: startDate ? new Date(startDate) : new Date(),
            expirationDate: new Date(expirationDate),
            usageLimit: Number(usageLimit) || 100,
            usageLimitPerUser: Number(usageLimitPerUser) || 1
        });

        res.status(201).json({ 
            success: true, 
            message: '🎉 تم إنشاء وحفظ كوبون الخصم التجاري بنجاح بـ MongoDB!', 
            coupon 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. تعديل بيانات كوبون أو تجميد تداوله
exports.updateCoupon = async (req, res) => {
    try {
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'الكوبون غير موجود بقاعدة البيانات' });
        }

        res.json({ success: true, message: '✅ تم تحديث بيانات الكوبون بنجاح بـ MongoDB!', coupon: updatedCoupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. الحذف النهائي للكوبون من MongoDB Atlas
exports.deleteCoupon = async (req, res) => {
    try {
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);

        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: 'الكوبون غير موجود بالداتا بيز' });
        }

        res.json({ success: true, message: '✅ تم حذف كود الخصم نهائياً من قاعدة البيانات' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};