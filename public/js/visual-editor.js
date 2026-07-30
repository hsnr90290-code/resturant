// ==============================================================================
// محرك التعديل البصري المباشر والنقر الأيمن - Enterprise Universal Live Visual Editor & Hostinger Builder
// Ultimate Perfect Fix: Prevents Brand Text Erasure, Prevents Duplicate/Double Images inside Logo,
// Separates Header Logo & Text cleanly, Allows Free Adding/Deleting of Elements with MongoDB & Socket.io
// ==============================================================================

(function () {
    let isSuperAdminSession = false;
    let activeEditingElement = null;
    let activeEditorId = '';
    let editorModalPanel = null;
    let isUploadingImage = false;
    let pendingHiddenState = false;

    // ⚡ حقن CSS صارم لإلغاء أية صور خلفية أو Pseudo-elements (::before / ::after) قديمة على اللوجو
    function injectLogoCleanupStyles() {
        if (document.getElementById('logo-cleaner-override-style')) return;
        const styleFix = document.createElement('style');
        styleFix.id = 'logo-cleaner-override-style';
        styleFix.innerHTML = `
            [data-editor-id="global_header_site_logo"],
            [data-editor-id="global_footer_site_logo"],
            .custom-replaced-logo-img,
            .logo-circle,
            .logo-badge {
                background-image: none !important;
            }
            [data-editor-id="global_header_site_logo"]::before,
            [data-editor-id="global_header_site_logo"]::after,
            [data-editor-id="global_footer_site_logo"]::before,
            [data-editor-id="global_footer_site_logo"]::after,
            .custom-replaced-logo-img::before,
            .custom-replaced-logo-img::after {
                content: none !important;
                display: none !important;
                background: none !important;
                background-image: none !important;
            }
        `;
        document.head.appendChild(styleFix);
    }

    // 1. التثبيت الفوري عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', () => {
        injectLogoCleanupStyles();
        scanAndTagGlobalHeaderElements();
        retagAllEditableElementsForOverrides();
        checkSuperAdminVisualPermissions();
        listenToVisualSocketUpdates();
        loadAndApplyAllVisualOverrides();
    });

    // ⚡ إعادة حساب/تثبيت data-editor-id لكل العناصر القابلة للتعديل عند كل تحميل صفحة
    function retagAllEditableElementsForOverrides() {
        try {
            const candidates = document.querySelectorAll(
                '[data-editor-id], [data-content], img, .logo, [class*="logo"], i, svg, h1, h2, h3, h4, h5, h6, p, button, a, .hero-wrapper, header, footer'
            );
            candidates.forEach(el => getOrAssignUniversalId(el));
        } catch (e) {}
    }

    // ⚡ دالة التوسيم الذكي والدقيق للوجو الهيدر ونص اسم المطعم بشكل مستقل تماماً
    function scanAndTagGlobalHeaderElements() {
        try {
            // 1. استهداف نص اسم المطعم (مثل "ابو قورة" أو "أبو قورة") بجوار اللوجو بـ ID مستقل خاص به فقط
            const headerElements = document.querySelectorAll('header *, nav *, .navbar-brand *, footer *');
            headerElements.forEach(el => {
                const text = (el.innerText || el.textContent || '').trim();
                const tag = el.tagName.toLowerCase();
                if ((text.includes('ابو') || text.includes('أبو') || text.includes('قورة')) && tag !== 'img' && tag !== 'svg' && tag !== 'i') {
                    if (!el.getAttribute('data-editor-id')) {
                        el.setAttribute('data-editor-id', 'global_header_brand_text');
                    }
                }
            });

            // 2. استهداف عنصر صورة/أيقونة اللوجو فقط دون الحاوية الكبيرة لمنع تكرار الصور أو مسح النص
            const headerLogos = document.querySelectorAll('header .logo, nav .logo, .navbar-brand, footer .logo, .site-logo');
            headerLogos.forEach(el => {
                const innerImgOrIcon = el.querySelector('img, svg, i, .logo-circle, .logo-badge');
                const target = innerImgOrIcon || (el.tagName.toLowerCase() === 'img' ? el : null);
                if (target && !target.getAttribute('data-editor-id')) {
                    const isFooter = !!el.closest('footer');
                    target.setAttribute('data-editor-id', isFooter ? 'global_footer_site_logo' : 'global_header_site_logo');
                }
            });
        } catch (e) {}
    }

    async function checkSuperAdminVisualPermissions() {
        try {
            const savedToken = localStorage.getItem('ora_user_token');
            const headers = { 'Content-Type': 'application/json' };
            if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

            const res = await fetch('/api/auth/me', { headers });
            const data = await res.json();

            if (data.success && data.user && (data.user.role === 'superadmin' || data.user.role === 'admin' || data.user.role === 'staff')) {
                isSuperAdminSession = true;
                initVisualContextMenuListeners();
            }
        } catch (e) {
            console.warn('Visual Editor Session Check Bypassed:', e.message);
        }
    }

    // 2. إيقاف قائمة الكليك يمين الافتراضية وتفعيل قائمة التحكم المباشرة
    function initVisualContextMenuListeners() {
        createFloatingEditorModal();

        document.body.addEventListener('contextmenu', (e) => {
            if (!isSuperAdminSession) return;

            const editableTarget = e.target.closest('[data-editor-id], [data-content], img, .logo, [class*="logo"], i, svg, h1, h2, h3, h4, h5, h6, p, button, a, .hero-wrapper, header, footer, [data-custom-element]');

            if (editableTarget) {
                e.preventDefault();
                e.stopPropagation();

                activeEditingElement = editableTarget;
                activeEditorId = getOrAssignUniversalId(editableTarget);

                openHostingerEditorPanel(e.clientX, e.clientY, editableTarget);
            }
        });

        document.body.addEventListener('mouseover', (e) => {
            if (!isSuperAdminSession) return;
            const editableTarget = e.target.closest('[data-editor-id], [data-content], img, .logo, [class*="logo"], i, svg, h1, h2, h3, h4, h5, h6, button, a, [data-custom-element]');
            if (editableTarget && !editableTarget.classList.contains('visual-editor-active-outline')) {
                editableTarget.style.outline = '2px dashed #0066ff';
                editableTarget.style.outlineOffset = '2px';
                editableTarget.style.cursor = 'pointer';
                editableTarget.title = '🖱️ اضغط كليك يمين لتنسيق، استبدال، أو حذف/إضافة هذا العنصر';
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            if (!isSuperAdminSession) return;
            const editableTarget = e.target.closest('[data-editor-id], [data-content], img, .logo, [class*="logo"], i, svg, h1, h2, h3, h4, h5, h6, button, a, [data-custom-element]');
            if (editableTarget) {
                editableTarget.style.outline = '';
                editableTarget.style.outlineOffset = '';
            }
        });
    }

    function getOrAssignUniversalId(el) {
        if (el.getAttribute('data-editor-id')) return el.getAttribute('data-editor-id');
        if (el.getAttribute('data-content')) return el.getAttribute('data-content');
        if (el.id) return el.id;

        const cls = (el.className || '').toString().toLowerCase();
        const parentCls = el.parentElement ? (el.parentElement.className || '').toString().toLowerCase() : '';
        const src = (el.src || '').toLowerCase();
        const tag = el.tagName.toLowerCase();
        const text = (el.innerText || el.textContent || '').trim();

        // ⚡ تمييز نص اسم المطعم بالهيدر بوضوح حتى لا يتداخل مع اللوجو
        if ((text.includes('ابو') || text.includes('أبو') || text.includes('قورة')) && tag !== 'img' && tag !== 'svg' && tag !== 'i') {
            const brandTextId = 'global_header_brand_text';
            el.setAttribute('data-editor-id', brandTextId);
            return brandTextId;
        }

        // ⚡ تمييز الشعار بالهيدر أو الفوتر بمعرف عالمي ثابت عبر كل الصفحات
        if ((tag === 'img' || tag === 'svg' || tag === 'i') && (cls.includes('logo') || parentCls.includes('logo') || src.includes('logo') || el.closest('header .logo, nav .logo, .navbar-brand, footer .logo'))) {
            const isFooter = !!el.closest('footer');
            const universalLogoId = isFooter ? 'global_footer_site_logo' : 'global_header_site_logo';
            el.setAttribute('data-editor-id', universalLogoId);
            return universalLogoId;
        }

        const parentTag = el.parentElement ? el.parentElement.tagName.toLowerCase() : 'root';
        const indexInParent = Array.from(el.parentElement ? el.parentElement.children : []).indexOf(el);
        const textSample = text.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '-');
        
        const pagePath = window.location.pathname.replace(/[^a-zA-Z0-9]/g, '_') || 'home';
        const autoId = `page_${pagePath}_${parentTag}_${tag}_${indexInParent}_${textSample || 'elem'}`;
        el.setAttribute('data-editor-id', autoId);
        return autoId;
    }

    // 3. بناء لوحة التحكم الطافية بنمط Hostinger Builder
    function createFloatingEditorModal() {
        if (document.getElementById('hostingerVisualEditorModal')) return;

        editorModalPanel = document.createElement('div');
        editorModalPanel.id = 'hostingerVisualEditorModal';
        editorModalPanel.style.cssText = `
            position: fixed;
            display: none;
            width: 360px;
            max-height: 90vh;
            overflow-y: auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.35);
            border: 1px solid #cbd5e1;
            z-index: 100000;
            padding: 18px;
            font-family: 'Tajawal', sans-serif;
            direction: rtl;
            text-align: right;
            backdrop-filter: blur(10px);
        `;

        editorModalPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                <h6 style="margin: 0; font-weight: 800; color: #0f172a; font-size: 0.95rem;">✏️ تعديل وتصميم العنصر (Hostinger Live)</h6>
                <button id="closeVisualModalBtn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">📝 النص / الكلام الداخلي:</label>
                <textarea id="veTextInput" rows="2" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; font-family: inherit;"></textarea>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">🎨 لون النص:</label>
                    <input type="color" id="veTextColorInput" style="width: 100%; height: 36px; border: none; border-radius: 8px; cursor: pointer;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">🖌️ لون الخلفية:</label>
                    <input type="color" id="veBgColorInput" style="width: 100%; height: 36px; border: none; border-radius: 8px; cursor: pointer;">
                </div>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">📐 حجم الخط (px):</label>
                    <input type="number" id="veFontSizeInput" placeholder="16" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">🔍 حجم الصورة/الأيقونة (px):</label>
                    <input type="number" id="veIconSizeInput" placeholder="60" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
                </div>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">⭕ الحواف (px):</label>
                <input type="number" id="veBorderRadiusInput" placeholder="12" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
            </div>

            <div style="margin-bottom: 12px;" id="veBgImageRow">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">🖼️ صورة اللوجو / الأيقونة الجديد:</label>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="veBgImageInput" placeholder="رابط الصورة (https://...)" style="flex: 1; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem;">
                    <label for="veFileInput" style="background: #2563eb; color: #ffffff; padding: 7px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; white-space: nowrap;">
                        📁 رفع صورة
                    </label>
                    <input type="file" id="veFileInput" accept="image/*" style="display: none;">
                </div>
                <div id="veUploadStatus" style="display: none; font-size: 0.75rem; font-weight: bold; margin-top: 4px;"></div>
            </div>

            <!-- قسم إضافة عناصر جديدة بحرية مثل Hostinger Builder -->
            <div style="margin-bottom: 12px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                <button id="toggleAddNewElementBoxBtn" type="button" style="width: 100%; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 8px; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; margin-bottom: 8px;">
                    ➕ إضافة عنصر جديد بجوار هذا العنصر
                </button>
                <div id="addNewElementSubBox" style="display: none; background: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">نوع العنصر الجديد:</label>
                    <select id="newElemTypeSelect" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; margin-bottom: 8px;">
                        <option value="text">📝 نص / عنوان جديد</option>
                        <option value="image">🖼️ صورة / لوجو جديد</option>
                        <option value="button">🔘 زر جديد</option>
                        <option value="box">📦 حاوية / كارت جديد</option>
                    </select>

                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #334155; margin-bottom: 4px;">محتوى / رابط العنصر الجديد:</label>
                    <input type="text" id="newElemContentInput" placeholder="أدخل النص أو رابط الصورة..." style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; margin-bottom: 8px;">

                    <button id="confirmAddNewElemBtn" type="button" style="width: 100%; background: #2563eb; color: #ffffff; border: none; padding: 7px; border-radius: 8px; font-weight: bold; font-size: 0.8rem; cursor: pointer;">
                        🚀 إنشاء ونشر العنصر الجديد فوراً
                    </button>
                </div>
            </div>

            <button id="veHideToggleBtn" type="button" style="width: 100%; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 8px; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer; margin-bottom: 10px;">
                🗑️ حذف / إخفاء هذا العنصر
            </button>

            <button id="saveVisualElementBtn" style="width: 100%; background: #16a34a; color: #ffffff; border: none; padding: 10px; border-radius: 10px; font-weight: 800; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 12px rgba(22,163,74,0.3); transition: all 0.2s;">
                💾 حفظ التعديلات فوراً لكل الزوار 🚀
            </button>
        `;

        document.body.appendChild(editorModalPanel);

        document.getElementById('closeVisualModalBtn').addEventListener('click', closeHostingerPanel);
        document.getElementById('saveVisualElementBtn').addEventListener('click', saveActiveElementToDB);

        document.getElementById('veHideToggleBtn').addEventListener('click', () => {
            pendingHiddenState = !pendingHiddenState;
            if (activeEditingElement) applyHiddenStateToElement(activeEditingElement, pendingHiddenState);
            updateHideToggleBtnLabel();
        });

        // زر فتح خيارات إضافة عنصر جديد
        document.getElementById('toggleAddNewElementBoxBtn').addEventListener('click', () => {
            const subBox = document.getElementById('addNewElementSubBox');
            subBox.style.display = subBox.style.display === 'none' ? 'block' : 'none';
        });

        // إنشاء عنصر جديد في الصفحة ودعم حفظه
        document.getElementById('confirmAddNewElemBtn').addEventListener('click', createAndAddNewCustomElement);

        // رفع الصورة المباشر
        document.getElementById('veFileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            isUploadingImage = true;
            const statusEl = document.getElementById('veUploadStatus');
            statusEl.style.display = 'block';
            statusEl.style.color = '#2563eb';
            statusEl.innerText = '⏳ جاري رفع الصورة وتأمين الرابط الدائم...';

            const tempLocalUrl = URL.createObjectURL(file);
            document.getElementById('veBgImageInput').value = tempLocalUrl;
            applyImageToElement(activeEditingElement, tempLocalUrl);

            const formData = new FormData();
            formData.append('image', file);

            try {
                const savedToken = localStorage.getItem('ora_user_token');
                const headers = {};
                if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers,
                    body: formData
                });

                const data = await res.json();

                if (data.success && data.url) {
                    document.getElementById('veBgImageInput').value = data.url;
                    applyImageToElement(activeEditingElement, data.url);
                    statusEl.style.color = '#16a34a';
                    statusEl.innerText = '✅ تم الرفع بنجاح!';
                } else {
                    statusEl.style.color = '#dc2626';
                    statusEl.innerText = '❌ ' + (data.message || 'فشل رفع الصورة');
                }
            } catch (err) {
                statusEl.style.color = '#dc2626';
                statusEl.innerText = '❌ خطأ في الاتصال بالسيرفر';
            } finally {
                isUploadingImage = false;
            }
        });

        document.getElementById('veTextInput').addEventListener('input', (e) => {
            if (activeEditingElement) updateTextPreservingIcons(activeEditingElement, e.target.value);
        });

        document.getElementById('veTextColorInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) applyTextColorOverride(activeEditingElement, e.target.value);
        });

        document.getElementById('veBgColorInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) applyBgColorOverride(activeEditingElement, e.target.value);
        });

        document.getElementById('veFontSizeInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) activeEditingElement.style.setProperty('font-size', `${e.target.value}px`, 'important');
        });

        document.getElementById('veIconSizeInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                applyIconSizeOverride(activeEditingElement, `${e.target.value}px`);
            }
        });

        document.getElementById('veBorderRadiusInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) activeEditingElement.style.setProperty('border-radius', `${e.target.value}px`, 'important');
        });

        document.getElementById('veBgImageInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) applyImageToElement(activeEditingElement, e.target.value);
        });
    }

    // ⚡ إضافة عنصر جديد بحرية (Hostinger-Style Builder)
    async function createAndAddNewCustomElement() {
        if (!activeEditingElement) return;

        const type = document.getElementById('newElemTypeSelect').value;
        const val = document.getElementById('newElemContentInput').value.trim();
        const customId = `custom_added_${Date.now()}`;

        let newEl;
        if (type === 'image') {
            newEl = document.createElement('img');
            newEl.src = val || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=300';
            newEl.style.cssText = 'max-width: 150px; height: auto; border-radius: 12px; display: inline-block; margin: 6px;';
        } else if (type === 'button') {
            newEl = document.createElement('button');
            newEl.innerText = val || 'زر جديد ✨';
            newEl.style.cssText = 'background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-weight: bold; margin: 6px;';
        } else if (type === 'box') {
            newEl = document.createElement('div');
            newEl.innerText = val || 'كارت / صندوق محتوى جديد 📦';
            newEl.style.cssText = 'background: #f8fafc; border: 1px dashed #cbd5e1; padding: 14px; border-radius: 12px; margin: 8px 0;';
        } else {
            newEl = document.createElement('p');
            newEl.innerText = val || 'نص جديد مضاف بحرية 📝';
            newEl.style.cssText = 'font-size: 1rem; color: #1e293b; margin: 6px 0; font-weight: 600;';
        }

        newEl.setAttribute('data-editor-id', customId);
        newEl.setAttribute('data-custom-element', 'true');

        // إدراج العنصر بجوار العنصر المحدد حالياً
        if (activeEditingElement.parentNode) {
            activeEditingElement.parentNode.insertBefore(newEl, activeEditingElement.nextSibling);
        } else {
            document.body.appendChild(newEl);
        }

        // حفظ العنصر الجديد مباشرة في قاعدة البيانات
        const payload = {
            elementId: customId,
            text: type !== 'image' ? (val || newEl.innerText) : '',
            bgImage: type === 'image' ? (val || newEl.src) : '',
            fontSize: type === 'text' ? '16px' : '',
            isCustomAdded: true,
            tagName: newEl.tagName.toLowerCase(),
            parentEditorId: activeEditorId
        };

        try {
            const savedToken = localStorage.getItem('ora_user_token');
            const headers = { 'Content-Type': 'application/json' };
            if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

            await fetch('/api/settings/element', {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload)
            });

            alert('🎉 تم إنشاء العنصر الجديد بنجاح وحفظه في MongoDB!');
            document.getElementById('addNewElementSubBox').style.display = 'none';
            document.getElementById('newElemContentInput').value = '';
            closeHostingerPanel();
            loadAndApplyAllVisualOverrides();
        } catch (e) {
            alert('تم إدراج العنصر في الواجهة، يرجى حفظ الصفحة لحفظه نهائياً');
        }
    }

    function applyIconSizeOverride(element, sizePx) {
        if (!element || !sizePx) return;
        
        const targetImg = element.tagName.toLowerCase() === 'img' ? element : element.querySelector('img');
        if (targetImg) {
            targetImg.style.setProperty('width', sizePx, 'important');
            targetImg.style.setProperty('height', sizePx, 'important');
            targetImg.style.setProperty('max-width', sizePx, 'important');
            targetImg.style.setProperty('max-height', sizePx, 'important');
            targetImg.style.setProperty('object-fit', 'cover', 'important');
        } else {
            element.style.setProperty('width', sizePx, 'important');
            element.style.setProperty('height', sizePx, 'important');
            element.style.setProperty('font-size', sizePx, 'important');
        }
    }

    // ⚡ دالة تنظيف وتطهير أية صور خلفية CSS قديمة على العنصر وأسلافه المقربين الشاملة
    function purgeBackgroundImages(el) {
        if (!el) return;
        
        injectLogoCleanupStyles();

        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('background', 'none', 'important');

        let parent = el.parentElement;
        let count = 0;
        while (parent && count < 5) {
            parent.style.setProperty('background-image', 'none', 'important');
            parent = parent.parentElement;
            count++;
        }
    }

    // ⚡ دالة استبدال اللوجو/الأيقونة بنظافة تامة وإلغاء أي دمج أو صور افتراضية قديمة 100%
    function applyImageToElement(element, imageUrl) {
        if (!element || !imageUrl) return;

        injectLogoCleanupStyles();

        // 1. تطهير وإلغاء أي صور خلفية CSS على العنصر وأبيه وجده (لمنع ظهور الخلفية القديمة)
        purgeBackgroundImages(element);

        const tag = element.tagName.toLowerCase();

        // 2. إذا كان العنصر نفسه صورة <img>
        if (tag === 'img') {
            element.src = imageUrl;
            if (element.srcset) element.srcset = '';
            element.style.setProperty('display', 'block', 'important');
            element.style.setProperty('width', '100%', 'important');
            element.style.setProperty('height', '100%', 'important');
            element.style.setProperty('object-fit', 'cover', 'important');
            element.style.setProperty('background-color', '#ffffff', 'important');
            
            // ⚡ الحسم الجذري: حذف كل الصور والـ picture القديمة الشقيقة داخل نفس الأب قاطبةً!
            if (element.parentNode) {
                const siblings = element.parentNode.querySelectorAll('img, picture, svg');
                siblings.forEach(sb => {
                    if (sb !== element) {
                        sb.remove();
                    }
                });
            }
            return;
        }

        // 3. إذا كان العنصر أيقونة (i أو svg)
        if (tag === 'i' || tag === 'svg') {
            const parent = element.parentNode;
            const editorId = element.getAttribute('data-editor-id');

            // ⚡ حذف كل الصور القديمة السابقة الشقيقة داخل الأب تماماً
            if (parent) {
                const oldImgs = parent.querySelectorAll('img, picture, svg, i');
                oldImgs.forEach(imgEl => {
                    if (imgEl !== element) imgEl.remove();
                });
            }

            const newImg = document.createElement('img');
            newImg.className = 'custom-replaced-logo-img ' + (element.className || '');
            if (editorId) newImg.setAttribute('data-editor-id', editorId);
            newImg.src = imageUrl;
            newImg.style.setProperty('display', 'block', 'important');
            newImg.style.setProperty('width', '100%', 'important');
            newImg.style.setProperty('height', '100%', 'important');
            newImg.style.setProperty('object-fit', 'cover', 'important');
            newImg.style.setProperty('border-radius', 'inherit', 'important');
            newImg.style.setProperty('background-color', '#ffffff', 'important');

            if (parent) {
                parent.replaceChild(newImg, element);
            }
            activeEditingElement = newImg;
            return;
        }

        // 4. إذا كان العنصر حاوياً (مثل .logo-badge, .logo-circle, .navbar-brand أو كارت المربع):
        element.style.setProperty('overflow', 'hidden', 'important');
        element.style.setProperty('background-color', '#ffffff', 'important');

        // إخفاء وحذف كل الأيقونات والنصوص والأوسمة القديمة المجاورة داخل الحاوية
        const oldChildren = element.querySelectorAll('i, svg, .icon, [class*="fa-"], [class*="bi-"], span, p, div, a, picture');
        oldChildren.forEach(child => {
            if (!child.querySelector('img.custom-replaced-logo-img')) {
                child.style.setProperty('display', 'none', 'important');
            }
        });

        // ⚡ حذف جميع الصور والوسوم القديمة كلياً وإبقاء صورة واحدة فقط مرفوعة حديثاً
        const allImgs = Array.from(element.querySelectorAll('img, picture'));
        allImgs.forEach(imgEl => imgEl.remove());

        const mainImg = document.createElement('img');
        mainImg.className = 'custom-replaced-logo-img';
        const editorId = element.getAttribute('data-editor-id');
        if (editorId) mainImg.setAttribute('data-editor-id', editorId);

        mainImg.src = imageUrl;
        mainImg.style.setProperty('display', 'block', 'important');
        mainImg.style.setProperty('width', '100%', 'important');
        mainImg.style.setProperty('height', '100%', 'important');
        mainImg.style.setProperty('object-fit', 'cover', 'important');
        mainImg.style.setProperty('border-radius', 'inherit', 'important');
        mainImg.style.setProperty('background-color', '#ffffff', 'important');

        element.appendChild(mainImg);
    }

    function applyTextColorOverride(element, colorVal) {
        if (!element || !colorVal) return;
        element.style.setProperty('color', colorVal, 'important');
        element.style.setProperty('-webkit-text-fill-color', colorVal, 'important');
    }

    function applyBgColorOverride(element, bgColorVal) {
        if (!element || !bgColorVal) return;
        element.style.setProperty('background-color', bgColorVal, 'important');
        element.style.setProperty('background-image', 'none', 'important');
    }

    function updateTextPreservingIcons(element, newText) {
        const hasSubElements = element.querySelector('i, svg, .icon, .badge, span, img');
        if (hasSubElements) {
            let replaced = false;
            element.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                    node.textContent = ' ' + newText + ' ';
                    replaced = true;
                }
            });
            if (!replaced) element.appendChild(document.createTextNode(' ' + newText));
        } else {
            element.innerText = newText;
        }
    }

    function openHostingerEditorPanel(posX, posY, element) {
        if (!editorModalPanel) return;

        const currentStyles = window.getComputedStyle(element);
        const childImg = element.tagName.toLowerCase() === 'img' ? element : element.querySelector('img');
        const statusEl = document.getElementById('veUploadStatus');
        if (statusEl) statusEl.style.display = 'none';

        document.getElementById('veTextInput').value = extractCleanText(element);
        document.getElementById('veTextColorInput').value = rgbToHex(currentStyles.color) || '#1a1816';
        document.getElementById('veBgColorInput').value = rgbToHex(currentStyles.backgroundColor) || '#ffffff';
        document.getElementById('veFontSizeInput').value = parseInt(currentStyles.fontSize, 10) || '';
        document.getElementById('veIconSizeInput').value = childImg ? (parseInt(currentStyles.width, 10) || '') : '';
        document.getElementById('veBorderRadiusInput').value = parseInt(currentStyles.borderRadius, 10) || '';
        
        document.getElementById('veBgImageInput').value = childImg ? childImg.src : (extractBgUrl(currentStyles.backgroundImage) || '');

        pendingHiddenState = element.getAttribute('data-visual-hidden') === 'true' || element.style.display === 'none';
        updateHideToggleBtnLabel();

        let leftPos = Math.min(posX + 10, window.innerWidth - 380);
        let topPos = Math.min(posY + 10, window.innerHeight - 520);

        editorModalPanel.style.left = `${Math.max(10, leftPos)}px`;
        editorModalPanel.style.top = `${Math.max(10, topPos)}px`;
        editorModalPanel.style.display = 'block';
    }

    function updateHideToggleBtnLabel() {
        const btn = document.getElementById('veHideToggleBtn');
        if (!btn) return;
        if (pendingHiddenState) {
            btn.innerText = '♻️ إظهار هذا العنصر مرة أخرى';
            btn.style.background = '#dcfce7';
            btn.style.color = '#15803d';
            btn.style.borderColor = '#bbf7d0';
        } else {
            btn.innerText = '🗑️ حذف / إخفاء هذا العنصر';
            btn.style.background = '#fee2e2';
            btn.style.color = '#b91c1c';
            btn.style.borderColor = '#fecaca';
        }
    }

    function extractBgUrl(bgStr) {
        if (!bgStr || bgStr === 'none') return '';
        const match = bgStr.match(/url\(['"]?(.*?)['"]?\)/);
        return match ? match[1] : '';
    }

    function extractCleanText(element) {
        let text = '';
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
        });
        return text.trim() || element.innerText || '';
    }

    function closeHostingerPanel() {
        if (editorModalPanel) editorModalPanel.style.display = 'none';
    }

    // 5. حفظ التعديل بـ MongoDB Atlas
    async function saveActiveElementToDB() {
        if (!activeEditorId || !activeEditingElement) return;

        const bgImgVal = document.getElementById('veBgImageInput').value.trim();

        if (isUploadingImage || bgImgVal.startsWith('blob:')) {
            alert('⏳ يرجى الانتظار ثوانٍ معدودة حتى ينتهي رفع الصورة وتأمين الرابط الدائم!');
            return;
        }

        const saveBtn = document.getElementById('saveVisualElementBtn');
        saveBtn.disabled = true;
        saveBtn.innerText = '⏳ جاري الحفظ والتنسيق الشامل...';

        const payload = {
            elementId: activeEditorId,
            text: document.getElementById('veTextInput').value,
            color: document.getElementById('veTextColorInput').value,
            bgColor: document.getElementById('veBgColorInput').value,
            fontSize: document.getElementById('veFontSizeInput').value ? `${document.getElementById('veFontSizeInput').value}px` : '',
            iconSize: document.getElementById('veIconSizeInput').value ? `${document.getElementById('veIconSizeInput').value}px` : '',
            borderRadius: document.getElementById('veBorderRadiusInput').value ? `${document.getElementById('veBorderRadiusInput').value}px` : '',
            bgImage: bgImgVal,
            isHidden: pendingHiddenState
        };

        try {
            const savedToken = localStorage.getItem('ora_user_token');
            const headers = { 'Content-Type': 'application/json' };
            if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`;

            const res = await fetch('/api/settings/element', {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                alert(`🎉 تم حفظ وتنسيق العنصر [${activeEditorId}] بنجاح!`);
                closeHostingerPanel();
                scanAndTagGlobalHeaderElements();
                loadAndApplyAllVisualOverrides();
            } else {
                alert(data.message || 'فشل حفظ التعديل البصري');
            }
        } catch (e) {
            alert('حدث خطأ في الاتصال بالسيرفر أثناء حفظ التعديل البصري');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 حفظ التعديلات فوراً لكل الزوار 🚀';
        }
    }

    // 6. تطبيق كافة التعديلات عند تحميل أي صفحة وإنشاء العناصر المضافة جديداً
    async function loadAndApplyAllVisualOverrides() {
        try {
            scanAndTagGlobalHeaderElements();
            retagAllEditableElementsForOverrides();

            const res = await fetch('/api/settings');
            const data = await res.json();

            if (data.success && data.settings && data.settings.elementOverrides) {
                const overrides = data.settings.elementOverrides;
                Object.keys(overrides).forEach(key => {
                    applySingleOverrideToDOM(key, overrides[key]);
                });
            }
        } catch (e) {}
    }

    function listenToVisualSocketUpdates() {
        if (typeof io === 'undefined') return;
        const socket = io();

        socket.on('visual-element-updated', (data) => {
            if (data && data.elementId && data.overrideData) {
                applySingleOverrideToDOM(data.elementId, data.overrideData);
            }
        });
    }

    // ⚡ تطبيق التعديل على العنصر المحدد أو إنشائه إن كان عنصراً جديداً مضافاً
    function applySingleOverrideToDOM(elementId, override) {
        if (!elementId || !override) return;

        let selector = `[data-editor-id="${elementId}"], [data-content="${elementId}"]`;
        if (/^[A-Za-z][\w-]*$/.test(elementId)) {
            selector += `, #${elementId}`;
        }

        let targetElements = document.querySelectorAll(selector);

        // إنشاء العنصر المضاف جديداً إن لم يكن موجوداً في الـ DOM
        if ((!targetElements || targetElements.length === 0) && override.isCustomAdded) {
            const tag = override.tagName || 'div';
            const newEl = document.createElement(tag);
            newEl.setAttribute('data-editor-id', elementId);
            newEl.setAttribute('data-custom-element', 'true');

            let parentContainer = document.body;
            if (override.parentEditorId) {
                const p = document.querySelector(`[data-editor-id="${override.parentEditorId}"]`);
                if (p && p.parentNode) parentContainer = p.parentNode;
            }

            parentContainer.appendChild(newEl);
            targetElements = [newEl];
        }

        if (!targetElements || targetElements.length === 0) return;

        targetElements.forEach(targetEl => {
            if (override.text !== undefined && override.text !== '' && !override.bgImage) {
                updateTextPreservingIcons(targetEl, override.text);
            }

            if (override.color) applyTextColorOverride(targetEl, override.color);
            if (override.bgColor && !override.bgImage) applyBgColorOverride(targetEl, override.bgColor);
            if (override.fontSize) targetEl.style.setProperty('font-size', override.fontSize, 'important');
            if (override.iconSize) applyIconSizeOverride(targetEl, override.iconSize);
            if (override.borderRadius) targetEl.style.setProperty('border-radius', override.borderRadius, 'important');
            if (override.bgImage && !override.bgImage.startsWith('blob:')) {
                applyImageToElement(targetEl, override.bgImage);
            }

            applyHiddenStateToElement(targetEl, !!override.isHidden);
        });
    }

    // 🗑️ إخفاء العنصر فعلياً للزوار وإبقائه شبه ظاهر للأدمن
    function applyHiddenStateToElement(element, isHidden) {
        if (!element) return;
        if (isHidden) {
            if (isSuperAdminSession) {
                element.style.setProperty('display', '', 'important');
                element.style.setProperty('opacity', '0.35', 'important');
                element.style.setProperty('outline', '2px dashed #dc2626', 'important');
                element.style.setProperty('outline-offset', '2px', 'important');
                element.setAttribute('data-visual-hidden', 'true');
            } else {
                element.style.setProperty('display', 'none', 'important');
            }
        } else if (element.getAttribute('data-visual-hidden') === 'true' || element.style.display === 'none') {
            element.style.removeProperty('display');
            element.style.removeProperty('opacity');
            element.style.removeProperty('outline');
            element.style.removeProperty('outline-offset');
            element.removeAttribute('data-visual-hidden');
        }
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const rgbValues = rgb.match(/\d+/g);
        if (!rgbValues || rgbValues.length < 3) return '#ffffff';
        return "#" + ((1 << 24) + (parseInt(rgbValues[0]) << 16) + (parseInt(rgbValues[1]) << 8) + parseInt(rgbValues[2])).toString(16).slice(1);
    }
})();