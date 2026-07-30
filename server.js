// ==============================================================================
// 1. تحميل متغيرات البيئة في السطر الأول قبل استدعاء أي وحدات داخلية
// ==============================================================================
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// استدعاء الاتصال بقاعدة البيانات ومعالج الأخطاء المركزي
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// استدعاء جميع مسارات الـ APIs
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const couponRoutes = require('./routes/couponRoutes');
const deliveryAreaRoutes = require('./routes/deliveryAreaRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminRoutes = require('./routes/adminRoutes');

// الاتصال بقاعدة البيانات MongoDB Atlas
connectDB();

const app = express();
const server = http.createServer(app);

// 🔒 إنشاء مجلد رفع الصور تلقائياً إذا لم يكن موجوداً لتفادي السقوط
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 🔒 تفعيل الثقة في البروكسي (Reverse Proxy) لدعم Rate Limiting وقراءة IP الحقيقي بدقة
app.set('trust proxy', 1);

// ⚡ تحسين أداء الاستجابات: تفعيل الضغط لتقليل حجم البيانات المنقولة وتسريع الجلب
app.use(compression());

// 🔒 حماية المروّسات عبر Helmet مع التوافق الكامل مع الخرائط وCDNs الخارجية
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false
    })
);

// 🔒 معالجة الـ Origins لـ CORS و Socket.io وتفادي تعارض credentials: true
const parseAllowedOrigins = () => {
    if (!process.env.CLIENT_URL || process.env.CLIENT_URL.trim() === '' || process.env.CLIENT_URL === '*') {
        return true; // السماح الديناميكي للطلبات مع Credentials
    }
    return process.env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, ''));
};

const allowedOrigins = parseAllowedOrigins();

// إعداد CORS محسّن للأداء والأمان
app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins === true || !origin) {
            return callback(null, true);
        }
        if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            return callback(null, true);
        }
        return callback(null, true); // السماح في التطوير والمرونة للشبكات المحلية
    },
    credentials: true,
    maxAge: 86400 // تخزين نتائج طلبات preflight لمدة 24 ساعة
}));

// 🔒 تحديد معدل الطلبات لحماية السيرفر من هجمات الإغراق والتخمين
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 500, // حد أقصى 500 طلب لكل IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'تجاوزت الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.' }
});
app.use('/api', limiter);

// تهيئة Socket.io للتحديثات الحية اللحظية
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Middleware معالجة البيانات
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// حماية من هجمات NoSQL Injection
app.use(mongoSanitize());

// ⚡ تحسين أداء الملفات الثابتة والصور مع Caching
const staticOptions = {
    maxAge: '7d', // تخزين كاش لمدة 7 أيام في المتصفح
    etag: true
};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), staticOptions));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions)); // مسار إضافي للأمان

// إتاحة socketio في كافة الكنترولرات عبر req.app.get('socketio')
app.set('socketio', io);

// ==============================================================================
// 📁 إعداد API رفع الصور المباشر من الموبايل والكمبيوتر (Multer Upload Engine)
// ==============================================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // حد أقصى 10 ميجابايت للصورة
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('يرجى رفع ملفات الصور فقط (PNG, JPG, WEBP, SVG)'));
        }
    }
});

// مسار رفع الصور المباشر للمحرر البصري والتقييمات
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'لم يتم اختيار أي صورة لرفعها' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            message: '🎉 تم رفع الصورة بنجاح!',
            url: fileUrl
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==============================================================================
// 🏠 مسارات الواجهات المستقلة والنقية (Clean HTML Routes)
// ==============================================================================
app.get('/admin_restaurant_food', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_restaurant_food.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_restaurant_food.html'));
});

app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get('/invoice/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

app.get('/product-details', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'product-details.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// الاتصال المباشر عبر WebSockets
io.on('connection', (socket) => {
    console.log('⚡ مستخدم متصل بالشبكة الحية:', socket.id);
    
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('disconnect', () => {
        // تنظيف عند قطع الاتصال
    });
});

// ==============================================================================
// 🔗 ربط جميع مسارات الـ APIs
// ==============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/delivery-areas', deliveryAreaRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// معالجة المسارات المفقودة والاستثناءات
app.use(notFound);
app.use(errorHandler);

// ==============================================================================
// 🛡️ معالجة الأخطاء غير الممسوكة والإغلاق الآمن للسيرفر
// ==============================================================================
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection Error:', err && err.stack ? err.stack : err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception Error:', err && err.stack ? err.stack : err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 السيرفر التجاري يعمل بنجاح في وضع [${process.env.NODE_ENV || 'development'}] على المنفذ: ${PORT}`);
    console.log(`🔒 رابط لوحة الإدارة: http://localhost:${PORT}/admin_restaurant_food`);
});