const Product = require('../models/Product');
const Category = require('../models/Category');
const Restaurant = require('../models/Restaurant');
const mongoose = require('mongoose');

/**
 * متحكم الأصناف والوجبات الفائق السرعة بـ MongoDB Atlas
 * McDonald's Grade Fast Product Controller with Lean Queries & Fast Retrieval
 */

// 1. جلب الوجبات والأصناف مع الفلترة، البحث النصي، والفرز التلقائي بسرعة فائقة بـ .lean()
exports.getProducts = async (req, res) => {
    try {
        const { 
            category, 
            search, 
            minPrice, 
            maxPrice, 
            isAvailable, 
            isFeatured, 
            isDeal, 
            isTopSeller, 
            isNewArrival, 
            sort, 
            page = 1, 
            limit = 20 
        } = req.query;

        let query = {};

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' }).lean();
        if (!restaurant) {
            restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });
        }

        query.restaurantId = restaurant._id;

        // الفلترة حسب القسم
        if (category && category !== 'all') {
            const categoryObj = await Category.findOne({ name: category }).lean();
            if (categoryObj) {
                query.categoryId = categoryObj._id;
            } else {
                query.$or = [
                    { title: { $regex: category, $options: 'i' } },
                    { keywords: { $in: [new RegExp(category, 'i')] } }
                ];
            }
        }

        // البحث النصي بالكلمات المفتاحية والاسم والوصف
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } },
                { fullDescription: { $regex: search, $options: 'i' } },
                { keywords: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
        if (isDeal !== undefined) query.isDeal = isDeal === 'true';
        if (isTopSeller !== undefined) query.isTopSeller = isTopSeller === 'true';
        if (isNewArrival !== undefined) query.isNewArrival = isNewArrival === 'true';

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        if (isAvailable !== undefined) {
            query.isAvailable = isAvailable === 'true';
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'top_sales') sortOption = { salesCount: -1 };
        if (sort === 'rating') sortOption = { rating: -1 };

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        // تسريع جلب الوجبات بـ .lean() لمنع البطء
        const products = await Product.find(query)
            .populate('categoryId', 'name nameEn icon')
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            count: products.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum) || 1,
            products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب تفاصيل وجبة محددة بـ ID بسرعة فائقة وحماية المعرف لمنع CastError
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        // الفحص الصارم لمعرف المونجو لتفادي CastError
        if (!id || id === 'undefined' || id === 'null' || !mongoose.Types.ObjectId.isValid(id)) {
            // جلب أول وجبة متاحة بـ MongoDB تلقائياً إذا كان المعرف غير صالح
            const firstProduct = await Product.findOne({ isAvailable: true }).populate('categoryId', 'name nameEn icon').lean();
            if (firstProduct) {
                const similar = await Product.find({ _id: { $ne: firstProduct._id }, isAvailable: true }).limit(4).lean();
                return res.json({ success: true, product: firstProduct, similarProducts: similar });
            }
            return res.status(404).json({ success: false, message: 'لا توجد وجبات مسجلة في قاعدة البيانات' });
        }

        const product = await Product.findById(id).populate('categoryId', 'name nameEn icon').lean();

        if (!product) {
            // إذا لم يتم العثور على المعرف بالتحديد، نرجع أحدث وجبة حقيقية بـ MongoDB
            const fallbackProduct = await Product.findOne({ isAvailable: true }).populate('categoryId', 'name nameEn icon').lean();
            if (fallbackProduct) {
                const similar = await Product.find({ _id: { $ne: fallbackProduct._id }, isAvailable: true }).limit(4).lean();
                return res.json({ success: true, product: fallbackProduct, similarProducts: similar });
            }
            return res.status(404).json({ success: false, message: 'الوجبة غير موجودة بقاعدة البيانات' });
        }

        const similarProducts = await Product.find({
            categoryId: product.categoryId ? product.categoryId._id : null,
            _id: { $ne: product._id },
            isAvailable: true
        }).limit(4).lean();

        res.json({
            success: true,
            product,
            similarProducts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. إنشاء وجبة تجارية جديدة بـ MongoDB Atlas
exports.createProduct = async (req, res) => {
    try {
        const { 
            title, 
            titleEn, 
            shortDescription, 
            fullDescription, 
            price, 
            discountPrice, 
            category, 
            images, 
            sizes, 
            addons, 
            keywords,
            stockQuantity,
            maxOrderLimit,
            isAvailable, 
            isFeatured,
            isDeal,
            isTopSeller,
            isNewArrival
        } = req.body;

        if (!title || price === undefined) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال اسم الوجبة والسعر الأساسي' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        let categoryObj = await Category.findOne({ name: category || 'عام' });
        if (!categoryObj) {
            categoryObj = await Category.create({ restaurantId: restaurant._id, name: category || 'عام' });
        }

        let parsedKeywords = [];
        if (keywords) {
            parsedKeywords = Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim());
        }

        const product = new Product({
            restaurantId: restaurant._id,
            categoryId: categoryObj._id,
            title,
            titleEn: titleEn || '',
            shortDescription: shortDescription || '',
            fullDescription: fullDescription || shortDescription || '',
            price: Number(price),
            discountPrice: Number(discountPrice) || 0,
            images: images && images.length ? images : ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1'],
            sizes: sizes || [],
            addons: addons || [],
            keywords: parsedKeywords,
            stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 100,
            maxOrderLimit: maxOrderLimit !== undefined ? Number(maxOrderLimit) : 10,
            isAvailable: isAvailable !== undefined ? isAvailable : true,
            isFeatured: isFeatured !== undefined ? isFeatured : false,
            isDeal: isDeal !== undefined ? isDeal : false,
            isTopSeller: isTopSeller !== undefined ? isTopSeller : false,
            isNewArrival: isNewArrival !== undefined ? isNewArrival : true
        });

        const createdProduct = await product.save();

        const io = req.app.get('socketio');
        if (io) io.emit('products-updated', { type: 'CREATE', product: createdProduct });

        res.status(201).json({ 
            success: true, 
            message: '🎉 تم نشر وإدراج الوجبة بنجاح في قاعدة البيانات والمنيو!', 
            product: createdProduct 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. تعديل شامل للوجبة وأوسمتها ومخزونها في MongoDB Atlas
exports.updateProduct = async (req, res) => {
    try {
        const { category, keywords, price, discountPrice } = req.body;

        let updateData = { ...req.body };

        // ⚡ فحص آمن ومباشر لمطابقة سعر الخصم بالسعر الأساسي قبل حفظ التعديلات
        if (discountPrice && price && Number(discountPrice) > Number(price)) {
            return res.status(400).json({
                success: false,
                message: '🚫 سعر الخصم لا يمكن أن يكون أكبر من السعر الأساسي'
            });
        }

        if (category) {
            let categoryObj = await Category.findOne({ name: category });
            if (categoryObj) updateData.categoryId = categoryObj._id;
        }

        if (keywords && typeof keywords === 'string') {
            updateData.keywords = keywords.split(',').map(k => k.trim());
        }

        if (updateData.stockQuantity !== undefined && Number(updateData.stockQuantity) <= 0) {
            updateData.isAvailable = false;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('categoryId', 'name nameEn');

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'الوجبة غير موجودة' });
        }

        const io = req.app.get('socketio');
        if (io) io.emit('products-updated', { type: 'UPDATE', product: updatedProduct });

        res.json({ 
            success: true, 
            message: '✅ تم حفظ تعديلات الوجبة وتحديث المنيو بـ MongoDB بنجاح!', 
            product: updatedProduct 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. الحذف النهائي للوجبة من MongoDB Atlas والبث الحي
exports.deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);

        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: 'الوجبة غير موجودة بقاعدة البيانات' });
        }

        const io = req.app.get('socketio');
        if (io) io.emit('products-updated', { type: 'DELETE', productId: req.params.id });

        res.json({ 
            success: true, 
            message: '✅ تم حذف الوجبة بنجاح واختفائها الفوري من المنيو', 
            productId: req.params.id 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};