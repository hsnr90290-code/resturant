// =========================================================
// كود العميل التجاري الفائق السرعة - ربط حقيقي 100% بـ MongoDB Atlas و Socket.io
// Enterprise Client Logic: Real-Time Credentials Sync, Session Role Promotion & Live Visual Editor
// =========================================================

const socket = io();
const currentRestaurantId = "65d0a1b2c3d4e5f6a7b8c9d0";

let currentUserSession = null;
let cart = JSON.parse(localStorage.getItem('ora_restaurant_cart')) || [];
let recentlyViewedIds = JSON.parse(localStorage.getItem('ora_recently_viewed')) || [];
let lastOrderData = JSON.parse(localStorage.getItem('ora_last_completed_order')) || null;

let map, marker;
let allProductsFromDB = [];
let whatsappNumberFromDB = '01120751467';
let phoneNumberFromDB = '01120751467';
let activeDeliveryFee = 0;
let appliedCouponData = null;

let isRestaurantOpenNow = true;
let restaurantClosedReasonMessage = '';

let currentCustomizingProduct = null;
let currentProductDetailsObj = null;
let detailsQty = 1;

// دالة حماية وحجب الثغرات البرمجية XSS
function escapeHTML(str) {
    if (typeof str !== 'string') return str || '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// دالة تحديث النص في الواجهة دون مسح الأيقونات الابنة
function updateTextPreservingIcons(element, newText) {
    if (!element) return;
    const hasSubElements = element.querySelector('i, svg, .icon, .badge, span');
    if (hasSubElements) {
        let replaced = false;
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                node.textContent = ' ' + newText + ' ';
                replaced = true;
            }
        });
        if (!replaced) {
            element.appendChild(document.createTextNode(' ' + newText));
        }
    } else {
        element.innerText = newText;
    }
}

// دالة حاسمة لإلغاء خاصية الشفافية والتدرج وتثبيت لون النص الجديد بكفاءة
function applyTextColorOverride(element, colorVal) {
    if (!element || !colorVal) return;
    element.style.setProperty('color', colorVal, 'important');
    element.style.setProperty('-webkit-text-fill-color', colorVal, 'important');
    element.style.setProperty('background-clip', 'border-box', 'important');
    element.style.setProperty('-webkit-background-clip', 'border-box', 'important');
}

// دالة حاسمة لإلغاء التدرج القديم وتثبيت لون الخلفية الصلب
function applyBgColorOverride(element, bgColorVal) {
    if (!element || !bgColorVal) return;
    element.style.setProperty('background-color', bgColorVal, 'important');
    element.style.setProperty('background-image', 'none', 'important');
}

document.addEventListener('DOMContentLoaded', () => {
    checkUserSessionOnHome();
    updateCartUI();
    loadCategoriesFromDB();
    loadProductsFromDB();
    loadDealsFromDB();
    loadTopSellersFromDB();
    loadDeliveryAreasFromDB();
    loadSettingsFromDB();
    initGPSMap();
    listenToSocketEvents();

    if (window.location.pathname.includes('product-details')) {
        initProductDetailsPage();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderNumParam = urlParams.get('order');
    if (orderNumParam && document.getElementById('trackPhoneOrNumberInput')) {
        document.getElementById('trackPhoneOrNumberInput').value = orderNumParam;
        trackOrderByPhoneOrNumber();
    }
});

// 1. تطبيق مظهر وألوان ونصوص كائن الإعدادات المباشر بـ MongoDB و Socket.io
function applyDynamicThemeAndContent(s) {
    if (!s) return;

    if (s.theme) {
        const root = document.documentElement;
        if (s.theme.primaryColor) root.style.setProperty('--brand-red', s.theme.primaryColor);
        if (s.theme.primaryHover) root.style.setProperty('--brand-red-hover', s.theme.primaryHover);
        if (s.theme.secondaryColor) root.style.setProperty('--brand-gold', s.theme.secondaryColor);
        if (s.theme.goldLight) root.style.setProperty('--brand-gold-light', s.theme.goldLight);
        if (s.theme.darkColor) root.style.setProperty('--brand-dark', s.theme.darkColor);
        if (s.theme.bgColor) root.style.setProperty('--bg-cream', s.theme.bgColor);
        if (s.theme.cardBgColor) root.style.setProperty('--card-bg', s.theme.cardBgColor);
        if (s.theme.textColor) root.style.setProperty('--text-primary', s.theme.textColor);
        if (s.theme.borderRadius) root.style.setProperty('--radius-lg', s.theme.borderRadius);

        if (s.theme.fontFamily) {
            document.body.style.fontFamily = `'${s.theme.fontFamily}', 'Tajawal', sans-serif`;
        }

        let customStyleTag = document.getElementById('dynamicCustomCss');
        if (!customStyleTag) {
            customStyleTag = document.createElement('style');
            customStyleTag.id = 'dynamicCustomCss';
            document.head.appendChild(customStyleTag);
        }
        customStyleTag.innerHTML = s.theme.customCss || '';
    }

    if (s.content) {
        const c = s.content;

        document.querySelectorAll('[data-content="brandName"]').forEach(el => updateTextPreservingIcons(el, c.brandName || 'أبو قورة ✨'));
        document.querySelectorAll('[data-content="brandTagline"]').forEach(el => updateTextPreservingIcons(el, c.brandTagline || 'مطبخ المشويات والبلدي الأصيل'));

        const heroTitle = document.querySelector('.hero-title, [data-content="heroTitle"]');
        if (heroTitle && c.heroTitle) updateTextPreservingIcons(heroTitle, c.heroTitle);

        const heroSubtitle = document.querySelector('.hero-subtitle, [data-content="heroSubtitle"]');
        if (heroSubtitle && c.heroSubtitle) updateTextPreservingIcons(heroSubtitle, c.heroSubtitle);

        const heroWrapper = document.querySelector('.hero-wrapper');
        if (heroWrapper && c.heroBgImage) {
            heroWrapper.style.backgroundImage = `linear-gradient(rgba(10, 8, 6, 0.75), rgba(10, 8, 6, 0.85)), url('${c.heroBgImage}')`;
        }

        const dealsTitle = document.querySelector('#dealsSection h2, [data-content="dealsSectionTitle"]');
        if (dealsTitle && c.dealsSectionTitle) updateTextPreservingIcons(dealsTitle, c.dealsSectionTitle);

        const dealsSub = document.querySelector('#dealsSection small, [data-content="dealsSectionSubtitle"]');
        if (dealsSub && c.dealsSectionSubtitle) updateTextPreservingIcons(dealsSub, c.dealsSectionSubtitle);

        const topTitle = document.querySelector('#menuSection h2, [data-content="topSellersTitle"]');
        if (topTitle && c.topSellersTitle) updateTextPreservingIcons(topTitle, c.topSellersTitle);

        const topSub = document.querySelector('#menuSection p, [data-content="topSellersSubtitle"]');
        if (topSub && c.topSellersSubtitle) updateTextPreservingIcons(topSub, c.topSellersSubtitle);

        let annBar = document.getElementById('announcementTickerBar');
        if (c.showAnnouncement && c.announcementText) {
            if (!annBar) {
                annBar = document.createElement('div');
                annBar.id = 'announcementTickerBar';
                annBar.className = 'bg-warning text-dark py-2 px-3 text-center fw-bold sticky-top shadow-sm';
                annBar.style.zIndex = '1015';
                document.body.prepend(annBar);
            }
            annBar.innerHTML = `📢 <span>${escapeHTML(c.announcementText)}</span>`;
            annBar.classList.remove('d-none');
        } else if (annBar) {
            annBar.classList.add('d-none');
        }

        document.querySelectorAll('[data-content="footerText"]').forEach(el => updateTextPreservingIcons(el, c.footerText || 'جميع الحقوق محفوظة © 2026 مطبخ أبو قورة - طعم بلدي أصيل'));
    }

    if (s.elementOverrides) {
        const overrides = s.elementOverrides;
        Object.keys(overrides).forEach(key => {
            const override = overrides[key];
            const targetEl = document.querySelector(`[data-editor-id="${key}"], [data-content="${key}"], #${key}`);
            if (targetEl && override) {
                if (override.text !== undefined && override.text !== '') {
                    updateTextPreservingIcons(targetEl, override.text);
                }
                if (override.color) {
                    applyTextColorOverride(targetEl, override.color);
                }
                if (override.bgColor) {
                    applyBgColorOverride(targetEl, override.bgColor);
                }
                if (override.fontSize) targetEl.style.setProperty('font-size', override.fontSize, 'important');
                if (override.borderRadius) targetEl.style.setProperty('border-radius', override.borderRadius, 'important');
                if (override.bgImage) {
                    if (targetEl.tagName.toLowerCase() === 'img') {
                        targetEl.src = override.bgImage;
                    } else if (targetEl.classList.contains('hero-wrapper')) {
                        targetEl.style.setProperty('background-image', `linear-gradient(rgba(10, 8, 6, 0.75), rgba(10, 8, 6, 0.85)), url('${override.bgImage}')`, 'important');
                    } else {
                        targetEl.style.setProperty('background-image', `url('${override.bgImage}')`, 'important');
                    }
                }
            }
        });
    }
}

// 2. جلب حالة المطعم من MongoDB Atlas
async function loadSettingsFromDB() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const s = data.settings || {};

        if (s.whatsappPhone) whatsappNumberFromDB = s.whatsappPhone;
        if (s.phone) phoneNumberFromDB = s.phone;

        isRestaurantOpenNow = s.isOpenNow !== false;
        restaurantClosedReasonMessage = s.closedReason || '🔴 عفواً! المطبخ مغلق حالياً ولا يستقبل طلبات جديدة خارج أوقات العمل الرسمية.';

        applyDynamicThemeAndContent(s);

        const closedBanner = document.getElementById('restaurantClosedBanner');
        const closedText = document.getElementById('restaurantClosedText');
        const submitBtn = document.getElementById('submitOrderBtn');

        if (!isRestaurantOpenNow) {
            if (closedBanner) closedBanner.classList.remove('d-none');
            if (closedText) closedText.innerText = restaurantClosedReasonMessage;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = '🔒 المطبخ مغلق حالياً عن استقبال الطلبات';
                submitBtn.classList.replace('btn-brand-red', 'btn-secondary');
            }
        } else {
            if (closedBanner) closedBanner.classList.add('d-none');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = '🚀 تأكيد وإرسال الطلب للمطبخ والواتساب';
                submitBtn.classList.replace('btn-secondary', 'btn-brand-red');
            }
        }

        if (document.getElementById('contactWhatsappDisplay')) document.getElementById('contactWhatsappDisplay').innerText = whatsappNumberFromDB;
        if (document.getElementById('contactPhoneDisplay')) document.getElementById('contactPhoneDisplay').innerText = phoneNumberFromDB;
        
        if (document.getElementById('contactWorkingHoursDisplay')) {
            const format12H = (time24) => {
                if (!time24) return '';
                const parts = time24.split(':');
                const h = parseInt(parts[0], 10);
                const m = parseInt(parts[1] || '0', 10);
                const period = h >= 12 ? 'مساءً' : 'صباحاً';
                const h12 = h % 12 || 12;
                const mStr = m < 10 ? '0' + m : m;
                return `${h12}:${mStr} ${period}`;
            };

            const openText = format12H(s.openingTime || '10:00');
            const closeText = format12H(s.closingTime || '23:59');

            document.getElementById('contactWorkingHoursDisplay').innerText = `يومياً من ${openText} حتى ${closeText}`;
        }

        if (document.getElementById('contactWhatsappLink')) {
            const formattedPhone = whatsappNumberFromDB.startsWith('0') ? '2' + whatsappNumberFromDB : whatsappNumberFromDB;
            document.getElementById('contactWhatsappLink').href = `https://wa.me/${formattedPhone}?text=${encodeURIComponent('السلام عليكم، أريد الاستفسار عن المنيو والطلبات')}`;
        }
    } catch (error) {}
}

