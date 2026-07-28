const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

// خيارات الكوكيز المعيارية المستمرة لمدة 30 يوماً متواصلة بجميع المسارات
const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 يوماً
};

const generateToken = (id, role, restaurantId) => {
    return jwt.sign({ id, role, restaurantId }, process.env.JWT_SECRET || 'ORA_SECRET_KEY_2026', {
        expiresIn: '30d'
    });
};

const logSecurityEvent = async (restaurantId, adminName, adminEmail, action, status, req, details = '') => {
    try {
        await AuditLog.create({
            restaurantId,
            adminName: adminName || 'مجهول',
            adminEmail: adminEmail || 'unknown@domain.com',
            action,
            status,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
            userAgent: req.headers['user-agent'] || '',
            details
        });
    } catch (e) {}
};

// 1. فحص وجود المالك الأصلي الأوحد (SuperAdmin) بـ MongoDB
// 1. فحص وجود المالك الأصلي بـ MongoDB
exports.checkSuperAdminExists = async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: { $in: ['superadmin', 'admin'] } }).lean();

        if (existingAdmin) {
            return res.json({ 
                exists: true, 
                message: 'المالك الأصلي مسجل بالنظام.' 
            });
        } else {
            return res.json({ 
                exists: false, 
                message: 'لا يوجد حساب سوبر أدمن مسجل.' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. إنشاء حساب المالك الأصلي (SuperAdmin)
exports.registerSuperAdmin = async (req, res) => {
    try {
        const { name, email, phone, password, adminSecretCode } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'جميع البيانات مطلوبة لإنشاء المالك الأصلي' });
        }

        const masterSecretKey = process.env.ADMIN_SECRET_KEY || 'ORA_SUPERADMIN_SECRET_2026';
        if (!adminSecretCode || adminSecretCode.trim() !== masterSecretKey) {
            await logSecurityEvent(null, name, email, 'INVALID_ADMIN_SECRET_KEY', 'FAILED', req, 'محاولة إنشاء أدمن بكود أمان سري خاطئ');
            return res.status(403).json({ 
                success: false, 
                message: '🚫 معذرة، لا يمكنك تسجيل الدخول كـ سوبر أدمن!' 
            });
        }

        const existingAdmin = await User.findOne({ role: { $in: ['superadmin', 'admin'] } }).lean();
        if (existingAdmin) {
            await logSecurityEvent(null, name, email, 'UNAUTHORIZED_SUPERADMIN_REGISTER_ATTEMPT', 'FAILED', req, 'محاولة تسلل لإنشاء أدمن آخر بعد وجود أدمن بالفعل');
            return res.status(400).json({ 
                success: false, 
                message: '🚫 معذرة، لا يمكنك الدخول بحساب سوبر أدمن!' 
            });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        const user = await User.create({
            restaurantId: restaurant._id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            password,
            role: 'superadmin'
        });

        const token = generateToken(user._id, user.role, user.restaurantId);
        res.cookie('jwt', token, COOKIE_OPTIONS);

        await logSecurityEvent(restaurant._id, user.name, user.email, 'REGISTER_SUPERADMIN', 'SUCCESS', req, 'تم إنشاء وتثبيت المالك الأصلي بنجاح');

        res.status(201).json({
            success: true,
            message: '🎉 تم إنشاء وتأمين حساب المالك الأصلي بنجاح!',
            user: { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
            token
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. استرجاع الجلسة الحية وقراءة الرتبة الفعلية من قاعدة البيانات أولاً
// 3. استرجاع الجلسة الحية وقراءة الرتبة الفعلية المحدثة فوراً من قاعدة البيانات
exports.getMe = async (req, res) => {
    try {
        let token = null;

        // ⚡ إعطاء الأولوية للتوكن الممرر في الهيدر لضمان المزامنة الفورية عند ترقية الموظف
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            return res.status(200).json({ success: false, user: null, message: 'زائر غير مسجل' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ORA_SECRET_KEY_2026');
        
        // ⚡ الجلب الفعلي المباشر المحدث من قاعدة البيانات لضمان الرتبة الحالية للموظف المُرقى
        const user = await User.findById(decoded.id).select('-password').lean();

        if (!user || user.isBanned) {
            return res.status(200).json({ success: false, user: null, message: 'الجلسة انتهت أو الحساب محظور' });
        }

        // تجديد وإعادة إصدار الكوكي بالرتبة المحدثة الفعلية للمستخدم (staff أو superadmin)
        const refreshedToken = generateToken(user._id, user.role, user.restaurantId);
        res.cookie('jwt', refreshedToken, COOKIE_OPTIONS);

        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                restaurantId: user.restaurantId
            },
            token: refreshedToken
        });
    } catch (error) {
        res.status(200).json({ success: false, user: null, message: 'جلسة غير صالحة' });
    }
};

// 4. تسجيل دخول الأدمن والموظفين (SuperAdmin / Staff)
exports.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'يرجى كتابة البريد الإلكتروني وكلمة المرور' 
            });
        }

        const formattedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: formattedEmail });

        // منع العملاء العاديين من تسجيل الدخول عبر شاشة الأدمن
        if (!user || user.role === 'customer') {
            return res.status(403).json({ 
                success: false, 
                message: '🚫 معذرة، هذا الحساب ليس لديه صلاحية دخول لوحة التحكم!' 
            });
        }

        if (user.isBanned) {
            return res.status(403).json({ 
                success: false, 
                message: '🚫 معذرة، تم حظر هذا الحساب بقرار من الإدارة!' 
            });
        }

        const isMatch = await user.matchPassword(password);
        if (isMatch) {
            user.lastLoginIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
            user.lastLoginAt = new Date();
            await user.save();

            const token = generateToken(user._id, user.role, user.restaurantId);
            res.cookie('jwt', token, COOKIE_OPTIONS);

            res.json({
                success: true,
                message: `مرحباً بك مجدداً، ${user.name}!`,
                user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
                token
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: '❌ كلمة المرور غير صحيحة' 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. تسجيل حساب عميل عادي
exports.registerUser = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'جميع البيانات مطلوبة لإنشاء الحساب' });
        }

        const formattedEmail = email.trim().toLowerCase();
        const userExists = await User.findOne({ email: formattedEmail });
        if (userExists) {
            return res.status(400).json({ success: false, message: '❌ هذا البريد الإلكتروني مسجل بالفعل' });
        }

        let restaurant = await Restaurant.findOne({ slug: 'abu-qoura' });
        if (!restaurant) restaurant = await Restaurant.create({ name: 'مطبخ أبو قورة الفلاحي', slug: 'abu-qoura' });

        const user = await User.create({
            restaurantId: restaurant._id,
            name: name.trim(),
            email: formattedEmail,
            phone: phone.trim(),
            password,
            role: 'customer'
        });

        const token = generateToken(user._id, user.role, user.restaurantId);
        res.cookie('jwt', token, COOKIE_OPTIONS);

        res.status(201).json({
            success: true,
            message: '🎉 تم إنشاء وحفظ حسابك بنجاح!',
            user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
            token
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. تسجيل دخول المستخدمين
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
        }

        const formattedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: formattedEmail });

        if (!user) {
            return res.status(401).json({ success: false, message: '❌ البريد الإلكتروني غير مسجل بـ قاعدة البيانات' });
        }

        if (user.isBanned) {
            return res.status(403).json({ success: false, message: '❌ تم حظر حسابك بقرار من الإدارة.' });
        }

        const isMatch = await user.matchPassword(password);
        if (isMatch) {
            user.lastLoginIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
            user.lastLoginAt = new Date();
            await user.save();

            const token = generateToken(user._id, user.role, user.restaurantId);
            res.cookie('jwt', token, COOKIE_OPTIONS);

            const isStaffOrAdmin = user.role === 'superadmin' || user.role === 'staff' || user.role === 'admin';

            res.json({
                success: true,
                message: isStaffOrAdmin 
                    ? `🎉 أهلاً بك يا ${user.name}! تم الكشف عن رتبتك الإدارية [${user.role}] وسيتوفر لك زر لوحة التحكم الآن.`
                    : `🎉 مرحباً بك مجدداً، ${user.name}!`,
                user: { 
                    _id: user._id, 
                    name: user.name, 
                    email: user.email, 
                    phone: user.phone, 
                    role: user.role,
                    restaurantId: user.restaurantId 
                },
                token
            });
        } else {
            res.status(401).json({ success: false, message: '❌ كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. ترقية مستخدم لموظف (Staff) أو إلغاؤها + بث مباشر لحظي
exports.promoteToStaff = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findById(userId);

        if (!targetUser) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (targetUser.role === 'superadmin' || targetUser.role === 'admin') return res.status(400).json({ success: false, message: 'لا يمكن تعديل المالك الأصلي!' });

        targetUser.role = targetUser.role === 'staff' ? 'customer' : 'staff';
        await targetUser.save();

        const newToken = generateToken(targetUser._id, targetUser.role, targetUser.restaurantId);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('user-account-status-changed', {
                userId: targetUser._id.toString(),
                action: 'role_updated',
                role: targetUser.role,
                token: newToken,
                message: targetUser.role === 'staff' 
                    ? '🎉 تهانينا! تم ترقية حسابك إلى موظف مُرقى (Staff) وتم تفعيل إمكانية دخول لوحة التحكم بحسابك.' 
                    : 'ℹ️ تم تنزيل حسابك إلى عميل عادي وإلغاء صلاحية لوحة التحكم.'
            });
        }

        res.json({
            success: true,
            message: targetUser.role === 'staff' 
                ? `🎉 تم ترقية [${targetUser.name}] إلى موظف مُرقى (Staff) بنجاح واظهار لوحة التحكم لديه!` 
                : `✅ تم تنزيل [${targetUser.name}] إلى عميل زائر وإلغاء كافة صلاحيات الإدارة عنه فوراً!`,
            user: targetUser
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 8. حظر أو إلغاء حظر حساب
exports.banUserToggle = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findById(userId);

        if (!targetUser) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (targetUser.role === 'superadmin' || targetUser.role === 'admin') return res.status(400).json({ success: false, message: '❌ لا يمكنك حظر المالك الأصلي!' });

        targetUser.isBanned = !targetUser.isBanned;
        await targetUser.save();

        const io = req.app.get('socketio');
        if (io) {
            io.emit('user-account-status-changed', {
                userId: targetUser._id.toString(),
                action: targetUser.isBanned ? 'banned' : 'unbanned',
                isBanned: targetUser.isBanned,
                message: targetUser.isBanned 
                    ? '🚫 تم حظر حسابك من قبل السوبر أدمن! سيتم تسجيل خروجك فوراً.' 
                    : '✅ تم إلغاء الحظر عن حسابك.'
            });
        }

        await logSecurityEvent(targetUser.restaurantId, req.user ? req.user.name : 'SuperAdmin', req.user ? req.user.email : '', 'BAN_USER_TOGGLE', 'SUCCESS', req, `حالة الحظر لـ [${targetUser.name}]: ${targetUser.isBanned}`);

        res.json({
            success: true,
            message: targetUser.isBanned ? `❌ تم حظر حساب [${targetUser.name}] وطرد جلسته بنجاح` : `✅ تم إلغاء حظر حساب [${targetUser.name}] بنجاح`,
            isBanned: targetUser.isBanned
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 9. حذف حساب مستخدم
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findById(userId);

        if (!targetUser) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        if (targetUser.role === 'superadmin' || targetUser.role === 'admin') {
            return res.status(400).json({ success: false, message: '❌ لا يمكنك حذف حساب المالك الأصلي!' });
        }

        await User.findByIdAndDelete(userId);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('user-account-status-changed', {
                userId: userId.toString(),
                action: 'deleted',
                message: '🗑️ تم حذف حسابك نهائياً من قبل السوبر أدمن.'
            });
        }

        await logSecurityEvent(null, req.user ? req.user.name : 'SuperAdmin', req.user ? req.user.email : '', 'DELETE_USER', 'SUCCESS', req, `حذف حساب [${targetUser.name}]`);

        res.json({
            success: true,
            message: `✅ تم حذف حساب [${targetUser.name}] نهائياً من قاعدة البيانات!`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 10. جلب كافة الحسابات
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 11. تسجيل الخروج
exports.logoutUser = (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0), path: '/' });
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
};