// =========================================================
// كود لوحة تحكم الإدارة والتأمين بـ 100% بـ MongoDB Atlas و Socket.io
// Enterprise Admin JS: Real-time User Promotion, Visual Live Editor, POS Thermal Receipts
// =========================================================

const socket = io();
const currentRestaurantId = "65d0a1b2c3d4e5f6a7b8c9d0";

let currentAdminUser = null;
let allOrdersList = [];
let allDishesList = [];
let allCategoriesList = [];
let allCouponsList = [];
let allDeliveryAreasList = [];

// دالة مساعدة لتشفيـر النصوص وحماية الجدول من الثغرات البرمجية (XSS Protection)
function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// دالة تحويل وتحليل نصوص الأحجام والإضافات بأمان لمنع أخطاء NaN بـ MongoDB
function parseOptionsString(inputStr) {
    const result = [];
    if (!inputStr || typeof inputStr !== 'string' || !inputStr.trim()) return result;

    inputStr.split(',').forEach(item => {
        const parts = item.split(':');
        if (parts.length === 2) {
            const name = parts[0].trim();
            const price = Number(parts[1].trim());
            if (name && !isNaN(price)) {
                result.push({ name, price });
            }
        }
    });
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    initAdminSessionCheck();
    listenToSocketEvents();
});

// 1. فحص الجلسة والمالك الأصلي بـ MongoDB Atlas
async function initAdminSessionCheck() {
    const authSection = document.getElementById('adminAuthSection');
    const mainPortal = document.getElementById('adminMainPortal');
    const loginForm = document.getElementById('adminLoginForm');
    const registerForm = document.getElementById('superAdminRegisterForm');
    const subtitle = document.getElementById('authSubtitle');

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const meRes = await fetch('/api/auth/me', { headers, credentials: 'include' });
        const meData = await meRes.json();

        if (meData.success && meData.user) {
            if (meData.user.role === 'superadmin' || meData.user.role === 'staff' || meData.user.role === 'admin') {
                currentAdminUser = meData.user;
                showMainPortal();
                return;
            } else if (meData.user.role === 'customer') {
                alert('🚫 معذرة، حسابك الحالي مسجل كـ عميل وليس لديه صلاحية دخول لوحة التحكم!');
                window.location.href = '/index.html';
                return;
            }
        }

        const checkRes = await fetch('/api/auth/check-superadmin');
        const checkData = await checkRes.json();

        if (authSection) authSection.classList.remove('d-none');
        if (mainPortal) mainPortal.classList.add('d-none');

        if (checkData.exists) {
            if (registerForm) registerForm.classList.add('d-none');
            if (loginForm) loginForm.classList.remove('d-none');
            if (subtitle) subtitle.innerText = 'أدخل البريد الإلكتروني وكلمة المرور للدخول إلى لوحة التحكم.';
        } else {
            if (loginForm) loginForm.classList.add('d-none');
            if (registerForm) registerForm.classList.remove('d-none');
            if (subtitle) subtitle.innerText = 'لا يوجد مالك مسجل. يرجى إنشاء حساب المالك الأصلي وإدخال كود الأمان السري للنظام.';
        }
    } catch (e) {
        console.error('Session check error:', e);
        if (authSection) authSection.classList.remove('d-none');
        if (loginForm) loginForm.classList.remove('d-none');
    }
}

// إنشاء حساب السوبر أدمن
async function submitSuperAdminRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regAdminName').value.trim();
    const email = document.getElementById('regAdminEmail').value.trim();
    const phone = document.getElementById('regAdminPhone').value.trim();
    const password = document.getElementById('regAdminPassword').value;
    const adminSecretCode = document.getElementById('regAdminSecretCode') ? document.getElementById('regAdminSecretCode').value.trim() : '';

    try {
        const res = await fetch('/api/auth/register-superadmin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password, adminSecretCode })
        });
        const data = await res.json();

        if (data.success) {
            alert('🎉 تم إنشاء وتأمين حساب المالك الأصلي بنجاح!');
            if (data.token) localStorage.setItem('ora_user_token', data.token);
            currentAdminUser = data.user;
            showMainPortal();
        } else {
            alert(data.message || '🚫 معذرة، لا يمكنك تسجيل الدخول كـ سوبر أدمن!');
            window.location.href = '/index.html';
        }
    } catch (err) {
        alert('🚫 معذرة، لا يمكنك تسجيل الدخول كـ سوبر أدمن!');
        window.location.href = '/index.html';
    }
}

// تسجيل دخول الإدارة
async function submitAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginAdminEmail').value.trim();
    const password = document.getElementById('loginAdminPassword').value;

    try {
        const res = await fetch('/api/auth/login-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success && data.user && (data.user.role === 'superadmin' || data.user.role === 'staff')) {
            if (data.token) localStorage.setItem('ora_user_token', data.token);
            currentAdminUser = data.user;
            showMainPortal();
        } else {
            alert(data.message || '🚫 معذرة، لا يمكنك تسجيل الدخول كـ سوبر أدمن!');
            window.location.href = '/index.html';
        }
    } catch (err) {
        alert('🚫 معذرة، لا يمكنك تسجيل الدخول كـ سوبر أدمن!');
        window.location.href = '/index.html';
    }
}

function showMainPortal() {
    document.getElementById('adminAuthSection').classList.add('d-none');
    document.getElementById('adminMainPortal').classList.remove('d-none');

    const roleBadge = document.getElementById('currentAdminRoleBadge');
    const superAdminElements = document.querySelectorAll('.superadmin-only-ui');

    if (currentAdminUser && currentAdminUser.role === 'staff') {
        if (roleBadge) roleBadge.innerText = 'موظف مُرقى (Staff)';
        superAdminElements.forEach(el => el.classList.add('d-none'));
    } else {
        if (roleBadge) roleBadge.innerText = 'المالك الأصلي (SuperAdmin)';
        superAdminElements.forEach(el => el.classList.remove('d-none'));
        loadAllUsersAdmin();
        fetchCouponsFromDB();
        fetchDeliveryAreasFromDB();
    }

    loadAdminDashboard();
    fetchDishesFromDB();
    fetchCategoriesFromDB();
    fetchReviewsFromDB();
    loadSettingsFromDB();
}

async function logoutAdminSession() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('ora_user_session');
    localStorage.removeItem('ora_user_token');
    currentAdminUser = null;
    initAdminSessionCheck();
}

function listenToSocketEvents() {
    socket.on(`new-order-${currentRestaurantId}`, (order) => {
        playOrderSound();
        alert(`🚨 وصل طلب جديد برقم: ${order.orderNumber}`);
        loadAdminDashboard();
    });

    socket.on('notification-sound-alert', () => playOrderSound());
    socket.on('products-updated', () => fetchDishesFromDB());
    socket.on('categories-updated', () => { fetchCategoriesFromDB(); populateCategorySelectDropdown(); });
    socket.on('settings-updated', () => loadSettingsFromDB());
}

