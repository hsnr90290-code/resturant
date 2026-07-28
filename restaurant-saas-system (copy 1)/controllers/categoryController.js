const Category = require('../models/Category');
const Restaurant = require('../models/Restaurant');

/**
 * متحكم أقسام المنيو المربوط 100% بـ MongoDB Atlas (بدون أي أقسام افتراضية)
 */

// 1. جلب أقسام المنيو الحقيقية المسجلة بـ MongoDB فقط
exports.getCategories = async (req, res) => {
    try {
        const { search, isActive } = req.query;

        let query = {};

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) {
            restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });
        }

        query.restaurantId = restaurant._id;

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nameEn: { $regex: search, $options: 'i' } }
            ];
        }

        // الاستعلام المباشر من MongoDB بدون أي Seed افتراضي
        const categories = await Category.find(query).sort({ sortOrder: 1, createdAt: 1 });

        res.json({ 
            success: true, 
            count: categories.length, 
            categories 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب بيانات قسم محدد بواسطة ID
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود بالداتا بيز' });
        }
        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. إنشاء قسم طعام جديد في MongoDB والبث الحي بـ Socket.io
exports.createCategory = async (req, res) => {
    try {
        const { name, nameEn, image, sortOrder, isActive } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'اسم القسم بالعربية مطلوب' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        // منع تكرار ذات الاسم
        const existingCategory = await Category.findOne({ restaurantId: restaurant._id, name });
        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'هذا القسم مسجل مسبقاً في قاعدة البيانات' });
        }

        const category = await Category.create({
            restaurantId: restaurant._id,
            name,
            nameEn: nameEn || '',
            image: image || 'default-category.png',
            sortOrder: Number(sortOrder) || 0,
            isActive: isActive !== undefined ? isActive : true
        });

        // بث تحديث حقيقي بـ Socket.io لشاشات العملاء
        const io = req.app.get('socketio');
        if (io) io.emit('categories-updated', { type: 'CREATE', category });

        res.status(201).json({ 
            success: true, 
            message: '🎉 تم إنشاء وحفظ قسم المنيو بنجاح في قاعدة البيانات MongoDB!', 
            category 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. تعديل بيانات قسم طعام بـ MongoDB Atlas
exports.updateCategory = async (req, res) => {
    try {
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود بالداتا بيز' });
        }

        const io = req.app.get('socketio');
        if (io) io.emit('categories-updated', { type: 'UPDATE', category: updatedCategory });

        res.json({ 
            success: true, 
            message: '✅ تم تحديث بيانات القسم بنجاح بـ MongoDB!', 
            category: updatedCategory 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. حذف قسم طعام نهائياً من MongoDB Atlas وبث التحديث الفوري
exports.deleteCategory = async (req, res) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);

        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود بالداتا بيز' });
        }

        const io = req.app.get('socketio');
        if (io) io.emit('categories-updated', { type: 'DELETE', categoryId: req.params.id });

        res.json({ 
            success: true, 
            message: '✅ تم حذف القسم نهائياً من قاعدة البيانات والمنيو', 
            categoryId: req.params.id 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};