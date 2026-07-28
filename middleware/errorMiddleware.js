/**
 * معالج مسارات الـ APIs غير الموجودة (404 Not Found)
 */
const notFound = (req, res, next) => {
    const error = new Error(`🔍 المسار المطلوب غير موجود: [${req.originalUrl}]`);
    res.status(404);
    next(error);
};

/**
 * معالج الأخطاء المركزي للنظام وبث الاستجابة بدقة
 * Enterprise Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || 'حدث خطأ داخلي في السيرفر';

    // 1. معالجة خطأ MongoDB في حالة كتابة ID غير صحيح (CastError)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        message = 'عنصر غير موجود بقاعدة البيانات (معرف ID غير صالح)';
    }

    // 2. معالجة خطأ تكرار البيانات الميدانية الفريدة مثل البريد أو الكوبون (Duplicate Key Code 11000)
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `هذه البيانات مسجلة مسبقاً في قاعدة البيانات: [${field}]`;
    }

    // 3. معالجة أخطاء التحقق من المدخلات والإلزام بالـ Schema (ValidationError)
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(' - ');
    }

    // 4. معالجة أخطاء الـ JWT التوكين
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'رمز الحماية والتشفير غير صالح';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'انتهت صلاحية جلسة الدخول. يرجى إعادة تسجيل الدخول';
    }

    res.status(statusCode).json({
        success: false,
        message: message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = { notFound, errorHandler };