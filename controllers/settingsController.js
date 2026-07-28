const Restaurant = require('../models/Restaurant');

/**
 * دالة دقيقة لحساب التوقيت المحلي لمصر (Africa/Cairo)
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
 * دالة مساعدة لحساب حالة فتح/إغلاق المطبخ اللحظية بتوقيت القاهرة
 */
const checkIsOpenNow = (restaurant) => {
    if (!restaurant) return { isOpenNow: false, reason: 'بيانات المطعم غير مسجلة' };

    // 1. الفحص المباشر لمفتاح القفل اليدوي
    if (!restaurant.isAcceptingOrders) {
        return { 
            isOpenNow: false, 
            reason: '🚫 عفواً! المطبخ متوقف حالياً عن استقبال الطلبات بقرار من الإدارة.' 
        };
    }

    // 2. الفحص التلقائي لمواعيد وساعات العمل بتوقيت القاهرة
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
            return {
                isOpenNow: false,
                reason: `🌙 المطبخ مغلق حالياً بتوقيت القاهرة. مواعيد استقبال الطلبات الرسمية: [${restaurant.workingHoursText || 'من 10:00 AM حتى 12:00 AM'}]`
            };
        }
    }

    return { isOpenNow: true, reason: 'المطبخ مفتوح ويستقبل الطلبات الآن ✅' };
};

