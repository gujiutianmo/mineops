/**
 * MineOps Authentication Module
 * Updated for new sidebar layout
 */
const Auth = {
    currentUser: null,

    /* ─── Lifecycle ─── */
    init: function() {
        this.loadCurrentUser();
        this.setupEventListeners();
    },

    /* ─── State management ─── */
    loadCurrentUser: function() {
        const raw = localStorage.getItem('mineops_user');
        if (raw) {
            try {
                this.currentUser = JSON.parse(raw);
                if (!this.currentUser.token) throw new Error('Invalid session');
                this.showAppShell();
                this.updateAllUserInfo();
                // 验证 token 是否仍然有效
                this.validateToken().then(valid => {
                    if (!valid) this.logout();
                });
            } catch (e) {
                console.error('解析用户数据失败:', e);
                this.logout();
            }
        } else {
            this.showLoginOverlay();
        }
    },

    /* 异步校验 token */
    validateToken: async function() {
        try {
            const resp = await fetch(`${API_CONFIG.baseUrl}/auth/me`, {
                headers: this.getAuthHeaders()
            });
            if (resp.ok) {
                const data = await resp.json();
                // 用服务器数据刷新本地
                this.currentUser = {
                    ...this.currentUser,
                    username: data.username,
                    role: data.role,
                    mine_id: data.mine_id,
                    display_name: data.display_name
                };
                this.updateAllUserInfo();
                return true;
            }
            return false;
        } catch {
            // 无法连接服务器时不强制登出
            return true;
        }
    },

    /* ─── Update all user name displays ─── */
    updateAllUserInfo: function() {
        if (!this.currentUser) return;

        const displayName = this.currentUser.display_name || this.currentUser.username;
        const username = this.currentUser.username;
        const role = this.currentUser.role;
        const mineLabel = this.currentUser.mine_name || `矿山 #${this.currentUser.mine_id || '--'}`;

        // 侧边栏底部
        const sidebarUser = document.getElementById('sidebar-username');
        const sidebarMine = document.getElementById('sidebar-mine');
        if (sidebarUser) sidebarUser.textContent = displayName;
        if (sidebarMine) sidebarMine.textContent = mineLabel;

        // 顶部栏
        const headerUser = document.getElementById('header-username');
        if (headerUser) headerUser.textContent = role === 'super' ? `${displayName} · 超级管理员` : displayName;

        // 矿山徽章
        const mineBadge = document.getElementById('mine-badge');
        if (mineBadge) {
            if (role === 'super') {
                mineBadge.classList.add('hidden');
            } else {
                mineBadge.textContent = mineLabel;
                mineBadge.classList.remove('hidden');
            }
        }
    },

    /* ─── Event binding ─── */
    setupEventListeners: function() {
        // 登录表单回车提交
        const loginForm = document.getElementById('login-form');
        if (!loginForm) {
            // 监听登录按钮的父级 keydown（覆盖层内回车）
            document.getElementById('login-password')?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.login();
            });
        }
    },

    /* ─── Login UI ─── */
    showLoginOverlay: function() {
        const overlay = document.getElementById('login-overlay');
        const shell = document.getElementById('app-shell');
        if (overlay) overlay.classList.remove('hidden');
        if (shell) shell.classList.add('hidden');

        // 清空输入
        const userInput = document.getElementById('login-username');
        const passInput = document.getElementById('login-password');
        const errEl = document.getElementById('login-error');
        if (userInput) userInput.value = '';
        if (passInput) passInput.value = '';
        if (errEl) errEl.classList.add('hidden');
    },

    showAppShell: function() {
        const overlay = document.getElementById('login-overlay');
        const shell = document.getElementById('app-shell');
        if (overlay) overlay.classList.add('hidden');
        if (shell) shell.classList.remove('hidden');
    },

    /* ─── Auth actions ─── */
    login: async function() {
        const username = document.getElementById('login-username')?.value?.trim();
        const password = document.getElementById('login-password')?.value?.trim();
        const errEl = document.getElementById('login-error');

        if (!username || !password) {
            if (errEl) { errEl.textContent = '请输入用户名和密码'; errEl.classList.remove('hidden'); }
            return { success: false, error: '请输入用户名和密码' };
        }

        if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }

        const submitBtn = document.getElementById('login-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '登录中...'; }

        try {
            const resp = await fetch(`${API_CONFIG.baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({ detail: '登录失败' }));
                throw new Error(errData.detail || '登录失败');
            }

            const data = await resp.json();

            this.currentUser = {
                username: data.username,
                role: data.role,
                mine_id: data.mine_id,
                mine_name: data.mine_name,
                token: data.access_token,
                display_name: data.display_name
            };
            localStorage.setItem('mineops_user', JSON.stringify(this.currentUser));
            localStorage.setItem('mineops_token', data.access_token);

            this.showAppShell();
            this.updateAllUserInfo();

            return { success: true, user: this.currentUser };

        } catch (error) {
            console.error('登录错误:', error);
            if (errEl) { errEl.textContent = error.message; errEl.classList.remove('hidden'); }
            return { success: false, error: error.message };
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '登 录'; }
        }
    },

    logout: function() {
        localStorage.removeItem('mineops_user');
        localStorage.removeItem('mineops_token');
        this.currentUser = null;
        this.showLoginOverlay();
    },

    /* ─── Helpers ─── */
    getAuthHeaders: function() {
        return {
            'Authorization': `Bearer ${localStorage.getItem('mineops_token') || ''}`,
            'Content-Type': 'application/json'
        };
    },

    isAuthenticated: function() { return !!this.currentUser; },
    isSuperAdmin: function() { return this.currentUser?.role === 'super'; },
    canAccessMine: function(mineId) {
        if (this.isSuperAdmin()) return true;
        return String(this.currentUser?.mine_id) === String(mineId);
    },
    getUserRole: function() { return this.currentUser?.role || 'mine'; },
    getUserMineId: function() { return this.currentUser?.mine_id || ''; }
};

// Auto-init on DOM ready
// Auth 初始化由 main.js 在 I18n 加载完成后调用
// document.addEventListener('DOMContentLoaded', () => Auth.init());
