const DeliveryArea = require('../models/DeliveryArea');
const Restaurant = require('../models/Restaurant');

/**
 * متحكم مناطق التوصيل المربوط 100% بـ MongoDB Atlas (بدون أي قيم افتراضية)
 */

// 1. جلب مناطق التوصيل المتاحة الحقيقية المسجلة بـ MongoDB فقط
exports.getDeliveryAreas = async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) {
            restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });
        }

        // الاستعلام المباشر من قاعدة البيانات بدون أي Seed افتراضي
        const areas = await DeliveryArea.find({ restaurantId: restaurant._id, isActive: true }).sort({ areaName: 1 });

        res.json({ 
            success: true, 
            count: areas.length, 
            areas 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. إنشاء منطقة توصيل جديدة وحفظها المباشر في MongoDB Atlas
exports.createDeliveryArea = async (req, res) => {
    try {
        const { areaName, deliveryFee, minOrderAmount, estimatedTimeMinutes } = req.body;

        if (!areaName || deliveryFee === undefined) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المنطقة وسعر التوصيل' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) {
            restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });
        }

        const area = await DeliveryArea.create({
            restaurantId: restaurant._id,
            areaName,
            deliveryFee: Number(deliveryFee),
            minOrderAmount: Number(minOrderAmount) || 0,
            estimatedTimeMinutes: Number(estimatedTimeMinutes) || 30
        });

        res.status(201).json({ 
            success: true, 
            message: '🎉 تم إضافة منطقة التوصيل بنجاح في قاعدة البيانات MongoDB!', 
            area 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. تعديل بيانات منطقة توصيل بـ MongoDB
exports.updateDeliveryArea = async (req, res) => {
    try {
        const updatedArea = await DeliveryArea.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedArea) {
            return res.status(404).json({ success: false, message: 'منطقة التوصيل غير موجودة' });
        }

        res.json({ 
            success: true, 
            message: '✅ تم تحديث بيانات منطقة التوصيل بنجاح بـ MongoDB!', 
            area: updatedArea 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. الحذف النهائي لمنطقة التوصيل من MongoDB Atlas
exports.deleteDeliveryArea = async (req, res) => {
    try {
        const deletedArea = await DeliveryArea.findByIdAndDelete(req.params.id);

        if (!deletedArea) {
            return res.status(404).json({ success: false, message: 'المنطقة غير موجودة' });
        }

        res.json({ 
            success: true, 
            message: '✅ تم حذف منطقة التوصيل بنجاح من قاعدة البيانات MongoDB' 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};