// 3. إرسال الطلب
async function submitOrder(event) {
    event.preventDefault();

    if (!isRestaurantOpenNow) {
        alert(restaurantClosedReasonMessage || '🚫 عفواً! المطبخ مغلق حالياً ولا يستقبل طلبات جديدة خارج أوقات العمل.');
        return;
    }

    if (cart.length === 0) {
        alert('سلتك فارغة! أضف وجبات للطلب أولاً.');
        return;
    }

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const whatsappPhone = document.getElementById('custWhatsappPhone') ? document.getElementById('custWhatsappPhone').value.trim() : phone;
    const address = document.getElementById('custAddress').value.trim();
    const notes = document.getElementById('custNotes') ? document.getElementById('custNotes').value : '';
    const lat = document.getElementById('custLat') ? document.getElementById('custLat').value : '';
    const lng = document.getElementById('custLng') ? document.getElementById('custLng').value : '';
    const scheduledDeliveryTime = document.getElementById('scheduledDeliveryTimeSelect') ? document.getElementById('scheduledDeliveryTimeSelect').value : 'في أسرع وقت (ASAP)';

    const payload = {
        customer: {
            name,
            phone,
            whatsappPhone: whatsappPhone || phone,
            address,
            notes,
            gpsLocation: { lat: Number(lat) || 0, lng: Number(lng) || 0, mapUrl: `https://maps.google.com/?q=${lat},${lng}` }
        },
        items: cart,
        couponCode: appliedCouponData ? appliedCouponData.code : '',
        deliveryFee: activeDeliveryFee,
        scheduledDeliveryTime,
        paymentMethod: 'COD'
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.success) {
            const orderObj = data.order;
            const orderNum = orderObj.orderNumber;

            localStorage.setItem('ora_last_completed_order', JSON.stringify({ items: cart, customer: payload.customer }));

            const whatsappMsg = encodeURIComponent(
                `*طلب جديد من مطبخ أبو قورة 🥩*\n` +
                `*رقم الطلب:* ${orderNum}\n` +
                `*الاسم:* ${name}\n` +
                `*الهاتف للاتصال:* ${phone}\n` +
                `*الواتساب:* ${whatsappPhone || phone}\n` +
                `*العنوان:* ${address}\n` +
                `*رابط الـ GPS:* https://maps.google.com/?q=${lat},${lng}\n` +
                `-------------------------\n` +
                `*الأصناف:*\n` + cart.map(i => `- ${i.title} x${i.quantity}`).join('\n') +
                `\n-------------------------\n` +
                `*المبلغ الإجمالي:* ${orderObj.totalPrice} ج.م`
            );

            const formattedRestaurantPhone = whatsappNumberFromDB.startsWith('0') ? '2' + whatsappNumberFromDB : whatsappNumberFromDB;
            window.open(`https://wa.me/${formattedRestaurantPhone}?text=${whatsappMsg}`, '_blank');

            cart = [];
            appliedCouponData = null;
            saveCart();
            updateCartUI();
            toggleCartDrawer();

            showOrderQRModal(orderObj, phone);
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('حدث خطأ في الاتصال بالسيرفر');
    }
}

function showOrderQRModal(order, phone) {
    const modalEl = document.getElementById('qrSuccessModal');
    if (!modalEl) {
        alert(`🎉 تم تسجيل طلبك بنجاح بـ MongoDB! رقم الطلب: ${order.orderNumber}`);
        window.location.href = `/checkout.html?order=${phone}`;
        return;
    }

    document.getElementById('qrModalOrderNumber').innerText = order.orderNumber;
    document.getElementById('qrModalTotal').innerText = `${order.totalPrice} ج.م`;

    const qrImg = document.getElementById('qrModalImage');
    if (order.qrCodeData) {
        qrImg.src = order.qrCodeData;
        qrImg.classList.remove('d-none');
    }

    const bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static' });
    bsModal.show();

    modalEl.addEventListener('hidden.bs.modal', () => {
        window.location.href = `/checkout.html?order=${phone}`;
    }, { once: true });
}

