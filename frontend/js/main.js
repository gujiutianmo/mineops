/**
 * MineOps 主入口模块
 * 桥接 Auth / UI / I18n，管理应用生命周期
 */
(function() {
    'use strict';

    let uiReady = false;

    function ensureUIReady() {
        if (uiReady) return;
        if (typeof UI === 'undefined' || typeof Auth === 'undefined') return;
        if (!Auth.isAuthenticated()) return;

        uiReady = true;
        UI.init();
        UI.onAuthReady();
    }

    // ====================
    // 初始化顺序：I18n → Auth → UI
    // ====================
    // 场景 A：页面加载时已有有效 token
    document.addEventListener('DOMContentLoaded', async () => {
        // 1. 先加载 i18n（语言包）
        if (typeof I18n !== 'undefined') {
            await I18n.init();
        }
        // 2. 初始化 Auth（检查已有 session）
        if (typeof Auth !== 'undefined') {
            Auth.init();
        }
        // 3. 等待认证完成后初始化 UI
        const check = setInterval(() => {
            if (Auth?.isAuthenticated?.()) {
                ensureUIReady();
                clearInterval(check);
            }
        }, 100);
        // 最多等 5 秒（如果用户已登录）
        setTimeout(() => { clearInterval(check); /* 未登录时也尝试渲染 */ }, 5000);
    });

    // 场景 B：用户从登录表单登录成功
    // 劫持 Auth.login 以在成功后触发 UI 初始化
    const origLogin = Auth?.login;
    if (origLogin) {
        Auth.login = async function() {
            const result = await origLogin.apply(this, arguments);
            if (result?.success) {
                ensureUIReady();
            }
            return result;
        };
    }

    // ====================
    // 键盘快捷键
    // ====================
    document.addEventListener('keydown', function(e) {
        // ESC 关闭模态框
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-container');
            if (modal?.querySelector('.modal.active')) {
                UI?.hideModal();
            }
        }
        // Ctrl+Enter 提交表单
        if (e.ctrlKey && e.key === 'Enter') {
            const modal = document.getElementById('modal-container');
            if (modal?.querySelector('.modal.active')) {
                const submitBtn = modal.querySelector('.modal-submit');
                if (submitBtn) submitBtn.click();
            }
        }
    });

    // ====================
    // 移动端侧边栏手势
    // ====================
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX;
        // 从左边缘向右滑动 > 60px 打开侧边栏
        if (touchStartX < 30 && diff > 60) {
            UI?.toggleSidebar();
        }
        // 从右向左滑动 > 60px 关闭侧边栏
        if (diff < -60) {
            UI?.closeSidebar();
        }
    });

    console.log('MineOps v2.0 · 矿山管理系统已就绪');
})();