// 1. جلب إعدادات المطعم والتصميم والنصوص وتعديلات العناصر البصرية بـ MongoDB Atlas
exports.getSettings = async (req, res) => {
    try {
        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' }).lean();

        if (!restaurant) {
            restaurant = await Restaurant.create({
                name: 'مطبخ أبو قورة الفلاحي',
                slug: 'abu-qoura',
                whatsappPhone: '01120751467',
                phone: '01120751467',
                address: 'القاهرة - شارع المعز - مصر',
                openingTime: '10:00',
                closingTime: '23:59',
                workingHoursText: 'يومياً من 10:00 صباحاً حتى 12:00 منتصف الليل',
                isAcceptingOrders: true,
                autoCloseOutsideWorkingHours: true
            });
        }

        // حساب حالة الفتح/الإغلاق أوتوماتيكياً
        const statusCheck = checkIsOpenNow(restaurant);

        res.json({
            success: true,
            settings: {
                ...restaurant,
                isOpenNow: statusCheck.isOpenNow,
                closedReason: statusCheck.reason
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. تحديث إعدادات المطعم وساعات العمل والواتساب + التخصيص الشامل بـ Socket.io
exports.updateSettings = async (req, res) => {
    try {
        const { 
            name, 
            whatsappPhone, 
            phone, 
            address, 
            description, 
            logo,
            coverImage,
            openingTime,
            closingTime,
            workingHoursText, 
            isAcceptingOrders, 
            autoCloseOutsideWorkingHours, 
            taxPercentage, 
            serviceCharge,
            socialLinks,
            theme,
            content,
            elementOverrides
        } = req.body;

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });

        if (!restaurant) {
            restaurant = new Restaurant({ slug: 'abu-qoura' });
        }

        // تحديث البيانات الأساسية
        if (name !== undefined) restaurant.name = name;
        if (whatsappPhone !== undefined) restaurant.whatsappPhone = whatsappPhone.trim();
        if (phone !== undefined) restaurant.phone = phone.trim();
        if (address !== undefined) restaurant.address = address;
        if (description !== undefined) restaurant.description = description;
        if (logo !== undefined) restaurant.logo = logo;
        if (coverImage !== undefined) restaurant.coverImage = coverImage;
        if (openingTime !== undefined) restaurant.openingTime = openingTime;
        if (closingTime !== undefined) restaurant.closingTime = closingTime;
        if (workingHoursText !== undefined) restaurant.workingHoursText = workingHoursText;
        if (isAcceptingOrders !== undefined) restaurant.isAcceptingOrders = isAcceptingOrders;
        if (autoCloseOutsideWorkingHours !== undefined) restaurant.autoCloseOutsideWorkingHours = autoCloseOutsideWorkingHours;
        if (taxPercentage !== undefined) restaurant.taxPercentage = Number(taxPercentage);
        if (serviceCharge !== undefined) restaurant.serviceCharge = Number(serviceCharge);
        if (socialLinks !== undefined) restaurant.socialLinks = { ...restaurant.socialLinks, ...socialLinks };

        if (elementOverrides && typeof elementOverrides === 'object') {
            restaurant.elementOverrides = elementOverrides;
        }

        if (theme && typeof theme === 'object') {
            restaurant.theme = {
                primaryColor: theme.primaryColor || restaurant.theme?.primaryColor || '#a82810',
                primaryHover: theme.primaryHover || restaurant.theme?.primaryHover || '#8e1f0b',
                secondaryColor: theme.secondaryColor || restaurant.theme?.secondaryColor || '#5a4b10',
                goldLight: theme.goldLight || restaurant.theme?.goldLight || '#f7f3e8',
                darkColor: theme.darkColor || restaurant.theme?.darkColor || '#1a1816',
                bgColor: theme.bgColor || restaurant.theme?.bgColor || '#fbf9f5',
                cardBgColor: theme.cardBgColor || restaurant.theme?.cardBgColor || '#ffffff',
                textColor: theme.textColor || restaurant.theme?.textColor || '#1a1816',
                textMutedColor: theme.textMutedColor || restaurant.theme?.textMutedColor || '#726b65',
                borderColor: theme.borderColor || restaurant.theme?.borderColor || '#eee9e0',
                borderRadius: theme.borderRadius || restaurant.theme?.borderRadius || '20px',
                fontFamily: theme.fontFamily || restaurant.theme?.fontFamily || 'Tajawal',
                customCss: theme.customCss !== undefined ? theme.customCss : (restaurant.theme?.customCss || '')
            };
        }

        if (content && typeof content === 'object') {
            restaurant.content = {
                brandName: content.brandName || restaurant.content?.brandName || 'أبو قورة ✨',
                brandTagline: content.brandTagline || restaurant.content?.brandTagline || 'مطبخ المشويات والبلدي الأصيل',
                heroTitle: content.heroTitle || restaurant.content?.heroTitle || 'أورا',
                heroSubtitle: content.heroSubtitle || restaurant.content?.heroSubtitle || 'طعم أصيل من قلب مصر',
                heroBtn1Text: content.heroBtn1Text || restaurant.content?.heroBtn1Text || 'اطلب الآن 🍱',
                heroBtn2Text: content.heroBtn2Text || restaurant.content?.heroBtn2Text || '🔥 عروض اليوم',
                heroBgImage: content.heroBgImage || restaurant.content?.heroBgImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600',
                dealsSectionTitle: content.dealsSectionTitle || restaurant.content?.dealsSectionTitle || '🔥 أقوى عروض اليوم والخصومات',
                dealsSectionSubtitle: content.dealsSectionSubtitle || restaurant.content?.dealsSectionSubtitle || 'وجبات فاخرة بأسعار مخفضة لفترة محدودة',
                topSellersTitle: content.topSellersTitle || restaurant.content?.topSellersTitle || '🏆 أفضل 10 أصناف الأكثر طلباً ومبيعاً',
                topSellersSubtitle: content.topSellersSubtitle || restaurant.content?.topSellersSubtitle || 'تشكيلة الوجبات الذهبية التي حازت على أعجاب وإقبال عملائنا في مطبخ أبو قورة',
                menuPageTitle: content.menuPageTitle || restaurant.content?.menuPageTitle || 'قائمة الطعام الكاملة 📜',
                menuPageSubtitle: content.menuPageSubtitle || restaurant.content?.menuPageSubtitle || 'تصفح أشهى المشويات والطواجن والمخبوزات الفلاحية المجهزة طازجة يومياً',
                announcementText: content.announcementText || restaurant.content?.announcementText || '',
                showAnnouncement: content.showAnnouncement !== undefined ? content.showAnnouncement : (restaurant.content?.showAnnouncement || false),
                footerText: content.footerText || restaurant.content?.footerText || 'جميع الحقوق محفوظة © 2026 مطبخ أبو قورة - طعم بلدي أصيل'
            };
        }

        const updatedRestaurant = await restaurant.save();

        const statusCheck = checkIsOpenNow(updatedRestaurant.toObject());

        const responseSettings = {
            ...updatedRestaurant.toObject(),
            isOpenNow: statusCheck.isOpenNow,
            closedReason: statusCheck.reason
        };

        const io = req.app.get('socketio');
        if (io) io.emit('settings-updated', responseSettings);

        res.json({
            success: true,
            message: '🎉 تم حفظ الإعدادات والتصميم بنجاح في قاعدة البيانات وبثها فورياً!',
            settings: responseSettings
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. تعديل عنصر بصري محدد بالنقر الأيمن (Hostinger-Style Visual Element Live Update Endpoint)
exports.updateElementOverride = async (req, res) => {
    try {
        const { elementId, text, color, bgColor, fontSize, borderRadius, bgImage, isHidden } = req.body;

        if (!elementId) {
            return res.status(400).json({ success: false, message: 'معرف العنصر (elementId) مطلوب' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) {
            restaurant = new Restaurant({ slug: 'abu-qoura' });
        }

        if (!restaurant.elementOverrides) {
            restaurant.elementOverrides = new Map();
        }

        // الحصول على التعديل السابق أو إنشاء تعديل جديد
        const existingData = restaurant.elementOverrides.get(elementId) || {};
        
        const updatedData = {
            text: text !== undefined ? text : (existingData.text || ''),
            color: color !== undefined ? color : (existingData.color || ''),
            bgColor: bgColor !== undefined ? bgColor : (existingData.bgColor || ''),
            fontSize: fontSize !== undefined ? fontSize : (existingData.fontSize || ''),
            borderRadius: borderRadius !== undefined ? borderRadius : (existingData.borderRadius || ''),
            bgImage: bgImage !== undefined ? bgImage : (existingData.bgImage || ''),
            isHidden: isHidden !== undefined ? isHidden : (existingData.isHidden || false)
        };

        restaurant.elementOverrides.set(elementId, updatedData);
        await restaurant.save();

        // البث المباشر الفوري عبر Socket.io لجميع الزوار المفتوح لديهم الموقع (0ms Sync)
        const io = req.app.get('socketio');
        if (io) {
            io.emit('visual-element-updated', {
                elementId,
                overrideData: updatedData
            });
        }

        res.json({
            success: true,
            message: `✅ تم تعديل العنصر [${elementId}] وحفظه في MongoDB Atlas والبث المباشر لجميع المستخدمين!`,
            elementId,
            overrideData: updatedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};