// 4. استرجاع الجلسة ومزامنتها
async function checkUserSessionOnHome() {
    const cachedUserStr = localStorage.getItem('ora_user_session');
    const savedToken = localStorage.getItem('ora_user_token');

    if (cachedUserStr) {
        try {
            currentUserSession = JSON.parse(cachedUserStr);
            renderUserSessionUI(currentUserSession);
        } catch (e) {}
    }

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (savedToken) {
            headers['Authorization'] = `Bearer ${savedToken}`;
        }

        const res = await fetch('/api/auth/me', { 
            method: 'GET',
            headers, 
            credentials: 'include' 
        });
        const data = await res.json();

        if (data.success && data.user) {
            currentUserSession = data.user;
            localStorage.setItem('ora_user_session', JSON.stringify(currentUserSession));
            if (data.token) {
                localStorage.setItem('ora_user_token', data.token);
            }
            renderUserSessionUI(currentUserSession);
        } else if (!data.success && !cachedUserStr) {
            localStorage.removeItem('ora_user_session');
            localStorage.removeItem('ora_user_token');
            currentUserSession = null;
            resetUserHeaderToGuest();
        }
    } catch (e) {
        if (currentUserSession) {
            renderUserSessionUI(currentUserSession);
        } else {
            resetUserHeaderToGuest();
        }
    }
}

