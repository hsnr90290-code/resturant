const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const mongoose = require('mongoose');

/**
 * متحكم لوحة تحكم الإدارة التجاري المتقدم بـ MongoDB Aggregations
 * McDonald's Grade Admin Analytics & Executive Reporting Controller
 */

// 1. جلب الإحصائيات والأرقام الإدارية الأحد عشر المباشرة من MongoDB
exports.getAdminStats = async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        const restaurantId = restaurant._id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // أ) الطلبات الجديدة
        const newOrdersCount = await Order.countDocuments({ restaurantId, status: 'New' });

        // ب) الطلبات النشطة حالياً (في الانتظار، المراجعة، التحضير، أو خرج للتوصيل)
        const activeOrdersNow = await Order.countDocuments({ 
            restaurantId, 
            status: { $in: ['New', 'Reviewed', 'Preparing', 'Ready', 'OutForDelivery'] } 
        });

        // ج) الطلبات المكتملة
        const completedOrders = await Order.countDocuments({ restaurantId, status: 'Delivered' });

        // د) الطلبات الملغية أو المرفوضة
        const cancelledOrders = await Order.countDocuments({ 
            restaurantId, 
            status: { $in: ['Cancelled', 'Rejected'] } 
        });

        // هـ) الطلبات المتأخرة (نشطة وتجاوزت 45 دقيقة من إنشائها)
        const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
        const lateOrders = await Order.countDocuments({
            restaurantId,
            status: { $in: ['New', 'Reviewed', 'Preparing', 'Ready', 'OutForDelivery'] },
            createdAt: { $lte: fortyFiveMinsAgo }
        });

        // و) إجمالي الإيرادات المالية للطلبات المكتملة
        const totalRevenueAgg = await Order.aggregate([
            { 
                $match: { 
                    restaurantId: new mongoose.Types.ObjectId(restaurantId),
                    status: 'Delivered'
                } 
            },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        const totalRevenue = totalRevenueAgg[0] ? totalRevenueAgg[0].total : 0;

        // ز) متوسط قيمة الطلب الواحد (Average Order Value - AOV)
        const averageOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

        // ح) أكثر وأقل المنتجات مبيعاً من MongoDB
        const topSellingProduct = await Product.findOne({ restaurantId }).sort({ salesCount: -1 }).select('title salesCount price');
        const lowestSellingProduct = await Product.findOne({ restaurantId }).sort({ salesCount: 1 }).select('title salesCount price');

        // ط) أحدث العملاء المسجلين
        const recentCustomers = await User.find({ restaurantId, role: 'customer' })
            .select('name email phone totalSpent ordersCount createdAt')
            .sort({ createdAt: -1 })
            .limit(5);

        // ي) أحدث 10 طلبات مباشرة بالداتا بيز
        const recentOrders = await Order.find({ restaurantId })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            stats: {
                activeOrdersNow,
                newOrders: newOrdersCount,
                lateOrders,
                cancelledOrders,
                completedOrders,
                totalRevenue,
                averageOrderValue,
                topSellingProduct: topSellingProduct ? `${topSellingProduct.title} (${topSellingProduct.salesCount} مبيعات)` : 'لا يوجد',
                lowestSellingProduct: lowestSellingProduct ? `${lowestSellingProduct.title} (${lowestSellingProduct.salesCount} مبيعات)` : 'لا يوجد'
            },
            recentCustomers,
            recentOrders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب كافة الطلبات بالكامل بـ MongoDB
exports.getAllOrders = async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        const restaurantId = restaurant ? restaurant._id : null;

        const orders = await Order.find({ restaurantId }).sort({ createdAt: -1 });
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. تقرير المبيعات المالي المفصل
exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        const restaurantId = restaurant._id;

        let matchQuery = { 
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            status: 'Delivered'
        };

        if (startDate && endDate) {
            matchQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const report = await Order.aggregate([
            { $match: matchQuery },
            { 
                $group: { 
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: "$totalPrice" },
                    avgValue: { $avg: "$totalPrice" }
                } 
            },
            { $sort: { _id: -1 } }
        ]);

        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};