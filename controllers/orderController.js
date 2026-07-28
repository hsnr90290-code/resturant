const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { generateOrderQR } = require('../utils/qrHelper');
const mongoose = require('mongoose');

/**
 * متحكم الطلبات التجاري المطور بـ Node.js و MongoDB Atlas
 * Production-Ready Order Controller with Server-Side Real QR Generation & Public Digital Invoice
 */

// 1. إنشاء طلب وتوليد كود QR حقيقي يشير إلى الفاتورة الرقمية الإلكترونية أوفلاين/أونلاين
exports.createOrder = async (req, res) => {
    try {
        const { customer, items, couponCode, deliveryFee, scheduledDeliveryTime, paymentMethod } = req.body;

        if (!customer || !customer.name || !customer.name.trim()) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال اسم العميل بالكامل' });
        }

        if (!customer.phone || !customer.phone.trim()) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال رقم الهاتف للتواصل' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'سلة الطلب فارغة! يرجى إضافة وجبات أولاً.' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' }).lean();
        if (!restaurant) {
            restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });
        }

        if (!restaurant.isAcceptingOrders) {
            return res.status(400).json({ success: false, message: '🚫 عفواً! المطبخ متوقف حالياً عن استقبال الطلبات.' });
        }

        let calculatedSubtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const product = await Product.findById(item._id || item.product);

            if (!product) {
                return res.status(404).json({ success: false, message: `الوجبة [${item.title}] غير موجودة بقاعدة البيانات.` });
            }

            if (!product.isAvailable) {
                return res.status(400).json({ success: false, message: `عفواً! الوجبة [${product.title}] غير متوفرة حالياً بالمنيو.` });
            }

            const reqQty = Number(item.quantity || 1);

            if (product.maxOrderLimit > 0 && reqQty > product.maxOrderLimit) {
                return res.status(400).json({ 
                    success: false, 
                    message: `الحد الأقصى للطلب من [${product.title}] هو [${product.maxOrderLimit}] قطع فقط.` 
                });
            }

            if (product.stockQuantity < reqQty) {
                return res.status(400).json({ 
                    success: false, 
                    message: `عفواً! الكمية المتاحة بالمخزن من [${product.title}] هي [${product.stockQuantity}] فقط.` 
                });
            }

            let unitPrice = product.discountPrice > 0 ? product.discountPrice : product.price;

            if (item.selectedSize && item.selectedSize.price) {
                unitPrice = Number(item.selectedSize.price);
            }

            let addonsTotal = 0;
            if (item.selectedAddons && Array.isArray(item.selectedAddons)) {
                addonsTotal = item.selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
            }

            const itemTotalPrice = (unitPrice + addonsTotal) * reqQty;
            calculatedSubtotal += itemTotalPrice;

            processedItems.push({
                product: product._id,
                title: product.title,
                selectedSize: item.selectedSize || null,
                selectedAddons: item.selectedAddons || [],
                unitPrice: unitPrice + addonsTotal,
                quantity: reqQty,
                itemTotal: itemTotalPrice
            });

            product.stockQuantity -= reqQty;
            product.salesCount += reqQty;

            if (product.stockQuantity <= 0) {
                product.isAvailable = false;
                await Notification.create({
                    restaurantId: restaurant._id,
                    title: '⚠️ إنذار نفاد المخزون',
                    message: `نفدت كمية الوجبة [${product.title}] من المخزن أوتوماتيكياً!`,
                    type: 'LOW_STOCK',
                    relatedId: String(product._id)
                });
            }

            await product.save();
        }

        let discountAmount = 0;
        let couponAppliedData = { code: '', percentage: 0 };

        if (couponCode) {
            const coupon = await Coupon.findOne({
                code: couponCode.toUpperCase(),
                restaurantId: restaurant._id,
                isActive: true,
                expirationDate: { $gte: new Date() }
            });

            if (coupon && calculatedSubtotal >= coupon.minOrderAmount) {
                if (coupon.discountType === 'fixed') {
                    discountAmount = coupon.discountAmount;
                } else {
                    discountAmount = (calculatedSubtotal * coupon.discountPercentage) / 100;
                    if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
                        discountAmount = coupon.maxDiscountAmount;
                    }
                }
                couponAppliedData = { code: coupon.code, percentage: coupon.discountPercentage || 0 };
                coupon.usedCount += 1;
                await coupon.save();
            }
        }

        const fee = Number(deliveryFee) || 0;
        let taxAmount = 0;
        if (restaurant.taxPercentage > 0) {
            taxAmount = (calculatedSubtotal * restaurant.taxPercentage) / 100;
        }

        const finalTotalPrice = Math.round(Math.max(0, calculatedSubtotal - discountAmount + fee + taxAmount));
        const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const orderDateObj = new Date();
        const formattedTime = orderDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        const realCustomerName = customer.name.trim();

        // إنشاء الطلب الأولي بـ MongoDB
        const newOrder = await Order.create({
            restaurantId: restaurant._id,
            userId: req.user ? req.user._id : null,
            orderNumber,
            orderDate: orderDateObj,
            orderTime: formattedTime,
            scheduledDeliveryTime: scheduledDeliveryTime || 'في أسرع وقت (ASAP)',
            status: 'New',
            customer: {
                name: realCustomerName,
                phone: customer.phone.trim(),
                whatsappPhone: customer.whatsappPhone ? customer.whatsappPhone.trim() : customer.phone.trim(),
                address: customer.address.trim(),
                notes: customer.notes || '',
                gpsLocation: customer.gpsLocation || { lat: 0, lng: 0, mapUrl: '' }
            },
            items: processedItems,
            subtotal: calculatedSubtotal,
            deliveryFee: fee,
            discountAmount,
            couponApplied: couponAppliedData,
            taxAmount,
            totalPrice: finalTotalPrice,
            paymentMethod: paymentMethod || 'COD',
            statusTimeline: [{ status: 'New', note: 'وصل طلب جديد في انتظار المراجعة' }]
        });

        // توليد صورة الـ QR Code الحقيقية بصيغة Base64 المربوطة برابط الفاتورة الرقمية /invoice/:id
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;

        const { qrImageBase64 } = await generateOrderQR(newOrder, baseUrl);

        newOrder.qrCodeData = qrImageBase64;
        await newOrder.save();

        if (req.user) {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { ordersCount: 1, totalSpent: finalTotalPrice },
                $set: { lastOrderAt: orderDateObj }
            });
        }

        await Notification.create({
            restaurantId: restaurant._id,
            title: '🚨 وصل طلب جديد',
            message: `طلب جديد رقم [${orderNumber}] بقيمة [${finalTotalPrice} ج.م] من [${realCustomerName}]`,
            type: 'NEW_ORDER',
            relatedId: String(newOrder._id)
        });

        const io = req.app.get('socketio');
        if (io) {
            io.emit(`new-order-${restaurant._id}`, newOrder);
            io.emit('new-order-global', newOrder);
            io.emit('notification-sound-alert', { type: 'NEW_ORDER', orderNumber });
        }

        res.status(201).json({
            success: true,
            message: '🎉 تم تسجيل وإرسال طلبك بنجاح وتوليد الفاتورة بـ QR Code!',
            order: newOrder
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. جلب الفاتورة الرقمية المفتوحة
exports.getPublicOrderInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        let order = null;

        if (id && id !== 'latest' && id !== 'invoice.html' && id !== 'invoice' && id !== 'undefined' && id !== 'null') {
            const cleanId = id.trim().toUpperCase();
            order = await Order.findOne({
                $or: [
                    { orderNumber: cleanId },
                    { _id: mongoose.Types.ObjectId.isValid(cleanId) ? cleanId : null }
                ]
            }).populate('restaurantId', 'name logo phone whatsappPhone address').lean();
        }

        if (!order) {
            order = await Order.findOne({}).sort({ createdAt: -1 }).populate('restaurantId', 'name logo phone whatsappPhone address').lean();
        }

        if (!order) {
            return res.status(404).json({ success: false, message: 'لا توجد طلبات مسجلة بـ قاعدة البيانات لعرض الفاتورة' });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. استعلام وتتبع الطلبات المباشر الذكي برقم الهاتف أو كود الطلب
exports.getOrdersByPhoneOrUser = async (req, res) => {
    try {
        const { query } = req.params;
        if (!query) return res.status(400).json({ success: false, message: 'يرجى كتابة رقم الهاتف أو الكود' });

        const trimmedQuery = query.trim();
        const cleanDigits = trimmedQuery.replace(/\D/g, '');

        let searchOr = [
            { 'customer.phone': trimmedQuery },
            { 'customer.whatsappPhone': trimmedQuery },
            { orderNumber: trimmedQuery.toUpperCase() }
        ];

        if (cleanDigits.length >= 6) {
            searchOr.push({ 'customer.phone': { $regex: cleanDigits, $options: 'i' } });
            searchOr.push({ 'customer.whatsappPhone': { $regex: cleanDigits, $options: 'i' } });
        }

        const orders = await Order.find({ $or: searchOr }).sort({ createdAt: -1 }).lean();

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على طلبات لهذا الرقم' });
        }

        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. جلب جميع الطلبات للوحة التحكم
exports.getOrders = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' }).lean();
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        let query = { restaurantId: restaurant._id };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.phone': { $regex: search, $options: 'i' } },
                { 'customer.whatsappPhone': { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum) || 1,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. جلب تفاصيل طلب محدد بـ ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. تحديث حالة الطلب
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, note } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });

        order.status = status;
        order.statusTimeline.push({
            status,
            updatedAt: new Date(),
            note: note || `تحديث حالة الطلب إلى: [${status}]`
        });

        await order.save();

        const io = req.app.get('socketio');
        if (io) {
            io.emit(`order-status-updated-${order._id}`, order);
            io.emit('order-status-updated-global', order);
        }

        res.json({ success: true, message: '✅ تم تحديث حالة الطلب والـ Timeline بنجاح!', order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. الحذف النهائي للطلب من MongoDB Atlas
exports.deleteOrder = async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);

        if (!deletedOrder) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود بـ قاعدة البيانات' });
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('order-deleted-global', { orderId: req.params.id });
        }

        res.json({ 
            success: true, 
            message: '✅ تم حذف الطلب نهائياً من قاعدة البيانات!', 
            orderId: req.params.id 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 8. إلغاء الطلب
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });

        order.status = 'Cancelled';
        order.statusTimeline.push({
            status: 'Cancelled',
            updatedAt: new Date(),
            note: 'تم إلغاء الطلب بقرار المطبخ أو العميل'
        });

        await order.save();

        const io = req.app.get('socketio');
        if (io) io.emit('order-status-updated-global', order);

        res.json({ success: true, message: '✅ تم إلغاء الطلب بنجاح', order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};