function renderUserSessionUI(user) {
    if (!user) return;
    const userHeaderArea = document.getElementById('userHeaderArea');
    const mobileAuthText = document.getElementById('mobileUserAuthText');

    if (document.getElementById('custName')) document.getElementById('custName').value = user.name || '';
    if (document.getElementById('custPhone')) document.getElementById('custPhone').value = user.phone || '';
    if (document.getElementById('custWhatsappPhone')) document.getElementById('custWhatsappPhone').value = user.phone || '';

    const isStaffOrAdmin = user.role === 'superadmin' || user.role === 'staff' || user.role === 'admin';
    const roleLabel = user.role === 'superadmin' ? 'المالك 👑' : (user.role === 'staff' ? 'موظف 🧑‍🍳' : 'إدارة');

    if (userHeaderArea) {
        userHeaderArea.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-outline-dark rounded-pill dropdown-toggle fw-bold px-3 d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                    <span>👤 مرحباً، ${escapeHTML(user.name.split(' ')[0])}</span>
                    ${isStaffOrAdmin ? `<span class="badge bg-warning text-dark fw-bold">${roleLabel}</span>` : ''}
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                    ${isStaffOrAdmin ? `
                        <li><a class="dropdown-item fw-bold text-primary fs-6" href="/admin_restaurant_food">⚙️ دخول لوحة التحكم والإدارة</a></li>
                        <li><hr class="dropdown-divider"></li>
                    ` : ''}
                    <li><button class="dropdown-item fw-bold text-muted" onclick="checkUserSessionOnHome()">🔄 تحديث الصلاحيات / المزامنة الحية</button></li>
                    <li><a class="dropdown-item fw-bold" href="checkout.html">📋 تتبع طلباتي</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button class="dropdown-item text-danger fw-bold" onclick="logoutCustomerSession()">🚪 تسجيل الخروج</button></li>
                </ul>
            </div>
            ${isStaffOrAdmin ? `
                <a href="/admin_restaurant_food" class="btn btn-warning btn-sm fw-black rounded-pill px-3 shadow text-dark ms-1 text-nowrap">
                    ⚙️ لوحة الإدارة 👑
                </a>
            ` : ''}
        `;
    }

    if (mobileAuthText) {
        mobileAuthText.innerHTML = isStaffOrAdmin 
            ? `<a href="/admin_restaurant_food" class="text-decoration-none text-dark fw-bold">⚙️ لوحة الإدارة 👑</a>` 
            : `${escapeHTML(user.name.split(' ')[0])}`;
    }
}

function resetUserHeaderToGuest() {
    currentUserSession = null;
    const userHeaderArea = document.getElementById('userHeaderArea');
    const mobileAuthText = document.getElementById('mobileUserAuthText');

    if (userHeaderArea) {
        userHeaderArea.innerHTML = `
            <button class="nav-link-custom border-0 bg-transparent fw-bold" data-bs-toggle="modal" data-bs-target="#loginModal">
                👤 تسجيل الدخول / حساب جديد
            </button>
        `;
    }
    if (mobileAuthText) mobileAuthText.innerText = 'دخول';
}

// 5. تخصيص الأطباق
function openCustomizationModal(product) {
    currentCustomizingProduct = product;

    const titleEl = document.getElementById('customModalTitle');
    const descEl = document.getElementById('customModalDesc');
    if (titleEl) titleEl.innerText = product.title;
    if (descEl) descEl.innerText = product.shortDescription || product.description || '';

    const sizesContainer = document.getElementById('modalSizesContainer');
    if (sizesContainer) {
        if (product.sizes && product.sizes.length > 0) {
            sizesContainer.innerHTML = `<label class="form-label fw-bold small d-block mb-2 text-dark">📐 اختر الحجم / المقاس:</label>` +
                product.sizes.map((s, idx) => `
                    <div class="form-check bg-light p-3 rounded-3 border mb-2 cursor-pointer shadow-sm d-flex justify-content-between align-items-center" onclick="selectModalRadio('msize_${idx}')">
                        <div class="d-flex align-items-center gap-2">
                            <input class="form-check-input modal-size-radio" type="radio" name="modalSize" id="msize_${idx}" value="${s.price}" ${idx === 0 ? 'checked' : ''} onchange="recalculateModalPrice()">
                            <label class="form-check-label fw-bold cursor-pointer m-0" for="msize_${idx}">${escapeHTML(s.name)}</label>
                        </div>
                        <strong class="text-danger fs-6">${s.price} ج.م</strong>
                    </div>
                `).join('');
        } else {
            sizesContainer.innerHTML = '';
        }
    }

    const addonsContainer = document.getElementById('modalAddonsContainer');
    if (addonsContainer) {
        if (product.addons && product.addons.length > 0) {
            addonsContainer.innerHTML = `<label class="form-label fw-bold small d-block mb-2 text-dark">🧀 اختر الإضافات والصوصات الزيادة:</label>` +
                product.addons.filter(a => !a.isHidden).map((a, idx) => `
                    <div class="form-check bg-light p-3 rounded-3 border mb-2 cursor-pointer shadow-sm d-flex justify-content-between align-items-center" onclick="toggleModalAddonCheckbox('maddon_${idx}', event)">
                        <div class="d-flex align-items-center gap-2">
                            <input class="form-check-input modal-addon-cb" type="checkbox" id="maddon_${idx}" value="${a.price}" data-name="${escapeHTML(a.name)}" onchange="recalculateModalPrice()">
                            <label class="form-check-label fw-bold cursor-pointer m-0" for="maddon_${idx}">${escapeHTML(a.name)}</label>
                        </div>
                        <span class="badge bg-danger text-white fs-6">+${a.price} ج.م</span>
                    </div>
                `).join('');
        } else {
            addonsContainer.innerHTML = '';
        }
    }

    recalculateModalPrice();

    const modalEl = document.getElementById('productCustomModal');
    if (modalEl) {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }
}

function selectModalRadio(radioId) {
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.checked = true;
        recalculateModalPrice();
    }
}

function toggleModalAddonCheckbox(cbId, event) {
    if (event.target.tagName === 'INPUT') {
        recalculateModalPrice();
        return;
    }
    const cb = document.getElementById(cbId);
    if (cb) {
        cb.checked = !cb.checked;
        recalculateModalPrice();
    }
}

function recalculateModalPrice() {
    if (!currentCustomizingProduct) return;

    let basePrice = currentCustomizingProduct.discountPrice > 0 ? currentCustomizingProduct.discountPrice : currentCustomizingProduct.price;

    const checkedSize = document.querySelector('input[name="modalSize"]:checked');
    if (checkedSize) basePrice = Number(checkedSize.value);

    let addonsSum = 0;
    document.querySelectorAll('.modal-addon-cb:checked').forEach(cb => {
        addonsSum += Number(cb.value || 0);
    });

    const finalPrice = basePrice + addonsSum;

    const priceEl = document.getElementById('customModalPrice');
    if (priceEl) {
        priceEl.innerText = `${finalPrice} ج.م`;
    }
}

window.selectModalRadio = selectModalRadio;
window.toggleModalAddonCheckbox = toggleModalAddonCheckbox;
window.recalculateModalPrice = recalculateModalPrice;

function handleProductAddToCartClick(product) {
    if ((product.sizes && product.sizes.length > 0) || (product.addons && product.addons.length > 0)) {
        openCustomizationModal(product);
    } else {
        addToCartDirect({
            _id: product._id,
            title: product.title,
            price: product.discountPrice > 0 && product.discountPrice < product.price ? product.discountPrice : product.price,
            quantity: 1,
            selectedSize: null,
            selectedAddons: []
        });
    }
}

window.handleProductAddToCartClick = handleProductAddToCartClick;

function confirmAddToCartCustomized() {
    if (!currentCustomizingProduct) return;

    const checkedSize = document.querySelector('input[name="modalSize"]:checked');
    let selectedSize = null;
    let basePrice = currentCustomizingProduct.discountPrice > 0 && currentCustomizingProduct.discountPrice < currentCustomizingProduct.price 
        ? currentCustomizingProduct.discountPrice 
        : currentCustomizingProduct.price;

    if (checkedSize) {
        basePrice = Number(checkedSize.value);
        const sizeLabel = checkedSize.closest('.form-check') ? checkedSize.closest('.form-check').querySelector('label').innerText.trim() : '';
        selectedSize = { name: sizeLabel, price: basePrice };
    }

    const selectedAddons = [];
    document.querySelectorAll('.modal-addon-cb:checked').forEach(cb => {
        selectedAddons.push({ 
            name: cb.getAttribute('data-name'), 
            price: Number(cb.value) 
        });
    });

    addToCartDirect({
        _id: currentCustomizingProduct._id,
        title: currentCustomizingProduct.title,
        price: basePrice,
        quantity: 1,
        selectedSize,
        selectedAddons
    });

    const modalEl = document.getElementById('productCustomModal');
    if (modalEl) {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    }

    currentCustomizingProduct = null;
}

window.confirmAddToCartCustomized = confirmAddToCartCustomized;

function handleSearchAndSortInput() {
    loadProductsFromDB();
}
window.handleSearchAndSortInput = handleSearchAndSortInput;

// 6. جلب الأصناف
async function loadCategoriesFromDB() {
    const container = document.getElementById('categoryPillsContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        const categories = data.categories || [];

        let pillsHtml = `<button class="category-pill active" onclick="filterByCategory('all', this)">الكل</button>`;
        if (Array.isArray(categories)) {
            pillsHtml += categories.map(c => `
                <button class="category-pill" onclick="filterByCategory('${escapeHTML(c.name)}', this)">${c.icon || '🍔'} ${escapeHTML(c.name)}</button>
            `).join('');
        }
        container.innerHTML = pillsHtml;
        loadProductsFromDB();
    } catch (error) {}
}

async function loadProductsFromDB() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    try {
        const categoryFilter = getActiveCategoryFilter();
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');

        const isHomePage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || !document.getElementById('searchInput');

        let url = `/api/products?isAvailable=true`;
        
        if (isHomePage) {
            url += `&sort=top_sales&limit=10`;
        }

        if (categoryFilter && categoryFilter !== 'all') url += `&category=${encodeURIComponent(categoryFilter)}`;
        if (searchInput && searchInput.value) url += `&search=${encodeURIComponent(searchInput.value)}`;
        if (sortSelect && sortSelect.value) url += `&sort=${sortSelect.value}`;

        const response = await fetch(url);
        const data = await response.json();

        allProductsFromDB = data.products || [];
        renderFoodCards(allProductsFromDB, container);
    } catch (error) {
        container.innerHTML = `<div class="col-12 text-center py-5"><p class="text-muted fs-5">تعذر تحميل الوجبات من السيرفر</p></div>`;
    }
}

function getActiveCategoryFilter() {
    const activePill = document.querySelector('.category-pill.active');
    if (!activePill) return 'all';
    const text = activePill.innerText.trim();
    return text.includes('الكل') ? 'all' : text.split(' ').slice(1).join(' ') || text;
}

function renderFoodCards(products, container) {
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><p class="fs-5 text-muted">لا توجد أطباق مطابقة حالياً</p></div>`;
        return;
    }

    const displayPrice = (p) => p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;

    container.innerHTML = products.map(p => {
        const mainPrice = displayPrice(p);
        const hasOptions = (p.sizes && p.sizes.length) || (p.addons && p.addons.length);

        return `
            <div class="col-md-6 col-lg-4">
                <div class="food-card shadow-sm border rounded-4 overflow-hidden" data-editor-id="product-card-${p._id}">
                    <div class="food-card-img-wrapper cursor-pointer" onclick="openProductDetailPage('${p._id}')">
                        <img src="${p.images && p.images[0] ? p.images[0] : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1'}" alt="${escapeHTML(p.title)}">
                        <span class="badge-price fs-6">${mainPrice} ج.م</span>
                        ${p.discountPrice && p.discountPrice < p.price ? `<span class="badge-discount">خصم ${p.price - p.discountPrice} ج.م</span>` : ''}
                    </div>
                    <div class="food-card-body p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 class="food-title cursor-pointer m-0 fw-black text-dark" onclick="openProductDetailPage('${p._id}')">${escapeHTML(p.title)}</h5>
                            <span class="badge bg-warning text-dark fw-bold fs-6">${mainPrice} ج.م</span>
                        </div>
                        <p class="food-desc text-muted small mb-3">${escapeHTML(p.shortDescription || p.description || 'وجبة طازجة يومياً')}</p>
                        <button class="btn-add-to-cart fw-bold py-2 shadow-sm d-flex justify-content-between align-items-center px-3" onclick='handleProductAddToCartClick(${JSON.stringify(p)})'>
                            <span>🛒 إضافة للطلب ${hasOptions ? ' (تخصيص)' : ''}</span>
                            <span class="fw-black border-start ps-2 border-secondary">${mainPrice} ج.م</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openProductDetailPage(productId) {
    if (!productId) return;
    trackRecentlyViewed(productId);
    window.location.href = `/product-details?id=${productId}`;
}

window.openProductDetailPage = openProductDetailPage;

function filterByCategory(categoryName, btnElement) {
    document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    loadProductsFromDB();
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.toggle('show');
        overlay.classList.toggle('show');
        if (drawer.classList.contains('show') && map) {
            setTimeout(() => map.invalidateSize(), 300);
        }
    }
}

async function loadDealsFromDB() {
    const container = document.getElementById('dealsProductsContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/products?isDeal=true');
        const data = await res.json();
        const deals = data.products || [];

        if (deals.length === 0 && document.getElementById('dealsSection')) {
            document.getElementById('dealsSection').classList.add('d-none');
            return;
        }

        renderFoodCards(deals, container);
    } catch (e) {}
}

async function loadTopSellersFromDB() {
    const container = document.getElementById('topSellersProductsContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/products?sort=top_sales&limit=3');
        const data = await res.json();
        const topSellers = data.products || [];

        renderFoodCards(topSellers, container);
    } catch (e) {}
}

function trackRecentlyViewed(productId) {
    if (!productId) return;
    recentlyViewedIds = recentlyViewedIds.filter(id => id !== productId);
    recentlyViewedIds.unshift(productId);
    if (recentlyViewedIds.length > 4) recentlyViewedIds.pop();
    localStorage.setItem('ora_recently_viewed', JSON.stringify(recentlyViewedIds));
}

async function loadDeliveryAreasFromDB() {
    const select = document.getElementById('deliveryAreaSelect');
    if (!select) return;

    try {
        const res = await fetch('/api/delivery-areas');
        const data = await res.json();
        const areas = data.areas || [];

        if (areas.length === 0) {
            select.innerHTML = `<option value="20">خدمة التوصيل العامة (20 ج.م)</option>`;
            activeDeliveryFee = 20;
            updateCartUI();
            return;
        }

        select.innerHTML = `<option value="">-- اختر منطقتك لحساب الدليفري --</option>` + 
            areas.map(a => `<option value="${a.deliveryFee}">${escapeHTML(a.areaName)} (${a.deliveryFee} ج.م)</option>`).join('');
    } catch (error) {
        select.innerHTML = `<option value="20">خدمة التوصيل العامة (20 ج.م)</option>`;
    }
}

function updateDeliveryFeeFromSelect() {
    const select = document.getElementById('deliveryAreaSelect');
    if (select) {
        activeDeliveryFee = Number(select.value) || 0;
        updateCartUI();
    }
}

async function applyCouponDiscount() {
    const input = document.getElementById('couponCodeInput');
    const msg = document.getElementById('couponMessage');
    if (!input || !input.value.trim()) return;

    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    try {
        const res = await fetch('/api/coupons/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input.value.trim(), subtotal, customerPhone: currentUserSession ? currentUserSession.phone : '' })
        });

        const data = await res.json();
        if (data.success) {
            appliedCouponData = data.coupon;
            msg.className = 'mt-2 small fw-bold text-success';
            msg.innerText = data.message;
            updateCartUI();
        } else {
            appliedCouponData = null;
            msg.className = 'mt-2 small fw-bold text-danger';
            msg.innerText = data.message;
            updateCartUI();
        }
    } catch (e) {
        msg.innerText = 'تعذر تطبيق الكوبون';
    }
}

function addToCartDirect(cartItem) {
    cart.push(cartItem);
    saveCart();
    updateCartUI();
    toggleCartDrawer();
}

function changeQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('ora_restaurant_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    let subtotal = 0;
    cart.forEach(i => {
        let addonsPrice = i.selectedAddons ? i.selectedAddons.reduce((s, a) => s + (a.price || 0), 0) : 0;
        subtotal += (i.price + addonsPrice) * i.quantity;
    });

    let discount = appliedCouponData ? appliedCouponData.discountAmount : 0;
    let finalTotal = Math.max(0, subtotal - discount + activeDeliveryFee);

    const badge = document.getElementById('cartBadge');
    const drawerCount = document.getElementById('cartDrawerCount');
    const drawerTotal = document.getElementById('cartDrawerTotal');

    if (badge) badge.innerText = totalCount;
    if (drawerCount) drawerCount.innerText = totalCount;
    if (drawerTotal) drawerTotal.innerText = subtotal;

    if (document.getElementById('summarySubtotal')) document.getElementById('summarySubtotal').innerText = `${subtotal} ج.م`;
    if (document.getElementById('summaryDiscount')) document.getElementById('summaryDiscount').innerText = `${discount} ج.م`;
    if (document.getElementById('summaryDeliveryFee')) document.getElementById('summaryDeliveryFee').innerText = `${activeDeliveryFee} ج.م`;
    if (document.getElementById('summaryFinalTotal')) document.getElementById('summaryFinalTotal').innerText = `${finalTotal} ج.م`;

    renderCartDrawerItems();
}

function renderCartDrawerItems() {
    const container = document.getElementById('cartDrawerItems');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<div class="text-center py-5"><span style="font-size:3rem;">🛒</span><p class="text-muted fw-bold mt-2">سلة الطلبات فارغة</p></div>`;
        return;
    }

    container.innerHTML = cart.map((item, index) => {
        let addonsText = item.selectedAddons && item.selectedAddons.length ? item.selectedAddons.map(a => escapeHTML(a.name)).join(', ') : '';
        let sizeText = item.selectedSize ? ` (${escapeHTML(item.selectedSize.name)})` : '';

        return `
            <div class="p-3 mb-2 bg-light rounded-3 border">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <h6 class="fw-bold m-0">${escapeHTML(item.title)}${sizeText}</h6>
                    <span class="text-danger fw-bold">${item.price} ج.م</span>
                </div>
                ${addonsText ? `<small class="text-muted d-block mb-2">إضافات: ${addonsText}</small>` : ''}
                <div class="d-flex align-items-center justify-content-between mt-2">
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0 fw-bold" onclick="changeQty(${index}, -1)">-</button>
                        <span class="fw-bold fs-6">${item.quantity}</span>
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0 fw-bold" onclick="changeQty(${index}, 1)">+</button>
                    </div>
                    <button class="btn btn-sm text-danger" onclick="removeCartItem(${index})">🗑️ حذف</button>
                </div>
            </div>
        `;
    }).join('');
}

function initGPSMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const defaultLat = 30.0444;
    const defaultLng = 31.2357;

    map = L.map('map').setView([defaultLat, defaultLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
    marker.on('dragend', function (e) {
        const position = marker.getLatLng();
        updateLatContainer(position.lat, position.lng);
    });

    updateLatContainer(defaultLat, defaultLng);
    locateUserGPSQuiet();
}

function locateUserGPSQuiet() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (map && marker) {
                map.setView([lat, lng], 16);
                marker.setLatLng([lat, lng]);
            }
            updateLatContainer(lat, lng);
        }, (err) => {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }
}