function playOrderSound() {
    const sound = document.getElementById('orderNotificationSound');
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => {});
    }
}

function switchAdminTab(tabId, btnElement) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('d-none'));
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('d-none');
    if (btnElement) btnElement.classList.add('active');
}

// ================= 2. قراءة وحفظ الإعدادات =================

async function loadSettingsFromDB() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const s = data.settings || {};

        if (document.getElementById('settingsWhatsappInput')) document.getElementById('settingsWhatsappInput').value = s.whatsappPhone || '01120751467';
        if (document.getElementById('settingsPhoneInput')) document.getElementById('settingsPhoneInput').value = s.phone || '01120751467';
        if (document.getElementById('settingsOpeningTime')) document.getElementById('settingsOpeningTime').value = s.openingTime || '10:00';
        if (document.getElementById('settingsClosingTime')) document.getElementById('settingsClosingTime').value = s.closingTime || '23:59';
        if (document.getElementById('settingsAutoCloseToggle')) document.getElementById('settingsAutoCloseToggle').checked = s.autoCloseOutsideWorkingHours !== false;
        if (document.getElementById('settingsAcceptingOrdersToggle')) document.getElementById('settingsAcceptingOrdersToggle').checked = s.isAcceptingOrders !== false;

        if (s.theme) {
            if (document.getElementById('themePrimaryColor')) document.getElementById('themePrimaryColor').value = s.theme.primaryColor || '#a82810';
            if (document.getElementById('themePrimaryHover')) document.getElementById('themePrimaryHover').value = s.theme.primaryHover || '#8e1f0b';
            if (document.getElementById('themeSecondaryColor')) document.getElementById('themeSecondaryColor').value = s.theme.secondaryColor || '#5a4b10';
            if (document.getElementById('themeGoldLight')) document.getElementById('themeGoldLight').value = s.theme.goldLight || '#f7f3e8';
            if (document.getElementById('themeDarkColor')) document.getElementById('themeDarkColor').value = s.theme.darkColor || '#1a1816';
            if (document.getElementById('themeBgColor')) document.getElementById('themeBgColor').value = s.theme.bgColor || '#fbf9f5';
            if (document.getElementById('themeCardBgColor')) document.getElementById('themeCardBgColor').value = s.theme.cardBgColor || '#ffffff';
            if (document.getElementById('themeTextColor')) document.getElementById('themeTextColor').value = s.theme.textColor || '#1a1816';
            if (document.getElementById('themeFontFamily')) document.getElementById('themeFontFamily').value = s.theme.fontFamily || 'Tajawal';
            if (document.getElementById('themeBorderRadius')) document.getElementById('themeBorderRadius').value = s.theme.borderRadius || '20px';
            if (document.getElementById('themeCustomCss')) document.getElementById('themeCustomCss').value = s.theme.customCss || '';
        }

        if (s.content) {
            if (document.getElementById('contentBrandName')) document.getElementById('contentBrandName').value = s.content.brandName || 'أبو قورة ✨';
            if (document.getElementById('contentBrandTagline')) document.getElementById('contentBrandTagline').value = s.content.brandTagline || 'مطبخ المشويات والبلدي الأصيل';
            if (document.getElementById('contentHeroTitle')) document.getElementById('contentHeroTitle').value = s.content.heroTitle || 'أورا';
            if (document.getElementById('contentHeroSubtitle')) document.getElementById('contentHeroSubtitle').value = s.content.heroSubtitle || 'طعم أصيل من قلب مصر';
            if (document.getElementById('contentHeroBtn1Text')) document.getElementById('contentHeroBtn1Text').value = s.content.heroBtn1Text || 'اطلب الآن 🍱';
            if (document.getElementById('contentHeroBtn2Text')) document.getElementById('contentHeroBtn2Text').value = s.content.heroBtn2Text || '🔥 عروض اليوم';
            if (document.getElementById('contentHeroBgImage')) document.getElementById('contentHeroBgImage').value = s.content.heroBgImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600';
            if (document.getElementById('contentDealsSectionTitle')) document.getElementById('contentDealsSectionTitle').value = s.content.dealsSectionTitle || '🔥 أقوى عروض اليوم والخصومات';
            if (document.getElementById('contentDealsSectionSubtitle')) document.getElementById('contentDealsSectionSubtitle').value = s.content.dealsSectionSubtitle || 'وجبات فاخرة بأسعار مخفضة لفترة محدودة';
            if (document.getElementById('contentTopSellersTitle')) document.getElementById('contentTopSellersTitle').value = s.content.topSellersTitle || '🏆 أفضل 10 أصناف الأكثر طلباً ومبيعاً';
            if (document.getElementById('contentTopSellersSubtitle')) document.getElementById('contentTopSellersSubtitle').value = s.content.topSellersSubtitle || 'تشكيلة الوجبات الذهبية التي حازت على أعجاب وإقبال عملائنا في مطبخ أبو قورة';
            if (document.getElementById('contentAnnouncementText')) document.getElementById('contentAnnouncementText').value = s.content.announcementText || '';
            if (document.getElementById('contentShowAnnouncement')) document.getElementById('contentShowAnnouncement').checked = s.content.showAnnouncement === true;
            if (document.getElementById('contentFooterText')) document.getElementById('contentFooterText').value = s.content.footerText || 'جميع الحقوق محفوظة © 2026 مطبخ أبو قورة - طعم بلدي أصيل';
        }

        if (document.getElementById('adminHeaderBrandName') && s.content && s.content.brandName) {
            document.getElementById('adminHeaderBrandName').innerText = s.content.brandName;
        }

        updateLivePreviewStyles();
        updateLivePreviewTexts();

        const statusHelper = document.getElementById('settingsLiveStatusHelper');
        if (statusHelper) {
            const egyptTimeStr = new Date().toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
            if (s.isOpenNow) {
                statusHelper.className = 'alert alert-success mt-3 mb-0 fw-bold small shadow-sm';
                statusHelper.innerHTML = `🟢 المطبخ مفتوح ويستقبل الطلبات حالياً أونلاين بنجاح. (التوقيت الحالي بمصر: ${egyptTimeStr})`;
            } else {
                statusHelper.className = 'alert alert-danger mt-3 mb-0 fw-bold small shadow-sm';
                statusHelper.innerHTML = `🔴 المطبخ مغلق حالياً بقرار الإدارة أو لكون التوقيت الحالي بمصر (${egyptTimeStr}) خارج النطاق المحدد [${s.openingTime} - ${s.closingTime}].`;
            }
        }
    } catch (e) {}
}

