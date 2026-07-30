const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * الحصول على المفتاح السري بأمان بدون إسقاط التطبيق عند عدم توفره
 */
function getSecretKey() {
    const secret = process.env.QR_SECRET;
    if (!secret) {
        console.warn('⚠️ تنبيه: QR_SECRET غير معرف في متغيرات البيئة، يتم استخدام مفتاح افتراضي مؤقت.');
        return process.env.JWT_SECRET || 'default_fallback_qr_secret_key_abu_qoura_2026';
    }
    return secret;
}

/**
 * توليد توقيع رقمي (HMAC) فريد لكل طلب
 * يمنع التزوير أو التلاعب بكود الـ QR للطلب
 */
function generateOrderSignature(orderNumber, totalPrice, orderId) {
    const secret = getSecretKey();
    
    // توحيد تنسيق القيم لمنع اختلاف التوقيع بسبب الفواصل العشرية
    const safeOrderId = String(orderId || '');
    const safeOrderNum = String(orderNumber || '');
    const safePrice = Number(totalPrice || 0).toFixed(2);

    const payload = `${safeOrderId}|${safeOrderNum}|${safePrice}`;

    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')
        .substring(0, 32); // استخدام 32 حرفاً لزيادة الأمان والسرعة
}

/**
 * التحقق الآمن من التوقيع الرقمي لمنع هجمات التوقيت (Timing Attacks)
 */
function verifyOrderSignature(orderNumber, totalPrice, orderId, signatureToVerify) {
    if (!signatureToVerify) return false;
    
    const expectedSignature = generateOrderSignature(orderNumber, totalPrice, orderId);
    
    try {
        const bufA = Buffer.from(signatureToVerify, 'utf8');
        const bufB = Buffer.from(expectedSignature, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (err) {
        return false;
    }
}

/**
 * توليد صورة QR حقيقية (Base64 PNG) + رابط تحقق فعلي
 * @param {Object} order - كائن الطلب بعد الحفظ في MongoDB
 * @param {String} baseUrl - رابط السيرفر الأساسي
 */
async function generateOrderQR(order, baseUrl = 'http://localhost:5000') {
    try {
        if (!order || (!order._id && !order.orderNumber)) {
            throw new Error('بيانات الطلب غير مكتملة لتوليد كود الـ QR');
        }

        const orderIdStr = String(order._id || order.orderNumber);
        const signature = generateOrderSignature(order.orderNumber, order.totalPrice, orderIdStr);

        // إزالة أي شرطة مائلة زائدة (Trailing Slash) من رابط الموقع
        const cleanBaseUrl = String(baseUrl).replace(/\/+$/, '');
        const verifyUrl = `${cleanBaseUrl}/invoice/${orderIdStr}?sig=${signature}`;

        // ⚡ تحسين الأداء: تقليل الحجم إلى 280px ومستوى الموازنة M لتقليل حجم الاستجابة وتسريع جلب البيانات
        const qrImageBase64 = await QRCode.toDataURL(verifyUrl, {
            errorCorrectionLevel: 'M', 
            type: 'image/png',
            margin: 1,
            width: 280,
            color: {
                dark: '#1a1a1a',
                light: '#ffffff'
            }
        });

        return { verifyUrl, signature, qrImageBase64 };
    } catch (error) {
        console.error('❌ خطأ أثناء توليد كود الـ QR:', error.message);
        return {
            verifyUrl: `${baseUrl}/invoice/${order?._id || ''}`,
            signature: '',
            qrImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        };
    }
}

module.exports = {
    generateOrderSignature,
    verifyOrderSignature,
    generateOrderQR
};