function locateUserGPS() {
    const btn = document.getElementById('gpsLocateBtn') || event?.target;
    if (btn) {
        btn.disabled = true;
        btn.innerText = '🛰️ جاري تحديد موقعك الدقيق بالـ GPS...';
    }

    if (!navigator.geolocation) {
        alert('متصفحك لا يدعم خاصية تحديد الموقع بالـ GPS تلقائياً. يمكنك تحريك الدبوس يدوياً على الخريطة.');
        resetGpsBtnUI();
        return;
    }

    const optionsHigh = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };
    const optionsLow = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 };

    navigator.geolocation.getCurrentPosition(
        (position) => setGpsPositionSuccess(position.coords.latitude, position.coords.longitude),
        (err) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGpsPositionSuccess(pos.coords.latitude, pos.coords.longitude),
                (err2) => {
                    if (map) {
                        map.locate({ setView: true, maxZoom: 16 });
                        map.once('locationfound', (e) => setGpsPositionSuccess(e.latlng.lat, e.latlng.lng));
                        map.once('locationerror', () => {
                            alert('⚠️ تعذر العثور على موقعك تلقائياً. يمكنك تحريك الدبوس يدوياً على الخريطة.');
                            resetGpsBtnUI();
                        });
                    } else {
                        alert('⚠️ تعذر تحديد موقعك أوتوماتيكياً.');
                        resetGpsBtnUI();
                    }
                },
                optionsLow
            );
        },
        optionsHigh
    );
}

function setGpsPositionSuccess(lat, lng) {
    if (map && marker) {
        map.setView([lat, lng], 16);
        marker.setLatLng([lat, lng]);
        setTimeout(() => map.invalidateSize(), 200);
    }
    updateLatContainer(lat, lng);
    resetGpsBtnUI();
    alert('📍 تم تحديد موقعك الجغرافي بنجاح!');
}

function resetGpsBtnUI() {
    const btn = document.getElementById('gpsLocateBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerText = '🛰️ تحديد موقعي التلقائي بالـ GPS';
    }
}

function updateLatContainer(lat, lng) {
    const latInput = document.getElementById('custLat');
    const lngInput = document.getElementById('custLng');
    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;
}

// 7. تسجيل دخول العميل
async function handleCustomerLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.user) {
            currentUserSession = data.user;
            localStorage.setItem('ora_user_session', JSON.stringify(currentUserSession));
            if (data.token) {
                localStorage.setItem('ora_user_token', data.token);
            }

            if (document.getElementById('custName')) document.getElementById('custName').value = currentUserSession.name || '';
            if (document.getElementById('custPhone')) document.getElementById('custPhone').value = currentUserSession.phone || '';
            if (document.getElementById('custWhatsappPhone')) document.getElementById('custWhatsappPhone').value = currentUserSession.phone || '';

            const loginModalEl = document.getElementById('loginModal');
            if (loginModalEl) {
                const instance = bootstrap.Modal.getInstance(loginModalEl);
                if (instance) instance.hide();
            }

            alert(data.message || `🎉 أهلاً بك يا ${currentUserSession.name}!`);
            checkUserSessionOnHome();
        } else {
            alert(data.message || 'فشل تسجيل الدخول');
        }
    } catch (error) {
        alert('حدث خطأ أثناء الاتصال بالسيرفر. يرجى المحاولة لاحقاً.');
    }
}