function updateLivePreviewStyles() {
    const primary = document.getElementById('themePrimaryColor') ? document.getElementById('themePrimaryColor').value : '#a82810';
    const primaryHover = document.getElementById('themePrimaryHover') ? document.getElementById('themePrimaryHover').value : '#8e1f0b';
    const secondary = document.getElementById('themeSecondaryColor') ? document.getElementById('themeSecondaryColor').value : '#5a4b10';
    const goldLight = document.getElementById('themeGoldLight') ? document.getElementById('themeGoldLight').value : '#f7f3e8';
    const dark = document.getElementById('themeDarkColor') ? document.getElementById('themeDarkColor').value : '#1a1816';
    const bg = document.getElementById('themeBgColor') ? document.getElementById('themeBgColor').value : '#fbf9f5';
    const cardBg = document.getElementById('themeCardBgColor') ? document.getElementById('themeCardBgColor').value : '#ffffff';
    const textCol = document.getElementById('themeTextColor') ? document.getElementById('themeTextColor').value : '#1a1816';
    const radius = document.getElementById('themeBorderRadius') ? document.getElementById('themeBorderRadius').value : '20px';
    const font = document.getElementById('themeFontFamily') ? document.getElementById('themeFontFamily').value : 'Tajawal';

    if (document.getElementById('themePrimaryColorHex')) document.getElementById('themePrimaryColorHex').innerText = primary;
    if (document.getElementById('themePrimaryHoverHex')) document.getElementById('themePrimaryHoverHex').innerText = primaryHover;
    if (document.getElementById('themeSecondaryColorHex')) document.getElementById('themeSecondaryColorHex').innerText = secondary;
    if (document.getElementById('themeGoldLightHex')) document.getElementById('themeGoldLightHex').innerText = goldLight;
    if (document.getElementById('themeDarkColorHex')) document.getElementById('themeDarkColorHex').innerText = dark;
    if (document.getElementById('themeBgColorHex')) document.getElementById('themeBgColorHex').innerText = bg;
    if (document.getElementById('themeCardBgColorHex')) document.getElementById('themeCardBgColorHex').innerText = cardBg;
    if (document.getElementById('themeTextColorHex')) document.getElementById('themeTextColorHex').innerText = textCol;

    const previewBox = document.getElementById('siteLivePreviewBox');
    if (previewBox) {
        previewBox.style.backgroundColor = bg;
        previewBox.style.borderColor = primary;
        previewBox.style.borderRadius = radius;
        previewBox.style.fontFamily = `'${font}', sans-serif`;
        previewBox.style.color = textCol;
    }

    const btn1 = document.getElementById('previewBtn1');
    if (btn1) {
        btn1.style.backgroundColor = primary;
        btn1.style.borderRadius = radius;
    }
    const btn2 = document.getElementById('previewBtn2');
    if (btn2) {
        btn2.style.borderRadius = radius;
    }
}

function updateLivePreviewTexts() {
    const brand = document.getElementById('contentBrandName') ? document.getElementById('contentBrandName').value : 'أبو قورة ✨';
    const title = document.getElementById('contentHeroTitle') ? document.getElementById('contentHeroTitle').value : 'أورا';
    const subtitle = document.getElementById('contentHeroSubtitle') ? document.getElementById('contentHeroSubtitle').value : 'طعم أصيل من قلب مصر';
    const btn1Text = document.getElementById('contentHeroBtn1Text') ? document.getElementById('contentHeroBtn1Text').value : 'اطلب الآن 🍱';
    const btn2Text = document.getElementById('contentHeroBtn2Text') ? document.getElementById('contentHeroBtn2Text').value : '🔥 عروض اليوم';

    if (document.getElementById('previewBrand')) document.getElementById('previewBrand').innerText = brand;
    if (document.getElementById('previewHeroTitle')) document.getElementById('previewHeroTitle').innerText = title;
    if (document.getElementById('previewHeroSubtitle')) document.getElementById('previewHeroSubtitle').innerText = subtitle;
    if (document.getElementById('previewBtn1')) document.getElementById('previewBtn1').innerText = btn1Text;
    if (document.getElementById('previewBtn2')) document.getElementById('previewBtn2').innerText = btn2Text;
}

async function saveFullSiteBuilderSettingsToDB() {
    const theme = {
        primaryColor: document.getElementById('themePrimaryColor') ? document.getElementById('themePrimaryColor').value : '#a82810',
        primaryHover: document.getElementById('themePrimaryHover') ? document.getElementById('themePrimaryHover').value : '#8e1f0b',
        secondaryColor: document.getElementById('themeSecondaryColor') ? document.getElementById('themeSecondaryColor').value : '#5a4b10',
        goldLight: document.getElementById('themeGoldLight') ? document.getElementById('themeGoldLight').value : '#f7f3e8',
        darkColor: document.getElementById('themeDarkColor') ? document.getElementById('themeDarkColor').value : '#1a1816',
        bgColor: document.getElementById('themeBgColor') ? document.getElementById('themeBgColor').value : '#fbf9f5',
        cardBgColor: document.getElementById('themeCardBgColor') ? document.getElementById('themeCardBgColor').value : '#ffffff',
        textColor: document.getElementById('themeTextColor') ? document.getElementById('themeTextColor').value : '#1a1816',
        borderRadius: document.getElementById('themeBorderRadius') ? document.getElementById('themeBorderRadius').value : '20px',
        fontFamily: document.getElementById('themeFontFamily') ? document.getElementById('themeFontFamily').value : 'Tajawal',
        customCss: document.getElementById('themeCustomCss') ? document.getElementById('themeCustomCss').value : ''
    };

    const content = {
        brandName: document.getElementById('contentBrandName') ? document.getElementById('contentBrandName').value.trim() : 'أبو قورة ✨',
        brandTagline: document.getElementById('contentBrandTagline') ? document.getElementById('contentBrandTagline').value.trim() : 'مطبخ المشويات والبلدي الأصيل',
        heroTitle: document.getElementById('contentHeroTitle') ? document.getElementById('contentHeroTitle').value.trim() : 'أورا',
        heroSubtitle: document.getElementById('contentHeroSubtitle') ? document.getElementById('contentHeroSubtitle').value.trim() : 'طعم أصيل من قلب مصر',
        heroBtn1Text: document.getElementById('contentHeroBtn1Text') ? document.getElementById('contentHeroBtn1Text').value.trim() : 'اطلب الآن 🍱',
        heroBtn2Text: document.getElementById('contentHeroBtn2Text') ? document.getElementById('contentHeroBtn2Text').value.trim() : '🔥 عروض اليوم',
        heroBgImage: document.getElementById('contentHeroBgImage') ? document.getElementById('contentHeroBgImage').value.trim() : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600',
        dealsSectionTitle: document.getElementById('contentDealsSectionTitle') ? document.getElementById('contentDealsSectionTitle').value.trim() : '🔥 أقوى عروض اليوم والخصومات',
        dealsSectionSubtitle: document.getElementById('contentDealsSectionSubtitle') ? document.getElementById('contentDealsSectionSubtitle').value.trim() : 'وجبات فاخرة بأسعار مخفضة لفترة محدودة',
        topSellersTitle: document.getElementById('contentTopSellersTitle') ? document.getElementById('contentTopSellersTitle').value.trim() : '🏆 أفضل 10 أصناف الأكثر طلباً ومبيعاً',
        topSellersSubtitle: document.getElementById('contentTopSellersSubtitle') ? document.getElementById('contentTopSellersSubtitle').value.trim() : 'تشكيلة الوجبات الذهبية التي حازت على أعجاب وإقبال عملائنا في مطبخ أبو قورة',
        announcementText: document.getElementById('contentAnnouncementText') ? document.getElementById('contentAnnouncementText').value.trim() : '',
        showAnnouncement: document.getElementById('contentShowAnnouncement') ? document.getElementById('contentShowAnnouncement').checked : false,
        footerText: document.getElementById('contentFooterText') ? document.getElementById('contentFooterText').value.trim() : 'جميع الحقوق محفوظة © 2026 مطبخ أبو قورة - طعم بلدي أصيل'
    };

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ theme, content })
        });
        const data = await res.json();
        if (data.success) {
            alert('🎉 تم حفظ مظهر، خطوط، نصوص، وبانرات الموقع بنجاح في قاعدة البيانات بـ MongoDB Atlas!');
            loadSettingsFromDB();
        } else {
            alert(data.message || 'فشل حفظ الإعدادات');
        }
    } catch (err) {
        alert('حدث خطأ أثناء حفظ تصميم ومحتوى الموقع بالسيرفر');
    }
}

