const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * توليد توقيع أمان للتأكد من صحة رابط الفاتورة الرقمية
 */
function generateInvoiceSignature(orderId, orderNumber) {
    const secret = process.env.QR_SECRET || process.env.JWT_SECRET || 'fallback_qr_secret_2026';
    return crypto
        .createHmac('sha256', secret)
        .update(`${orderId || ''}|${orderNumber || ''}`)
        .digest('hex')
        .substring(0, 24);
}

/**
 * محرك توليد كود الـ QR المالي والربط بالفاتورة الرقمية أوفلاين وأونلاين
 * Generates Real Scannable Base64 QR Code Linking to Digital Web Invoice
 * 
 * @param {Object} order - كائن الطلب
 * @param {String} baseUrl - رابط السيرفر الأساسي
 */
async function generateOrderQR(order, baseUrl) {
    try {
        if (!order) {
            throw new Error('كائن الطلب مفقود (Order Object Null or Undefined)');
        }

        // تحديد رابط الموقع الأساسي ديناميكياً من بيئة التشغيل إذا لم يُمرر
        const hostUrl = baseUrl || process.env.BASE_URL || process.env.CLIENT_URL || 'http://localhost:5000';
        const cleanBaseUrl = String(hostUrl).replace(/\/+$/, '');

        // معرف الطلب ورقم الطلب
        const orderIdStr = String(order._id || order.id || order.orderNumber || '');
        const orderNum = order.orderNumber || orderIdStr;

        if (!orderIdStr) {
            throw new Error('تعذر إيجاد _id أو orderNumber داخل كائن الطلب');
        }

        // توليد التوقيع الرقمي لمنع التلاعب بروابط الفواتير
        const sig = generateInvoiceSignature(orderIdStr, orderNum);

        // رابط الفاتورة الرقمية المباشر والآمن
        const invoiceUrl = `${cleanBaseUrl}/invoice/${orderIdStr}?sig=${sig}`;

        // ⚡ تحسين الأداء: تقليل الحجم لـ 280px ومستوى ضغط M لتشغيل خفيف وسريع في جلب البيانات
        const qrImageBase64 = await QRCode.toDataURL(invoiceUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 1,
            width: 280,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        return { invoiceUrl, qrImageBase64, signature: sig };
    } catch (error) {
        console.error('❌ خطأ في محرك الـ QR (QR Generation Error):', error.message);
        
        const fallbackUrl = (baseUrl || 'http://localhost:5000').replace(/\/+$/, '');
        return { 
            invoiceUrl: `${fallbackUrl}/invoice.html`, 
            qrImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            signature: ''
        };
    }
}

module.exports = { generateOrderQR, generateInvoiceSignature };