// 8. إنشاء حساب جديد
async function handleCustomerRegister(e) {
    e.preventDefault();
    const nameInput = document.getElementById('regCustName');
    const emailInput = document.getElementById('regCustEmail');
    const phoneInput = document.getElementById('regCustPhone');
    const passwordInput = document.getElementById('regCustPassword');

    if (!nameInput || !emailInput || !phoneInput || !passwordInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;

    if (!name || !email || !phone || !password) {
        alert('جميع البيانات مطلوبة لإنشاء حسابك الجديد');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.user) {
            currentUserSession = data.user;
            localStorage.setItem('ora_user_session', JSON.stringify(currentUserSession));
            if (data.token) {
                localStorage.setItem('ora_user_token', data.token);
            }

            if (document.getElementById('custName')) document.getElementById('custName').value = currentUserSession.name || '';
            if (document.getElementById('custPhone')) document.getElementById('custPhone').value = currentUserSession.phone || '';
            if (document.getElementById('custWhatsappPhone')) document.getElementById('custWhatsappPhone').value = currentUserSession.phone || '';

            const loginModalEl = document.getElementById('loginModal');
            if (loginModalEl) {
                const instance = bootstrap.Modal.getInstance(loginModalEl);
                if (instance) instance.hide();
            }

            alert(`🎉 تم إنشاء حسابك بنجاح! أهلاً بك يا ${currentUserSession.name}`);
            checkUserSessionOnHome();
        } else {
            alert(data.message || 'فشل إنشاء الحساب');
        }
    } catch (error) {
        alert('حدث خطأ أثناء الاتصال بالسيرفر. يرجى المحاولة لاحقاً.');
    }
}

window.handleCustomerLogin = handleCustomerLogin;
window.handleCustomerRegister = handleCustomerRegister;

async function logoutCustomerSession() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    localStorage.removeItem('ora_user_session');
    localStorage.removeItem('ora_user_token');
    currentUserSession = null;
    alert('تم تسجيل الخروج بنجاح');
    resetUserHeaderToGuest();
}

// 9. تتبع الطلبات
async function trackOrderByPhoneOrNumber() {
    const input = document.getElementById('trackPhoneOrNumberInput');
    const container = document.getElementById('trackedOrdersListContainer');

    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) {
        container.innerHTML = `<div class="text-center py-4 text-muted fw-bold"><p>يرجى كتابة رقم هاتفك أو كود الطلب بالكامل للاستعلام</p></div>`;
        return;
    }

    container.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-danger" role="status"></div><p class="mt-2 text-muted fw-bold">جاري جلب الطلبات مباشرة من قاعدة البيانات...</p></div>`;

    try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.success && data.orders && data.orders.length > 0) {
            container.innerHTML = data.orders.map(order => {
                const statusBadge = getStatusBadgeHTML(order.status);
                const itemsListHtml = (order.items || []).map(item => `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-2 small">
                        <div>
                            <strong>${escapeHTML(item.title)}</strong>
                            ${item.selectedSize ? ` <span class="badge bg-light text-dark border">(${escapeHTML(item.selectedSize.name)})</span>` : ''}
                            ${item.selectedAddons && item.selectedAddons.length ? `<br><small class="text-muted">إضافات: ${item.selectedAddons.map(a => escapeHTML(a.name)).join(', ')}</small>` : ''}
                        </div>
                        <div class="text-nowrap ms-2">
                            <span class="fw-bold">${item.quantity} × ${item.unitPrice} ج.م</span> = <strong class="text-danger">${item.itemTotal || (item.quantity * item.unitPrice)} ج.م</strong>
                        </div>
                    </div>
                `).join('');

                return `
                    <div class="card shadow-sm border-0 rounded-4 mb-4 overflow-hidden" data-editor-id="order-card-${order.orderNumber}">
                        <div class="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <span class="badge bg-warning text-dark fw-bold me-2">رقم الطلب: ${escapeHTML(order.orderNumber)}</span>
                                <small class="text-white-50">📅 ${new Date(order.createdAt || order.orderDate).toLocaleString('ar-EG')}</small>
                            </div>
                            <div>${statusBadge}</div>
                        </div>
                        <div class="card-body p-4">
                            <h6 class="fw-bold text-muted mb-3">🍔 قائمة الوجبات المجهزة:</h6>
                            <div class="mb-3 bg-light p-3 rounded-3 border">${itemsListHtml}</div>

                            <div class="row g-2 mb-3 align-items-center">
                                <div class="col-md-6 small">
                                    <strong>👤 اسم العميل:</strong> ${escapeHTML(order.customer ? order.customer.name : 'عميل أورا')}<br>
                                    <strong>📞 الهاتف:</strong> ${escapeHTML(order.customer ? order.customer.phone : '-')}<br>
                                    <strong>📍 العنوان:</strong> ${escapeHTML(order.customer ? order.customer.address : '-')}
                                </div>
                                <div class="col-md-6 text-md-end bg-light p-3 rounded-3 border">
                                    <small class="text-muted d-block">إجمالي الحساب الصافي:</small>
                                    <h4 class="fw-black text-danger m-0">${order.totalPrice} ج.م</h4>
                                </div>
                            </div>

                            <div class="d-flex gap-2 flex-wrap pt-2 border-top">
                                <a href="/invoice/${order._id || order.orderNumber}" target="_blank" class="btn btn-outline-dark btn-sm fw-bold rounded-pill px-3">🧾 عرض وصورة الفاتورة</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="alert alert-warning text-center p-4 rounded-4 shadow-sm">
                    <h5 class="fw-bold">❌ لم يتم العثور على طلبات مرتبطة بهذا الرقم [${escapeHTML(query)}]</h5>
                    <p class="small text-muted mb-0">تأكد من كتابة رقم الهاتف الصحيح الذي أتممت به الطلب أو كود الطلب</p>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div class="alert alert-danger text-center p-3">حدث خطأ أثناء جلب الطلبات من السيرفر. حاول مرة أخرى.</div>`;
    }
}

function getStatusBadgeHTML(status) {
    if (status === 'New') return `<span class="badge bg-warning text-dark px-3 py-2 fs-6">جديد في الانتظار ⏳</span>`;
    if (status === 'Reviewed') return `<span class="badge bg-info text-dark px-3 py-2 fs-6">تمت المراجعة 📋</span>`;
    if (status === 'Preparing') return `<span class="badge bg-primary px-3 py-2 fs-6">جاري التحضير بالمطبخ 🧑‍🍳</span>`;
    if (status === 'Ready') return `<span class="badge bg-info px-3 py-2 fs-6">جاهز للتسليم 📦</span>`;
    if (status === 'OutForDelivery') return `<span class="badge bg-primary px-3 py-2 fs-6">خرج للتوصيل 🛵</span>`;
    if (status === 'Delivered') return `<span class="badge bg-success px-3 py-2 fs-6">تم التسليم بنجاح ✅</span>`;
    if (status === 'Cancelled' || status === 'Rejected') return `<span class="badge bg-danger px-3 py-2 fs-6">ملغي / مرفوض ❌</span>`;
    return `<span class="badge bg-secondary px-3 py-2 fs-6">${status}</span>`;
}

window.trackOrderByPhoneOrNumber = trackOrderByPhoneOrNumber;

function listenToSocketEvents() {
    socket.on('categories-updated', () => loadCategoriesFromDB());
    socket.on('products-updated', () => { loadProductsFromDB(); loadDealsFromDB(); loadTopSellersFromDB(); });
    socket.on('settings-updated', (data) => {
        if (data && data.whatsappPhone) whatsappNumberFromDB = data.whatsappPhone;
        applyDynamicThemeAndContent(data);
        loadSettingsFromDB();
    });

    socket.on('visual-element-updated', (data) => {
        if (data && data.elementId && data.overrideData) {
            const targetEl = document.querySelector(`[data-editor-id="${data.elementId}"], [data-content="${data.elementId}"], #${data.elementId}`);
            if (targetEl) {
                const override = data.overrideData;
                if (override.text !== undefined && override.text !== '') {
                    updateTextPreservingIcons(targetEl, override.text);
                }
                if (override.color) {
                    applyTextColorOverride(targetEl, override.color);
                }
                if (override.bgColor) {
                    applyBgColorOverride(targetEl, override.bgColor);
                }
                if (override.fontSize) targetEl.style.setProperty('font-size', override.fontSize, 'important');
                if (override.borderRadius) targetEl.style.setProperty('border-radius', override.borderRadius, 'important');
                if (override.bgImage) {
                    if (targetEl.tagName.toLowerCase() === 'img') {
                        targetEl.src = override.bgImage;
                    } else if (targetEl.classList.contains('hero-wrapper')) {
                        targetEl.style.setProperty('background-image', `linear-gradient(rgba(10, 8, 6, 0.75), rgba(10, 8, 6, 0.85)), url('${override.bgImage}')`, 'important');
                    } else {
                        targetEl.style.setProperty('background-image', `url('${override.bgImage}')`, 'important');
                    }
                }
            }
        }
    });

    socket.on('order-status-updated-global', () => {
        const input = document.getElementById('trackPhoneOrNumberInput');
        if (input && input.value.trim()) trackOrderByPhoneOrNumber();
    });

    socket.on('user-account-status-changed', (data) => {
        if (!currentUserSession || !data || !data.userId) return;

        const currentId = currentUserSession._id || currentUserSession.id;
        if (String(currentId) === String(data.userId)) {
            if (data.action === 'banned' || data.action === 'deleted') {
                localStorage.removeItem('ora_user_session');
                localStorage.removeItem('ora_user_token');
                currentUserSession = null;
                resetUserHeaderToGuest();
                alert(data.message || '⚠️ تم حظر أو حذف حسابك من قبل إدارة النظام.');
                window.location.href = '/index.html';
            } else if (data.action === 'role_updated') {
                alert(data.message || '🎉 تهانينا! تم تحديث رتبة حسابك بنجاح.');
                if (data.role) currentUserSession.role = data.role;
                if (data.token) localStorage.setItem('ora_user_token', data.token);
                localStorage.setItem('ora_user_session', JSON.stringify(currentUserSession));
                
                renderUserSessionUI(currentUserSession);
                checkUserSessionOnHome();
            }
        }
    });
}

// 10. تفاصيل الوجبة والمراجعات
async function initProductDetailsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');

    if (!productId) {
        try {
            const res = await fetch('/api/products?limit=1');
            const data = await res.json();
            if (data.products && data.products.length > 0) {
                productId = data.products[0]._id;
            }
        } catch (e) {}
    }

    if (!productId) return;

    try {
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();

        if (data.success && data.product) {
            currentProductDetailsObj = data.product;
            renderProductDetailsUI(data.product);
            if (data.similarProducts) {
                renderSimilarProducts(data.similarProducts);
            }
            loadProductReviews(data.product._id);
        } else {
            alert('الوجبة غير موجودة أو تم حذفها');
            window.location.href = '/menu.html';
        }
    } catch (e) {
        console.error('Error fetching product details:', e);
    }
}