async function saveFullRestaurantSettingsToDB() {
    const whatsappPhone = document.getElementById('settingsWhatsappInput') ? document.getElementById('settingsWhatsappInput').value.trim() : '';
    const phone = document.getElementById('settingsPhoneInput') ? document.getElementById('settingsPhoneInput').value.trim() : '';
    const openingTime = document.getElementById('settingsOpeningTime') ? document.getElementById('settingsOpeningTime').value : '10:00';
    const closingTime = document.getElementById('settingsClosingTime') ? document.getElementById('settingsClosingTime').value : '23:59';
    const autoCloseOutsideWorkingHours = document.getElementById('settingsAutoCloseToggle') ? document.getElementById('settingsAutoCloseToggle').checked : true;
    const isAcceptingOrders = document.getElementById('settingsAcceptingOrdersToggle') ? document.getElementById('settingsAcceptingOrdersToggle').checked : true;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ 
                whatsappPhone, 
                phone, 
                openingTime, 
                closingTime, 
                autoCloseOutsideWorkingHours,
                isAcceptingOrders
            })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم حفظ مواعيد وساعات عمل المطبخ وإعدادات الطلبات بنجاح في قاعدة البيانات MongoDB!');
            loadSettingsFromDB();
        } else {
            alert(data.message || 'فشل حفظ الإعدادات');
        }
    } catch (err) {
        alert('تعذر الاتصال بالسيرفر لحفظ الإعدادات');
    }
}

// ================= 3. إدارة الإحصائيات والطلبات =================

