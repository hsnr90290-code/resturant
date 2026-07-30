const Review = require('../models/Review');
const Product = require('../models/Product');
const Restaurant = require('../models/Restaurant');

/**
 * متحكم التقييمات وآراء العملاء المربوط بـ MongoDB Atlas
 */

// 1. إضافة تقييم جديد مع أخذ اسم العميل الحقيقي
exports.createReview = async (req, res) => {
    try {
        const { productId, orderId, foodRating, deliverySpeedRating, serviceRating, comment, userName, images } = req.body;

        if (!productId || !foodRating) {
            return res.status(400).json({ success: false, message: 'يرجى تحديد الوجبة وقيمة التقييم' });
        }

        // استخراج الاسم الحقيقي للعميل
        let realCustomerName = '';
        if (req.user && req.user.name) {
            realCustomerName = req.user.name;
        } else if (userName && userName.trim()) {
            realCustomerName = userName.trim();
        } else {
            return res.status(400).json({ success: false, message: 'يرجى كتابة اسمك لإدراج التقييم' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'الوجبة غير موجودة بقاعدة البيانات' });
        }

        let reviewImages = [];
        if (req.files && req.files.length > 0) {
            reviewImages = req.files.map(f => `/uploads/${f.filename}`);
        } else if (images && Array.isArray(images)) {
            reviewImages = images;
        }

        const review = await Review.create({
            restaurantId: restaurant._id,
            productId,
            orderId: orderId || null,
            userId: req.user ? req.user._id : null,
            userName: realCustomerName,
            foodRating: Number(foodRating),
            deliverySpeedRating: Number(deliverySpeedRating) || 5,
            serviceRating: Number(serviceRating) || 5,
            comment: comment ? comment.trim() : '',
            images: reviewImages,
            isApproved: true
        });

        // إعادة حساب متوسط نجوم المنتج أوتوماتيكياً
        const reviewsStats = await Review.aggregate([
            { $match: { productId: product._id, isApproved: true } },
            { $group: { _id: '$productId', avgRating: { $avg: '$foodRating' }, count: { $sum: 1 } } }
        ]);

        if (reviewsStats.length > 0) {
            product.rating = Number(reviewsStats[0].avgRating.toFixed(1));
            product.ratingsCount = reviewsStats[0].count;
            await product.save();
        }

        res.status(201).json({
            success: true,
            message: '🎉 تم تسجيل تقييمك بنجاح!',
            review
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب التقييمات المعتمدة لوجبة معينة
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId, isApproved: true }).sort({ createdAt: -1 }).lean();

        let avgFood = 5, avgDelivery = 5, avgService = 5;
        if (reviews.length > 0) {
            avgFood = (reviews.reduce((s, r) => s + r.foodRating, 0) / reviews.length).toFixed(1);
            avgDelivery = (reviews.reduce((s, r) => s + r.deliverySpeedRating, 0) / reviews.length).toFixed(1);
            avgService = (reviews.reduce((s, r) => s + r.serviceRating, 0) / reviews.length).toFixed(1);
        }

        res.json({
            success: true,
            count: reviews.length,
            averages: {
                food: Number(avgFood),
                delivery: Number(avgDelivery),
                service: Number(avgService)
            },
            reviews
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. جلب جميع التقييمات للوحة الأدمن
exports.getAllReviewsAdmin = async (req, res) => {
    try {
        const reviews = await Review.find({})
            .populate('productId', 'title price images')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, count: reviews.length, reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. الموافقة على نشر التقييم أو إخفائه
exports.toggleReviewApproval = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'التقييم غير موجود' });
        }

        review.isApproved = !review.isApproved;
        await review.save();

        res.json({
            success: true,
            message: review.isApproved ? '✅ تم نشر التقييم علنياً' : '🚫 تم إخفاء التقييم عن العلن',
            isApproved: review.isApproved
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. حذف تقييم نهائياً
exports.deleteReview = async (req, res) => {
    try {
        const deletedReview = await Review.findByIdAndDelete(req.params.id);
        if (!deletedReview) {
            return res.status(404).json({ success: false, message: 'التقييم غير موجود' });
        }
        res.json({ success: true, message: '✅ تم حذف التقييم بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};