function renderProductDetailsUI(p) {
    const mainImg = document.getElementById('detailsMainImage');
    const titleEl = document.getElementById('detailsTitle');
    const shortDescEl = document.getElementById('detailsShortDesc');
    const fullDescEl = document.getElementById('detailsFullDesc');
    const catBadge = document.getElementById('detailsCategoryBadge');
    const ratingScore = document.getElementById('detailsRatingScore');
    const reviewsCount = document.getElementById('detailsReviewsCount');
    const stockQty = document.getElementById('detailsStockQty');
    const maxLimit = document.getElementById('detailsMaxLimit');
    const oldPrice = document.getElementById('detailsOldPrice');
    const discountBadge = document.getElementById('detailsDiscountBadge');
    const badgePrice = document.getElementById('detailsBadgePrice');

    if (mainImg) mainImg.src = (p.images && p.images[0]) ? p.images[0] : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1';
    if (titleEl) titleEl.innerText = p.title;
    if (shortDescEl) shortDescEl.innerText = p.shortDescription || p.description || 'وجبة فاخرة محضرة طازجة من مطبخ أبو قورة';
    if (fullDescEl) fullDescEl.innerText = p.fullDescription || p.description || '';
    if (catBadge) catBadge.innerText = (p.categoryId && p.categoryId.name) ? p.categoryId.name : (p.category || 'عام');
    if (ratingScore) ratingScore.innerText = p.rating ? p.rating.toFixed(1) : '5.0';
    if (reviewsCount) reviewsCount.innerText = p.ratingsCount || 0;
    if (stockQty) stockQty.innerText = p.stockQuantity !== undefined ? p.stockQuantity : 100;
    if (maxLimit) maxLimit.innerText = p.maxOrderLimit || 10;

    const displayPrice = p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;
    if (badgePrice) badgePrice.innerText = `${displayPrice} ج.م`;

    if (p.discountPrice > 0 && p.discountPrice < p.price) {
        if (discountBadge) {
            discountBadge.classList.remove('d-none');
            discountBadge.innerText = `خصم ${p.price - p.discountPrice} ج.م`;
        }
        if (oldPrice) {
            oldPrice.classList.remove('d-none');
            oldPrice.innerText = `${p.price} ج.م`;
        }
    } else {
        if (discountBadge) discountBadge.classList.add('d-none');
        if (oldPrice) oldPrice.classList.add('d-none');
    }

    const thumbsRow = document.getElementById('detailsThumbnailsRow');
    if (thumbsRow && p.images && p.images.length > 1) {
        thumbsRow.innerHTML = p.images.map((img, idx) => `
            <img src="${img}" class="rounded border cursor-pointer ${idx === 0 ? 'border-primary' : ''}" style="width: 70px; height: 70px; object-fit: cover;" onclick="document.getElementById('detailsMainImage').src='${img}'">
        `).join('');
    }

    const sizesWrapper = document.getElementById('detailsSizesWrapper');
    const sizesContainer = document.getElementById('detailsSizesContainer');
    if (p.sizes && p.sizes.length > 0) {
        if (sizesWrapper) sizesWrapper.classList.remove('d-none');
        if (sizesContainer) {
            sizesContainer.innerHTML = p.sizes.map((s, idx) => `
                <div class="form-check bg-light p-3 rounded-3 border flex-grow-1 cursor-pointer" onclick="selectDetailsRadio('dsize_${idx}')">
                    <input class="form-check-input details-size-radio" type="radio" name="detailsSize" id="dsize_${idx}" value="${s.price}" data-name="${escapeHTML(s.name)}" ${idx === 0 ? 'checked' : ''} onchange="recalculateDetailsPrice()">
                    <label class="form-check-label fw-bold me-1 cursor-pointer" for="dsize_${idx}">${escapeHTML(s.name)} (<span class="text-danger">${s.price} ج.م</span>)</label>
                </div>
            `).join('');
        }
    } else {
        if (sizesWrapper) sizesWrapper.classList.add('d-none');
    }

    const addonsWrapper = document.getElementById('detailsAddonsWrapper');
    const addonsContainer = document.getElementById('detailsAddonsContainer');
    if (p.addons && p.addons.length > 0) {
        if (addonsWrapper) addonsWrapper.classList.remove('d-none');
        if (addonsContainer) {
            addonsContainer.innerHTML = p.addons.filter(a => !a.isHidden).map((a, idx) => `
                <div class="col-6">
                    <div class="form-check bg-light p-3 rounded-3 border cursor-pointer d-flex align-items-center justify-content-between" onclick="toggleDetailsAddonCheckbox('daddon_${idx}', event)">
                        <div class="d-flex align-items-center gap-2">
                            <input class="form-check-input details-addon-cb" type="checkbox" id="daddon_${idx}" value="${a.price}" data-name="${escapeHTML(a.name)}" onchange="recalculateDetailsPrice()">
                            <label class="form-check-label fw-bold me-1 cursor-pointer m-0" for="daddon_${idx}">${escapeHTML(a.name)}</label>
                        </div>
                        <span class="badge bg-danger text-white">+${a.price} ج.م</span>
                    </div>
                </div>
            `).join('');
        }
    } else {
        if (addonsWrapper) addonsWrapper.classList.add('d-none');
    }

    detailsQty = 1;
    if (document.getElementById('detailsQtyDisplay')) document.getElementById('detailsQtyDisplay').innerText = detailsQty;
    recalculateDetailsPrice();
}