async function loadAdminDashboard() {
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/admin/stats/${currentRestaurantId}`, { headers });
        const data = await res.json();

        allOrdersList = data.recentOrders || [];
        const stats = data.stats || {};

        if (document.getElementById('statRevenue')) document.getElementById('statRevenue').innerText = `${stats.totalRevenue || 0} ج.م`;
        if (document.getElementById('statOrdersCount')) document.getElementById('statOrdersCount').innerText = stats.completedOrders || 0;
        if (document.getElementById('statPendingCount')) document.getElementById('statPendingCount').innerText = stats.newOrders || 0;
        if (document.getElementById('statPreparingCount')) document.getElementById('statPreparingCount').innerText = stats.activeOrdersNow || 0;

        renderAdminOrdersTable(allOrdersList);
    } catch (err) {
        renderAdminOrdersTable([]);
    }
}

// رسم جدول عرض الطلبات مع التشفير والحماية ضد ثغرات XSS
function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5"><p class="text-muted fw-bold fs-6">لا توجد طلبات مسجلة حالياً</p></td></tr>`;
        return;
    }

    const isSuperAdmin = currentAdminUser && currentAdminUser.role === 'superadmin';

    tbody.innerHTML = orders.map(o => {
        const realCustomerName = escapeHTML(o.customer && o.customer.name ? o.customer.name : 'عميل أورا');
        const custPhone = escapeHTML(o.customer ? o.customer.phone : '');
        const custWhatsapp = escapeHTML(o.customer ? (o.customer.whatsappPhone || o.customer.phone) : '');
        const custAddress = escapeHTML(o.customer ? o.customer.address : '-');
        const custNotes = escapeHTML(o.customer && o.customer.notes ? o.customer.notes.trim() : '');

        const itemsDetailHtml = (o.items || []).map(i => {
            let sizeText = i.selectedSize && i.selectedSize.name ? ` <span class="badge bg-secondary">(${escapeHTML(i.selectedSize.name)})</span>` : '';
            let addonsText = i.selectedAddons && i.selectedAddons.length ? `<br><small class="text-danger fw-bold">🧀 إضافات: ${i.selectedAddons.map(a => escapeHTML(a.name)).join(', ')}</small>` : '';
            return `<div class="mb-1 pb-1 border-bottom border-light"><strong>- ${escapeHTML(i.title)}</strong> (x${i.quantity || 1})${sizeText}${addonsText}</div>`;
        }).join('');

        let gpsButtonHtml = '';
        if (o.customer && o.customer.gpsLocation && o.customer.gpsLocation.mapUrl) {
            gpsButtonHtml = `<a href="${escapeHTML(o.customer.gpsLocation.mapUrl)}" target="_blank" class="btn btn-sm btn-outline-danger fw-bold mt-1 d-inline-block">📍 فتح الخريطة للديليفري</a>`;
        } else if (o.customer && o.customer.gpsLocation && o.customer.gpsLocation.lat) {
            const mapUrl = `https://maps.google.com/?q=${o.customer.gpsLocation.lat},${o.customer.gpsLocation.lng}`;
            gpsButtonHtml = `<a href="${mapUrl}" target="_blank" class="btn btn-sm btn-outline-danger fw-bold mt-1 d-inline-block">📍 فتح الخريطة للديليفري</a>`;
        }

        return `
            <tr id="order_row_${o._id}">
                <td><strong class="text-danger fs-6">${escapeHTML(o.orderNumber)}</strong><br><small class="text-muted">${new Date(o.createdAt || o.orderDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small></td>
                <td>
                    <strong>${realCustomerName}</strong><br>
                    <small class="text-muted">📞 ${custPhone}</small>
                    ${custWhatsapp ? `<br><small class="text-success fw-bold">💬 ${custWhatsapp}</small>` : ''}
                </td>
                <td>
                    <div style="max-width: 240px; font-size: 0.85rem;">
                        <strong>📍 العنوان:</strong> ${custAddress}<br>
                        ${gpsButtonHtml}
                        ${custNotes ? `<div class="mt-1 alert alert-warning p-1 mb-0 small">📝 <strong>ملاحظة:</strong> ${custNotes}</div>` : ''}
                    </div>
                </td>
                <td style="min-width: 220px;">
                    <div class="bg-light p-2 rounded border small" style="max-height: 140px; overflow-y: auto;">
                        ${itemsDetailHtml}
                    </div>
                </td>
                <td><strong class="fs-6 text-danger">${o.totalPrice} ج.م</strong></td>
                <td>
                    <select class="form-select form-select-sm fw-bold" onchange="updateOrderStatusOptimistic('${o._id}', this.value)">
                        <option value="New" ${o.status === 'New' ? 'selected' : ''}>جديد ⏳</option>
                        <option value="Reviewed" ${o.status === 'Reviewed' ? 'selected' : ''}>تمت المراجعة 📋</option>
                        <option value="Preparing" ${o.status === 'Preparing' ? 'selected' : ''}>جاري التحضير 🧑‍🍳</option>
                        <option value="Ready" ${o.status === 'Ready' ? 'selected' : ''}>جاهز بـ المطبخ 📦</option>
                        <option value="OutForDelivery" ${o.status === 'OutForDelivery' ? 'selected' : ''}>خرج للتوصيل 🛵</option>
                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>تم التسليم ✅</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>تم الإلغاء ❌</option>
                        <option value="Rejected" ${o.status === 'Rejected' ? 'selected' : ''}>مرفوض 🚫</option>
                    </select>
                </td>
                <td>
                    <div class="d-flex gap-1 flex-wrap">
                        <button class="btn btn-sm btn-success fw-bold" onclick='openCustomerWhatsapp(${JSON.stringify(o)})' title="مراسلة العميل بالواتساب">
                            💬 واتساب
                        </button>
                        <button class="btn btn-sm btn-outline-dark" onclick='printThermalReceipt(${JSON.stringify(o)})'>
                            🖨️ طباعة
                        </button>
                        ${isSuperAdmin ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteOrderFromDB('${o._id}')" title="حذف الطلب نهائياً">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// تحديث حالة الطلب مع التراجع التلقائي حالة الفشل (Rollback on Error)
async function updateOrderStatusOptimistic(orderId, newStatus) {
    const targetOrder = allOrdersList.find(o => o._id === orderId);
    if (!targetOrder) return;

    const previousStatus = targetOrder.status;
    targetOrder.status = newStatus;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!data.success) {
            alert('⚠️ تعذر تحديث الحالة بالسيرفر: ' + (data.message || 'خطأ غير معروف'));
            targetOrder.status = previousStatus;
            renderAdminOrdersTable(allOrdersList);
        }
    } catch (e) {
        alert('⚠️ حدث خطأ في الاتصال أثناء تحديث حالة الطلب');
        targetOrder.status = previousStatus;
        renderAdminOrdersTable(allOrdersList);
    }
}

function openCustomerWhatsapp(order) {
    if (!order || !order.customer) return;

    const phone = order.customer.whatsappPhone || order.customer.phone;
    if (!phone) {
        alert('لا يوجد رقم واتساب مسجل لهذا العميل');
        return;
    }

    const realCustomerName = order.customer.name || 'العميل';
    const itemsSummary = (order.items || []).map(i => `- ${i.title} x${i.quantity}`).join('\n');
    const msg = encodeURIComponent(
        `أهلاً بك أستاذ/ة ${realCustomerName} 🌸\n` +
        `بخصوص طلبك رقم [${order.orderNumber}] من مطبخ أبو قورة:\n` +
        `-------------------------\n` +
        `${itemsSummary}\n` +
        `-------------------------\n` +
        `المبلغ الإجمالي: ${order.totalPrice} ج.م\n` +
        `حالة الطلب الحالية: [${order.status}]\n` +
        `شكراً لتواصلك معنا!`
    );

    const formattedPhone = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
}

async function deleteOrderFromDB(orderId) {
    if (!confirm('⚠️ هل أنت مقتنع بحذف هذا الطلب نهائياً من قاعدة البيانات واللوحة؟')) return;

    const row = document.getElementById(`order_row_${orderId}`);
    if (row) row.remove();

    allOrdersList = allOrdersList.filter(o => o._id !== orderId);

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (data.success) {
            loadAdminDashboard();
        } else {
            alert('❌ ' + data.message);
            loadAdminDashboard();
        }
    } catch (err) {
        alert('حدث خطأ أثناء الحذف');
        loadAdminDashboard();
    }
}

function filterAdminOrders(status) {
    if (status === 'all') {
        renderAdminOrdersTable(allOrdersList);
    } else {
        renderAdminOrdersTable(allOrdersList.filter(o => o.status === status));
    }
}

function searchAdminOrders(query) {
    const q = (query || '').toLowerCase();
    renderAdminOrdersTable(allOrdersList.filter(o => 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customer && o.customer.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer && o.customer.phone && o.customer.phone.includes(q)) ||
        (o.customer && o.customer.whatsappPhone && o.customer.whatsappPhone.includes(q))
    ));
}

// ================= 4. طباعة الفاتورة الحرارية =================

function printThermalReceipt(order) {
    const printArea = document.getElementById('printableReceipt');
    if (!printArea) return;

    const realCustomerName = escapeHTML(order.customer && order.customer.name ? order.customer.name : 'عميل أورا');
    const realCustomerPhone = escapeHTML(order.customer ? order.customer.phone : '-');
    const realCustomerAddress = escapeHTML(order.customer ? order.customer.address : '-');

    const qrImageSource = order.qrCodeData || '';

    const itemsRowsHtml = (order.items || []).map(i => `
        <tr>
            <td style="text-align: right; padding: 2px 0;">${escapeHTML(i.title)} (x${i.quantity || 1})</td>
            <td style="text-align: left; padding: 2px 0;">${i.itemTotal || (i.unitPrice * (i.quantity || 1))} ج.م</td>
        </tr>
    `).join('');

    printArea.innerHTML = `
        <div class="thermal-receipt-box">
            <div class="thermal-receipt-header">
                <h2 class="thermal-receipt-title">مطبخ ابو قورة الفلاحي</h2>
                <p class="thermal-receipt-subtitle">فاتورة مبيعات ضريبية مبسطة</p>
                <p class="thermal-receipt-subtitle">رقم الطلب: <strong>${escapeHTML(order.orderNumber)}</strong></p>
                <p class="thermal-receipt-subtitle">التاريخ: ${new Date(order.createdAt || Date.now()).toLocaleString('ar-EG')}</p>
            </div>

            <div class="thermal-receipt-divider"></div>

            <div style="font-size: 11px; margin-bottom: 6px;">
                <div><strong>العميل:</strong> ${realCustomerName}</div>
                <div><strong>الهاتف:</strong> ${realCustomerPhone}</div>
                <div><strong>العنوان:</strong> ${realCustomerAddress}</div>
            </div>

            <div class="thermal-receipt-divider"></div>

            <table class="thermal-receipt-table">
                <thead>
                    <tr>
                        <th style="text-align: right;">الصنف</th>
                        <th style="text-align: left;">السعر</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRowsHtml}
                </tbody>
            </table>

            <div class="thermal-receipt-divider"></div>

            <div style="font-size: 11px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>المجموع الفرعي:</span>
                    <span>${order.subtotal || order.totalPrice} ج.م</span>
                </div>
                ${order.discountAmount ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>الخصم:</span>
                    <span>-${order.discountAmount} ج.م</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between;">
                    <span>رسوم التوصيل:</span>
                    <span>${order.deliveryFee || 0} ج.م</span>
                </div>
            </div>

            <div class="thermal-receipt-total-box">
                <h3 style="margin: 0; font-size: 16px;">الإجمالي الصافي: ${order.totalPrice} ج.م</h3>
            </div>

            <div class="thermal-qr-container">
                ${qrImageSource ? `<img src="${qrImageSource}" alt="QR Code" style="width: 110px; height: 110px; display: block; margin: 0 auto;">` : ''}
                <div style="font-size: 10px; margin-top: 2px;">مسح الـ QR للفاتورة الرقمية الموثقة</div>
            </div>

            <div style="text-align: center; font-size: 10px; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px;">
                شكراً لزيارتكم مطبخ أبو قورة - هاتف الدعم: 01120751467
            </div>
        </div>
    `;

    setTimeout(() => {
        window.print();
    }, 100);
}

// ================= 5. جلب الأصناف =================

async function fetchDishesFromDB() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        allDishesList = data.products || [];
        renderDishesGrid();
    } catch (e) {
        allDishesList = [];
        renderDishesGrid();
    }
}

function searchDishesInAdmin(query) {
    const q = (query || '').toLowerCase();
    const filtered = allDishesList.filter(d => d.title.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
    renderDishesGridCustomList(filtered);
}

function renderDishesGrid() {
    renderDishesGridCustomList(allDishesList);
}

function renderDishesGridCustomList(list) {
    const grid = document.getElementById('adminDishesGrid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5"><p class="text-muted fs-5 fw-bold">لا توجد أطباق مسجلة في قاعدة البيانات. قم بإضافة طبق جديد!</p></div>`;
        return;
    }

    const isSuperAdmin = currentAdminUser && currentAdminUser.role === 'superadmin';

    grid.innerHTML = list.map(d => {
        let sizesCount = d.sizes ? d.sizes.length : 0;
        let addonsCount = d.addons ? d.addons.length : 0;

        return `
            <div class="col-md-4">
                <div class="card h-100 shadow-sm border rounded-3 overflow-hidden">
                    <img src="${d.images && d.images[0] ? d.images[0] : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1'}" class="card-img-top" style="height: 180px; object-fit: cover;">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge ${d.isAvailable !== false ? 'bg-success' : 'bg-danger'}">${d.isAvailable !== false ? 'متوفر' : 'غير متوفر'}</span>
                            <span class="fw-bold text-danger">${d.price} ج.م</span>
                        </div>
                        <h5 class="fw-bold mb-1">${escapeHTML(d.title)}</h5>
                        <p class="text-muted small mb-2">${escapeHTML(d.shortDescription || d.description || '')}</p>
                        
                        <div class="mb-3">
                            <span class="badge bg-light text-dark border me-1">📐 ${sizesCount} أحجام</span>
                            <span class="badge bg-light text-dark border me-1">🧀 ${addonsCount} إضافات</span>
                            <span class="badge bg-dark text-white">📦 مخزون: ${d.stockQuantity !== undefined ? d.stockQuantity : 100}</span>
                        </div>

                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-warning text-dark fw-bold" onclick='openEditDishModal(${JSON.stringify(d)})'>
                                ✏️ تعديل
                            </button>
                            <button class="btn btn-sm btn-outline-secondary w-100" onclick="toggleDishStatus('${d._id}', ${d.isAvailable !== false})">
                                ${d.isAvailable !== false ? 'إيقاف' : 'تفعيل'}
                            </button>
                            ${isSuperAdmin ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteDishFromDB('${d._id}')">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openEditDishModal(dish) {
    document.getElementById('editDishId').value = dish._id;
    document.getElementById('editDishTitle').value = dish.title;
    document.getElementById('editDishPrice').value = dish.price;
    document.getElementById('editDishDiscountPrice').value = dish.discountPrice || 0;
    document.getElementById('editDishDesc').value = dish.description || dish.shortDescription || '';
    document.getElementById('editDishImg').value = dish.images && dish.images[0] ? dish.images[0] : '';

    if (dish.sizes && dish.sizes.length > 0) {
        document.getElementById('editDishSizesInput').value = dish.sizes.map(s => `${s.name}:${s.price}`).join(', ');
    } else {
        document.getElementById('editDishSizesInput').value = '';
    }

    if (dish.addons && dish.addons.length > 0) {
        document.getElementById('editDishAddonsInput').value = dish.addons.map(a => `${a.name}:${a.price}`).join(', ');
    } else {
        document.getElementById('editDishAddonsInput').value = '';
    }

    const select = document.getElementById('editDishCategorySelect');
    if (select) {
        select.innerHTML = allCategoriesList.map(c => `<option value="${c.name}" ${dish.categoryId && dish.categoryId.name === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    const modal = new bootstrap.Modal(document.getElementById('editDishModal'));
    modal.show();
}

async function submitEditDishToDB(e) {
    e.preventDefault();
    const id = document.getElementById('editDishId').value;
    const title = document.getElementById('editDishTitle').value;
    const category = document.getElementById('editDishCategorySelect').value;
    const price = document.getElementById('editDishPrice').value;
    const discountPrice = document.getElementById('editDishDiscountPrice').value;
    const desc = document.getElementById('editDishDesc').value;
    const img = document.getElementById('editDishImg').value;

    const sizesArray = parseOptionsString(document.getElementById('editDishSizesInput').value);
    const addonsArray = parseOptionsString(document.getElementById('editDishAddonsInput').value);

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                title,
                category,
                price: Number(price),
                discountPrice: Number(discountPrice) || 0,
                shortDescription: desc,
                fullDescription: desc,
                images: [img || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1'],
                sizes: sizesArray,
                addons: addonsArray
            })
        });

        const data = await res.json();
        if (data.success) {
            alert('✅ تم حفظ تعديلات الوجبة بنجاح بـ MongoDB Atlas!');
            fetchDishesFromDB();
            bootstrap.Modal.getInstance(document.getElementById('editDishModal')).hide();
        } else {
            alert('فشل التعديل: ' + data.message);
        }
    } catch (err) {
        alert('خطأ في الاتصال بالسيرفر');
    }
}

