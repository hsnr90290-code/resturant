const multer = require('multer');
const path = require('path');
const fs = require('fs');

// التأكد من وجود مجلد التحميلات أوتوماتيكياً وإنشائه إذا لم يكن موجوداً
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد مسار وتسمية الملفات المرفوعة
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // توليد اسم فريد بالكامل للملف يشتمل على التاريخ والتوقيت والامتداد
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

// فلتر تنقية أنواع الامتدادات المسموح بها (الصور فقط)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (extName && mimeType) {
        cb(null, true);
    } else {
        cb(new Error('🚫 عفواً! يرجى رفع ملفات صور فقط بخلال الامتدادات: (JPG, PNG, WEBP, GIF)'));
    }
};

// تهيئة Multer بحجم أقصى 5 ميجابايت للصورة الواحدة
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: fileFilter
});

module.exports = {
    uploadSingle: upload.single('image'),
    uploadMultiple: upload.array('images', 5) // رفع ما يصل إلى 5 صور كحد أقصى للوجبة
};