function selectDetailsRadio(id) {
    const radio = document.getElementById(id);
    if (radio) {
        radio.checked = true;
        recalculateDetailsPrice();
    }
}

function toggleDetailsAddonCheckbox(id, event) {
    if (event.target.tagName === 'INPUT') {
        recalculateDetailsPrice();
        return;
    }
    const cb = document.getElementById(id);
    if (cb) {
        cb.checked = !cb.checked;
        recalculateDetailsPrice();
    }
}

function changeDetailsQty(delta) {
    if (!currentProductDetailsObj) return;

    const maxLimit = currentProductDetailsObj.maxOrderLimit || 10;
    const stock = currentProductDetailsObj.stockQuantity !== undefined ? currentProductDetailsObj.stockQuantity : 100;
    const maxAllowed = Math.min(maxLimit, stock);

    detailsQty += delta;
    if (detailsQty < 1) detailsQty = 1;
    if (detailsQty > maxAllowed) {
        detailsQty = maxAllowed;
        alert(`الحد الأقصى المسموح به للطلب هو ${maxAllowed} قطعة`);
    }

    if (document.getElementById('detailsQtyDisplay')) {
        document.getElementById('detailsQtyDisplay').innerText = detailsQty;
    }
    recalculateDetailsPrice();
}

function recalculateDetailsPrice() {
    if (!currentProductDetailsObj) return;

    let basePrice = currentProductDetailsObj.discountPrice > 0 && currentProductDetailsObj.discountPrice < currentProductDetailsObj.price 
        ? currentProductDetailsObj.discountPrice 
        : currentProductDetailsObj.price;

    const checkedSize = document.querySelector('input[name="detailsSize"]:checked');
    if (checkedSize) {
        basePrice = Number(checkedSize.value);
    }

    let addonsSum = 0;
    document.querySelectorAll('.details-addon-cb:checked').forEach(cb => {
        addonsSum += Number(cb.value || 0);
    });

    const unitTotal = basePrice + addonsSum;
    const finalTotal = unitTotal * detailsQty;

    const priceEl = document.getElementById('detailsComputedPrice');
    if (priceEl) {
        priceEl.innerText = `${finalTotal} ج.م`;
    }
}

function addDetailsToCartDirect() {
    if (!currentProductDetailsObj) return;

    const checkedSize = document.querySelector('input[name="detailsSize"]:checked');
    let selectedSize = null;
    let basePrice = currentProductDetailsObj.discountPrice > 0 && currentProductDetailsObj.discountPrice < currentProductDetailsObj.price 
        ? currentProductDetailsObj.discountPrice 
        : currentProductDetailsObj.price;

    if (checkedSize) {
        basePrice = Number(checkedSize.value);
        selectedSize = { name: checkedSize.getAttribute('data-name'), price: basePrice };
    }

    const selectedAddons = [];
    document.querySelectorAll('.details-addon-cb:checked').forEach(cb => {
        selectedAddons.push({
            name: cb.getAttribute('data-name'),
            price: Number(cb.value)
        });
    });

    addToCartDirect({
        _id: currentProductDetailsObj._id,
        title: currentProductDetailsObj.title,
        price: basePrice,
        quantity: detailsQty,
        selectedSize,
        selectedAddons
    });

    alert(`🎉 تم إضافة [${currentProductDetailsObj.title}] إلى سلة مأكولاتك بنجاح!`);
}

function buyNowDirect() {
    addDetailsToCartDirect();
    toggleCartDrawer();
}

async function loadProductReviews(productId) {
    const container = document.getElementById('productReviewsListContainer');
    if (!container) return;

    try {
        const res = await fetch(`/api/reviews/product/${productId}`);
        const data = await res.json();

        if (data.success) {
            const avg = data.averages || {};
            if (document.getElementById('reviewsBigScore')) document.getElementById('reviewsBigScore').innerText = avg.food || '5.0';
            if (document.getElementById('avgFoodScore')) document.getElementById('avgFoodScore').innerText = `${avg.food || 5.0} / 5`;
            if (document.getElementById('avgDeliveryScore')) document.getElementById('avgDeliveryScore').innerText = `${avg.delivery || 5.0} / 5`;
            if (document.getElementById('avgServiceScore')) document.getElementById('avgServiceScore').innerText = `${avg.service || 5.0} / 5`;

            const reviews = data.reviews || [];
            if (reviews.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-muted fw-bold"><p>لا توجد تقييمات سابقة لهذه الوجبة. كن أول من يشارك رأيه!</p></div>`;
                return;
            }

            container.innerHTML = reviews.map(r => `
                <div class="p-3 mb-3 bg-light rounded-3 border">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong class="text-dark">${escapeHTML(r.userName)}</strong>
                        <span class="badge bg-warning text-dark fw-bold">⭐ ${r.foodRating} / 5</span>
                    </div>
                    <p class="text-muted small m-0">${escapeHTML(r.comment || 'بدون تعليق')}</p>
                    <small class="text-muted d-block mt-2" style="font-size: 0.75rem;">📅 ${new Date(r.createdAt).toLocaleDateString('ar-EG')}</small>
                </div>
            `).join('');
        }
    } catch (e) {}
}

async function submitCustomerReviewWithImages(e) {
    e.preventDefault();
    if (!currentProductDetailsObj) return;

    const foodRating = document.getElementById('reviewFoodRating') ? document.getElementById('reviewFoodRating').value : 5;
    const deliverySpeedRating = document.getElementById('reviewDeliveryRating') ? document.getElementById('reviewDeliveryRating').value : 5;
    const serviceRating = document.getElementById('reviewServiceRating') ? document.getElementById('reviewServiceRating').value : 5;
    const comment = document.getElementById('reviewComment') ? document.getElementById('reviewComment').value.trim() : '';

    const userName = currentUserSession ? currentUserSession.name : (prompt('يرجى إدخال اسمك الكريم واعتماد التقييم:') || 'عميل أورا');

    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: currentProductDetailsObj._id,
                userName,
                foodRating,
                deliverySpeedRating,
                serviceRating,
                comment
            })
        });

        const data = await res.json();
        if (data.success) {
            alert('🎉 شكراً لك! تم إضافة وتقييم تجربتك بنجاح.');
            if (document.getElementById('reviewComment')) document.getElementById('reviewComment').value = '';
            loadProductReviews(currentProductDetailsObj._id);
        } else {
            alert(data.message || 'فشل إرسال التقييم');
        }
    } catch (err) {
        alert('تعذر الاتصال بالسيرفر لإرسال التقييم');
    }
}

function renderSimilarProducts(products) {
    const container = document.getElementById('similarProductsContainer');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted"><p>لا توجد مقترحات مشابهة حالياً</p></div>`;
        return;
    }

    renderFoodCards(products, container);
}

window.initProductDetailsPage = initProductDetailsPage;
window.changeDetailsQty = changeDetailsQty;
window.recalculateDetailsPrice = recalculateDetailsPrice;
window.addDetailsToCartDirect = addDetailsToCartDirect;
window.buyNowDirect = buyNowDirect;
window.submitCustomerReviewWithImages = submitCustomerReviewWithImages;
window.selectDetailsRadio = selectDetailsRadio;
window.toggleDetailsAddonCheckbox = toggleDetailsAddonCheckbox;