async function addNewDishToDB(e) {
    e.preventDefault();
    const title = document.getElementById('dishTitle').value;
    const category = document.getElementById('dishCategorySelect').value;
    const price = document.getElementById('dishPrice').value;
    const discountPrice = document.getElementById('dishDiscountPrice').value;
    const desc = document.getElementById('dishDesc').value;
    const img = document.getElementById('dishImg').value;

    const sizesArray = parseOptionsString(document.getElementById('dishSizesInput').value);
    const addonsArray = parseOptionsString(document.getElementById('dishAddonsInput').value);

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/products', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title,
                category,
                price: Number(price),
                discountPrice: Number(discountPrice) || 0,
                shortDescription: desc,
                fullDescription: desc,
                images: img ? [img] : ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1'],
                sizes: sizesArray,
                addons: addonsArray
            })
        });

        const data = await res.json();
        if (data.success) {
            alert('🎉 تم إضافة ونشر الوجبة في قاعدة البيانات MongoDB Atlas بنجاح!');
            fetchDishesFromDB();
            bootstrap.Modal.getInstance(document.getElementById('addDishModal')).hide();
        }
    } catch (err) {
        alert('خطأ في الاتصال بالسيرفر');
    }
}

async function toggleDishStatus(id, currentStatus) {
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ isAvailable: !currentStatus })
        });
        fetchDishesFromDB();
    } catch (e) {}
}

