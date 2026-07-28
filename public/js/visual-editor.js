// ==============================================================================
// محرك التعديل البصري المباشر والنقر الأيمن - Hostinger-Style Live Visual Editor
// Enterprise Real-Time Visual Customizer Engine with Zero-Reload Socket.io Sync
// ==============================================================================

(function () {
    let isSuperAdminSession = false;
    let activeEditingElement = null;
    let activeEditorId = '';
    let editorModalPanel = null;

    // 1. الفحص الفوري لجلسة المالك عند تحميل أي صفحة بالمتصفح
    document.addEventListener('DOMContentLoaded', () => {
        checkSuperAdminVisualPermissions();
        listenToVisualSocketUpdates();
        loadAndApplyAllVisualOverrides();
    });

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

    // 2. إيقاف قائمة الكليك يمين الافتراضية وفتح قائمة Hostinger للتعديل البصري
    function initVisualContextMenuListeners() {
        createFloatingEditorModal();

        document.body.addEventListener('contextmenu', (e) => {
            if (!isSuperAdminSession) return;

            const editableTarget = e.target.closest('[data-editor-id], [data-content], h1, h2, h3, h4, h5, h6, p, button, a.btn, .hero-wrapper, header, footer');

            if (editableTarget) {
                e.preventDefault();
                e.stopPropagation();

                activeEditingElement = editableTarget;
                activeEditorId = editableTarget.getAttribute('data-editor-id') || 
                                 editableTarget.getAttribute('data-content') || 
                                 editableTarget.id || 
                                 generateFallbackEditorId(editableTarget);

                openHostingerEditorPanel(e.clientX, e.clientY, editableTarget);
            }
        });

        // تأثير إطار التحديد الأزرق المضيء عند مرور الماوس
        document.body.addEventListener('mouseover', (e) => {
            if (!isSuperAdminSession) return;
            const editableTarget = e.target.closest('[data-editor-id], [data-content], h1, h2, h3, h4, h5, h6, button, a.btn');
            if (editableTarget && !editableTarget.classList.contains('visual-editor-active-outline')) {
                editableTarget.style.outline = '2px dashed #0066ff';
                editableTarget.style.outlineOffset = '2px';
                editableTarget.style.cursor = 'pointer';
                editableTarget.title = '🖱️ اضغط كليك يمين لتعديل هذا العنصر المباشر (Hostinger Live Edit)';
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            if (!isSuperAdminSession) return;
            const editableTarget = e.target.closest('[data-editor-id], [data-content], h1, h2, h3, h4, h5, h6, button, a.btn');
            if (editableTarget) {
                editableTarget.style.outline = '';
                editableTarget.style.outlineOffset = '';
            }
        });
    }

    // توليد ID ثابت ومحدد للعناصر التي لا تملك ID لمنع تغييره عند إعادة تحميل الصفحة
    function generateFallbackEditorId(el) {
        if (el.id) return el.id;
        const tag = el.tagName.toLowerCase();
        const parentTag = el.parentElement ? el.parentElement.tagName.toLowerCase() : 'root';
        const indexInParent = Array.from(el.parentElement ? el.parentElement.children : []).indexOf(el);
        const textSample = (el.innerText || '').trim().substring(0, 15).replace(/\s+/g, '-');
        
        const autoId = `auto_${parentTag}_${tag}_${indexInParent}_${textSample || 'elem'}`;
        el.setAttribute('data-editor-id', autoId);
        return autoId;
    }

    // 3. بناء لوحة تحكم التعديل الطافية (Floating Editor Panel UI)
    function createFloatingEditorModal() {
        if (document.getElementById('hostingerVisualEditorModal')) return;

        editorModalPanel = document.createElement('div');
        editorModalPanel.id = 'hostingerVisualEditorModal';
        editorModalPanel.style.cssText = `
            position: fixed;
            display: none;
            width: 320px;
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
                <h6 style="margin: 0; font-weight: 800; color: #0f172a; font-size: 0.95rem;">✏️ تعديل العنصر المباشر</h6>
                <button id="closeVisualModalBtn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">📝 نص العنصر / الكلام:</label>
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
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">⭕ الحواف (px):</label>
                    <input type="number" id="veBorderRadiusInput" placeholder="12" style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
                </div>
            </div>

            <div style="margin-bottom: 12px;" id="veBgImageRow">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">🖼️ صورة الخلفية / الرابط:</label>
                <input type="text" id="veBgImageInput" placeholder="https://..." style="width: 100%; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem;">
            </div>

            <button id="saveVisualElementBtn" style="width: 100%; background: #2563eb; color: #ffffff; border: none; padding: 10px; border-radius: 10px; font-weight: 800; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: all 0.2s;">
                💾 حفظ ونشر فوراً بـ MongoDB (0ms Sync) 🚀
            </button>
        `;

        document.body.appendChild(editorModalPanel);

        document.getElementById('closeVisualModalBtn').addEventListener('click', closeHostingerPanel);
        document.getElementById('saveVisualElementBtn').addEventListener('click', saveActiveElementToDB);

        // التحديث المباشر السريع مع معالجة الشفافية والتدرج اللوني
        document.getElementById('veTextInput').addEventListener('input', (e) => {
            if (activeEditingElement) {
                updateTextPreservingIcons(activeEditingElement, e.target.value);
            }
        });

        document.getElementById('veTextColorInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                applyTextColorOverride(activeEditingElement, e.target.value);
            }
        });

        document.getElementById('veBgColorInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                applyBgColorOverride(activeEditingElement, e.target.value);
            }
        });

        document.getElementById('veFontSizeInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                activeEditingElement.style.setProperty('font-size', `${e.target.value}px`, 'important');
            }
        });

        document.getElementById('veBorderRadiusInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                activeEditingElement.style.setProperty('border-radius', `${e.target.value}px`, 'important');
            }
        });

        document.getElementById('veBgImageInput').addEventListener('input', (e) => {
            if (activeEditingElement && e.target.value) {
                if (activeEditingElement.tagName.toLowerCase() === 'img') {
                    activeEditingElement.src = e.target.value;
                } else if (activeEditingElement.classList.contains('hero-wrapper')) {
                    activeEditingElement.style.setProperty('background-image', `linear-gradient(rgba(10, 8, 6, 0.75), rgba(10, 8, 6, 0.85)), url('${e.target.value}')`, 'important');
                } else {
                    activeEditingElement.style.setProperty('background-image', `url('${e.target.value}')`, 'important');
                }
            }
        });
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

    // دالة تحديث النص دون تدمير الأيقونات (i, svg, badge)
    function updateTextPreservingIcons(element, newText) {
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

    // 4. فتح لوحة التعديل واستخراج النص النظيف
    function openHostingerEditorPanel(posX, posY, element) {
        if (!editorModalPanel) return;

        const currentStyles = window.getComputedStyle(element);

        document.getElementById('veTextInput').value = extractCleanText(element);
        document.getElementById('veTextColorInput').value = rgbToHex(currentStyles.color) || '#1a1816';
        document.getElementById('veBgColorInput').value = rgbToHex(currentStyles.backgroundColor) || '#ffffff';
        document.getElementById('veFontSizeInput').value = parseInt(currentStyles.fontSize, 10) || '';
        document.getElementById('veBorderRadiusInput').value = parseInt(currentStyles.borderRadius, 10) || '';
        document.getElementById('veBgImageInput').value = element.tagName.toLowerCase() === 'img' ? (element.src || '') : '';

        let leftPos = Math.min(posX + 10, window.innerWidth - 340);
        let topPos = Math.min(posY + 10, window.innerHeight - 380);

        editorModalPanel.style.left = `${Math.max(10, leftPos)}px`;
        editorModalPanel.style.top = `${Math.max(10, topPos)}px`;
        editorModalPanel.style.display = 'block';
    }

    function extractCleanText(element) {
        let text = '';
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            }
        });
        return text.trim() || element.innerText || '';
    }

    function closeHostingerPanel() {
        if (editorModalPanel) editorModalPanel.style.display = 'none';
    }

    // 5. حفظ العنصر المباشر في خادم MongoDB Atlas
    async function saveActiveElementToDB() {
        if (!activeEditorId || !activeEditingElement) return;

        const saveBtn = document.getElementById('saveVisualElementBtn');
        saveBtn.disabled = true;
        saveBtn.innerText = '⏳ جاري الحفظ والنشر بـ MongoDB Atlas...';

        const payload = {
            elementId: activeEditorId,
            text: document.getElementById('veTextInput').value,
            color: document.getElementById('veTextColorInput').value,
            bgColor: document.getElementById('veBgColorInput').value,
            fontSize: document.getElementById('veFontSizeInput').value ? `${document.getElementById('veFontSizeInput').value}px` : '',
            borderRadius: document.getElementById('veBorderRadiusInput').value ? `${document.getElementById('veBorderRadiusInput').value}px` : '',
            bgImage: document.getElementById('veBgImageInput').value.trim()
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
                alert(`🎉 تم حفظ ونشر تعديل العنصر [${activeEditorId}] بنجاح في داتا بيز MongoDB Atlas وبثه حياً للجميع!`);
                closeHostingerPanel();
            } else {
                alert(data.message || 'فشل حفظ التعديل البصري');
            }
        } catch (e) {
            alert('حدث خطأ في الاتصال بالسيرفر أثناء حفظ التعديل البصري');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 حفظ ونشر فوراً بـ MongoDB (0ms Sync) 🚀';
        }
    }

    // 6. جلب وتطبيق كافة التعديلات البصرية المحفوظة
    async function loadAndApplyAllVisualOverrides() {
        try {
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

    // 7. الاستماع للبث اللحظي عبر Socket.io
    function listenToVisualSocketUpdates() {
        if (typeof io === 'undefined') return;
        const socket = io();

        socket.on('visual-element-updated', (data) => {
            if (data && data.elementId && data.overrideData) {
                applySingleOverrideToDOM(data.elementId, data.overrideData);
            }
        });
    }

    function applySingleOverrideToDOM(elementId, override) {
        if (!elementId || !override) return;

        const targetEl = document.querySelector(`[data-editor-id="${elementId}"], [data-content="${elementId}"], #${elementId}`);
        if (!targetEl) return;

        if (override.text !== undefined && override.text !== '') {
            updateTextPreservingIcons(targetEl, override.text);
        }

        if (override.color) {
            applyTextColorOverride(targetEl, override.color);
        }

        if (override.bgColor) {
            applyBgColorOverride(targetEl, override.bgColor);
        }

        if (override.fontSize) {
            targetEl.style.setProperty('font-size', override.fontSize, 'important');
        }

        if (override.borderRadius) {
            targetEl.style.setProperty('border-radius', override.borderRadius, 'important');
        }
        
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

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const rgbValues = rgb.match(/\d+/g);
        if (!rgbValues || rgbValues.length < 3) return '#ffffff';
        return "#" + ((1 << 24) + (parseInt(rgbValues[0]) << 16) + (parseInt(rgbValues[1]) << 8) + parseInt(rgbValues[2])).toString(16).slice(1);
    }
})();