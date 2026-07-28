const Restaurant = require('../models/Restaurant');

/**
 * دالة دقيقة لحساب التوقيت المحلي لمصر (Africa/Cairo) بغض النظر عن توقيت السيرفر
 */
function getEgyptMinutesNow() {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        let hours = 0, minutes = 0;
        for (const part of parts) {
            if (part.type === 'hour') hours = parseInt(part.value, 10);
            if (part.type === 'minute') minutes = parseInt(part.value, 10);
        }
        if (hours === 24) hours = 0;
        return hours * 60 + minutes;
    } catch (e) {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }
}

/**
 * برمجية الفحص الذكي الصارم لمواعيد وساعات عمل المطبخ قبل قبول أي طلب (بتوقيت القاهرة)
 * Ultra-Strict Working Hours Interceptor Middleware (Egypt Cairo Timezone)
 */
const checkWorkingHours = async (req, res, next) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' }).lean();

        if (!restaurant) {
            restaurant = await Restaurant.create({ 
                name: 'مطبخ أبو قورة الفلاحي', 
                slug: 'abu-qoura',
                isAcceptingOrders: true,
                autoCloseOutsideWorkingHours: true,
                openingTime: '10:00',
                closingTime: '23:59'
            });
        }

        // 1. الفحص المباشر لمفتاح القفل اليدوي من الإدارة
        if (!restaurant.isAcceptingOrders) {
            return res.status(400).json({ 
                success: false, 
                message: '🚫 عفواً! المطبخ متوقف حالياً عن استقبال الطلبات بقرار من الإدارة. حاول في وقت لاحق.' 
            });
        }

        // 2. الفحص الدقيق بساعات عمل القاهرة المباشرة بـ MongoDB
        if (restaurant.autoCloseOutsideWorkingHours) {
            const currentMinutes = getEgyptMinutesNow();

            const [openH, openM] = (restaurant.openingTime || '10:00').split(':').map(Number);
            const [closeH, closeM] = (restaurant.closingTime || '23:59').split(':').map(Number);

            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;

            let isOpen = false;

            if (openMinutes <= closeMinutes) {
                // مواعيد داخل نفس اليوم (مثال: من 10:00 ص إلى 11:59 م)
                if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
                    isOpen = true;
                }
            } else {
                // مواعيد ممتدة لما بعد منتصف الليل (مثال: من 10:00 ص إلى 02:00 فجراً)
                if (currentMinutes >= openMinutes || currentMinutes <= closeMinutes) {
                    isOpen = true;
                }
            }

            if (!isOpen) {
                return res.status(400).json({ 
                    success: false, 
                    message: `🌙 عفواً! المطبخ مغلق حالياً خارج مواعيد العمل الرسمية. مواعيد استقبال الطلبات الرسمية بتوقيت القاهرة: [${restaurant.workingHoursText || 'من 10:00 AM حتى 12:00 AM'}]` 
                });
            }
        }

        next();
    } catch (error) {
        console.error('Working Hours Middleware Error:', error.message);
        next();
    }
};

module.exports = { checkWorkingHours, getEgyptMinutesNow };