async function deleteDishFromDB(id) {
    if (!confirm('⚠️ هل أنت مقتنع بحذف هذه الوجبة نهائياً من قاعدة البيانات والمنيو؟')) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers });
        const data = await res.json();

        if (data.success) {
            alert('✅ تم حذف الصنف بنجاح واختفائه الفوري من المنيو!');
            fetchDishesFromDB();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (err) {
        alert('حدث خطأ أثناء الحذف');
    }
}

async function fetchCategoriesFromDB() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        allCategoriesList = data.categories || [];
        renderCategoriesList();
        populateCategorySelectDropdown();
    } catch (e) {
        allCategoriesList = [];
        renderCategoriesList();
    }
}

function populateCategorySelectDropdown() {
    const select = document.getElementById('dishCategorySelect');
    if (!select) return;

    if (allCategoriesList.length === 0) {
        select.innerHTML = `<option value="عام">قسم عام</option>`;
        return;
    }

    select.innerHTML = allCategoriesList.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('');
}

function renderCategoriesList() {
    const list = document.getElementById('adminCategoriesList');
    if (!list) return;

    if (allCategoriesList.length === 0) {
        list.innerHTML = `<div class="p-4 text-center text-muted fw-bold">لا يوجد أقسام مسجلة بقاعدة البيانات Atlas. يرجى إضافة قسم جديد!</div>`;
        return;
    }

    list.innerHTML = allCategoriesList.map(c => `
        <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
            <div>
                <h6 class="fw-bold m-0">${escapeHTML(c.name)} <small class="text-muted">(${escapeHTML(c.nameEn || '')})</small></h6>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteCategoryFromDB('${c._id}')">🗑️ حذف القسم من MongoDB</button>
        </div>
    `).join('');
}

async function addNewCategoryToDB(e) {
    e.preventDefault();
    const nameAr = document.getElementById('catNameAr').value;
    const nameEn = document.getElementById('catNameEn').value;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/categories', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: nameAr, nameEn })
        });

        const data = await res.json();
        if (data.success) {
            alert('🎉 تم إنشاء وحفظ القسم الجديد بنجاح في قاعدة البيانات!');
            document.getElementById('catNameAr').value = '';
            document.getElementById('catNameEn').value = '';
            fetchCategoriesFromDB();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('حدث خطأ أثناء إضافة القسم');
    }
}

async function deleteCategoryFromDB(id) {
    if (!confirm('⚠️ هل تريد حذف هذا القسم نهائياً من قاعدة البيانات والمنيو؟')) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم حذف القسم بنجاح!');
            fetchCategoriesFromDB();
        }
    } catch (e) {}
}

async function fetchCouponsFromDB() {
    const tbody = document.getElementById('couponsAdminTableBody');
    if (!tbody) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/coupons', { headers });
        const data = await res.json();
        allCouponsList = data.coupons || [];

        if (allCouponsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted fw-bold">لا توجد كوبونات خصم مسجلة بالداتا بيز</td></tr>`;
            return;
        }

        tbody.innerHTML = allCouponsList.map(c => `
            <tr>
                <td><strong class="text-primary fs-6">${escapeHTML(c.code)}</strong></td>
                <td><span class="badge bg-success">${c.discountPercentage}% خصم</span></td>
                <td>${c.minOrderAmount} ج.م</td>
                <td><small>${new Date(c.expirationDate).toLocaleDateString('ar-EG')}</small></td>
                <td><span class="badge bg-light text-dark border">${c.usedCount} مرة</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCouponFromDB('${c._id}')">🗑️ حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function addNewCouponToDB(e) {
    e.preventDefault();
    const code = document.getElementById('couponCode').value;
    const discountPercentage = document.getElementById('couponPercentage').value;
    const minOrderAmount = document.getElementById('couponMinOrder').value;
    const expirationDate = document.getElementById('couponExpiration').value;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/coupons', {
            method: 'POST',
            headers,
            body: JSON.stringify({ code, discountPercentage, minOrderAmount, expirationDate })
        });
        const data = await res.json();
        if (data.success) {
            alert('🎉 تم إضافة كود الخصم بنجاح!');
            fetchCouponsFromDB();
            bootstrap.Modal.getInstance(document.getElementById('addCouponModal')).hide();
        } else {
            alert(data.message);
        }
    } catch (e) {}
}

async function deleteCouponFromDB(id) {
    if (!confirm('هل تريد حذف هذا الكوبون نهائياً؟')) return;
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم حذف الكوبون بنجاح');
            fetchCouponsFromDB();
        }
    } catch (e) {}
}

async function fetchDeliveryAreasFromDB() {
    const tbody = document.getElementById('deliveryAreasAdminTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/delivery-areas');
        const data = await res.json();
        allDeliveryAreasList = data.areas || [];

        if (allDeliveryAreasList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted fw-bold">لا توجد مناطق توصيل مضافة بالداتا بيز</td></tr>`;
            return;
        }

        tbody.innerHTML = allDeliveryAreasList.map(a => `
            <tr>
                <td><strong>${escapeHTML(a.areaName)}</strong></td>
                <td><strong class="text-danger">${a.deliveryFee} ج.م</strong></td>
                <td>${a.minOrderAmount} ج.م</td>
                <td><small>${a.estimatedTimeMinutes} دقيقة</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteDeliveryAreaFromDB('${a._id}')">🗑️ حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function addNewDeliveryAreaToDB(e) {
    e.preventDefault();
    const areaName = document.getElementById('areaName').value;
    const deliveryFee = document.getElementById('areaDeliveryFee').value;
    const minOrderAmount = document.getElementById('areaMinOrder').value;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/delivery-areas', {
            method: 'POST',
            headers,
            body: JSON.stringify({ areaName, deliveryFee, minOrderAmount })
        });
        const data = await res.json();
        if (data.success) {
            alert('🎉 تم إضافة منطقة وسعر التوصيل بنجاح!');
            fetchDeliveryAreasFromDB();
            bootstrap.Modal.getInstance(document.getElementById('addDeliveryAreaModal')).hide();
        } else {
            alert(data.message);
        }
    } catch (e) {}
}

async function deleteDeliveryAreaFromDB(id) {
    if (!confirm('هل تريد حذف هذه المنطقة من قائمة الدليفري؟')) return;
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/delivery-areas/${id}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم حذف المنطقة بنجاح من قاعدة البيانات');
            fetchDeliveryAreasFromDB();
        }
    } catch (e) {}
}

async function fetchReviewsFromDB() {
    const tbody = document.getElementById('reviewsAdminTableBody');
    if (!tbody) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/reviews/admin/all', { headers });
        const data = await res.json();
        const reviews = data.reviews || [];

        if (reviews.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted fw-bold">لا يوجد تقييمات مسجلة بعد</td></tr>`;
            return;
        }

        tbody.innerHTML = reviews.map(r => `
            <tr>
                <td><strong>${escapeHTML(r.userName || 'عميل أورا')}</strong></td>
                <td><small class="fw-bold text-dark">${r.productId ? escapeHTML(r.productId.title) : 'وجبة'}</small></td>
                <td><span class="badge bg-warning text-dark">⭐ ${r.foodRating || 5} / 5</span></td>
                <td><small>${escapeHTML(r.comment || 'بدون تعليق')}</small></td>
                <td>
                    <span class="badge ${r.isApproved ? 'bg-success' : 'bg-secondary'}">
                        ${r.isApproved ? 'معتمد ومنشور ✅' : 'مخفي 🚫'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-dark me-1" onclick="toggleReviewApprovalInDB('${r._id}')">
                        ${r.isApproved ? 'إخفاء' : 'نشر واعتماد'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteReviewFromDB('${r._id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function toggleReviewApprovalInDB(id) {
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/reviews/${id}/toggle-approval`, { method: 'PUT', headers });
        const data = await res.json();
        alert(data.message);
        fetchReviewsFromDB();
    } catch (e) {}
}

async function deleteReviewFromDB(id) {
    if (!confirm('حذف التقييم؟')) return;
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (data.success) {
            alert('تم حذف التقييم');
            fetchReviewsFromDB();
        }
    } catch (e) {}
}

// 6. تحميل الحسابات وترقيتها
async function loadAllUsersAdmin() {
    const tbody = document.getElementById('usersAdminTableBody');
    if (!tbody) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch('/api/auth/users', { headers });
        const users = await res.json();

        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">لا يوجد حسابات مسجلة بعد</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>
                    <strong>${escapeHTML(u.name)}</strong><br>
                    <small class="text-muted">${escapeHTML(u.email)}</small>
                </td>
                <td>
                    <span class="badge ${u.role === 'superadmin' ? 'bg-warning text-dark' : (u.role === 'staff' ? 'bg-info text-dark' : 'bg-secondary')}">
                        ${u.role === 'superadmin' ? 'المالك الأصلي 👑' : (u.role === 'staff' ? 'موظف مُرقى 🧑‍🍳' : 'عميل زائر 👤')}
                    </span>
                </td>
                <td>
                    <span class="badge ${u.isBanned ? 'bg-danger' : 'bg-success'}">
                        ${u.isBanned ? 'محظور ❌' : 'نشط ✅'}
                    </span>
                </td>
                <td>
                    ${u.role !== 'superadmin' ? `
                        <button class="btn btn-sm btn-outline-primary ms-1" onclick="promoteUser('${u._id}')">
                            ${u.role === 'staff' ? 'تنزيل لعميل' : 'ترقية لموظف 🎖️'}
                        </button>
                        <button class="btn btn-sm ${u.isBanned ? 'btn-outline-success' : 'btn-outline-danger'} ms-1" onclick="toggleBanUser('${u._id}')">
                            ${u.isBanned ? 'إلغاء الحظر ✅' : 'حظر الحساب 🚫'}
                        </button>
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteUserFromAdminDB('${u._id}')">
                            🗑️ حذف الحساب
                        </button>
                    ` : '<small class="text-muted">حساب المالك محمي</small>'}
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function promoteUser(userId) {
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/auth/promote/${userId}`, { method: 'PUT', headers });
        const data = await res.json();
        alert(data.message);
        loadAllUsersAdmin();
    } catch (e) {}
}

async function toggleBanUser(userId) {
    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/auth/ban/${userId}`, { method: 'PUT', headers });
        const data = await res.json();
        alert(data.message);
        loadAllUsersAdmin();
    } catch (e) {}
}

async function deleteUserFromAdminDB(userId) {
    if (!confirm('⚠️ هل أنت مقتنع بحذف هذا الحساب نهائياً من قاعدة البيانات وطرد جلسته أوتوماتيكياً؟')) return;

    try {
        const savedToken = localStorage.getItem('ora_user_token');
        const headers = {};
        if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

        const res = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE', headers });
        const data = await res.json();
        alert(data.message);
        loadAllUsersAdmin();
    } catch (e) {
        alert('حدث خطأ أثناء الحذف');
    }
}