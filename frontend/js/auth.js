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
                    id: data.id,
                    username: data.username,
                    role: data.role,
                    mine_id: data.mine_id,
                    mine_name: data.mine_name,
                    display_name: data.display_name,
                    email: data.email || '',
                    must_change_password: !!data.must_change_password
                };
                localStorage.setItem('mineops_user', JSON.stringify(this.currentUser));
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
        const roleLabel = role === 'super' ? '超级管理员' : role === 'mine' ? '矿山子管理员' : '矿山子用户';
        const mineLabel = this.currentUser.mine_name || `矿山 #${this.currentUser.mine_id || '--'}`;

        // 侧边栏底部
        const sidebarUser = document.getElementById('sidebar-username');
        const sidebarMine = document.getElementById('sidebar-mine');
        if (sidebarUser) sidebarUser.textContent = displayName;
        if (sidebarMine) sidebarMine.textContent = mineLabel;

        // 顶部栏
        const headerUser = document.getElementById('header-username');
        if (headerUser) headerUser.textContent = `${displayName} · ${roleLabel}`;

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
        this.hideForgotPassword();
    },

    togglePassword: function(inputId, button) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        const icon = button?.querySelector('i');
        if (icon) icon.className = showing ? 'fas fa-eye' : 'fas fa-eye-slash';
        button?.setAttribute('aria-label', showing ? '显示密码' : '隐藏密码');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    },

    showForgotPassword: function() {
        document.getElementById('login-form-panel')?.classList.add('hidden');
        document.getElementById('forgot-password-panel')?.classList.remove('hidden');
        document.getElementById('login-hint')?.classList.add('hidden');
        const username = document.getElementById('login-username')?.value || '';
        if (username.includes('@')) document.getElementById('reset-email').value = username;
    },

    hideForgotPassword: function() {
        document.getElementById('forgot-password-panel')?.classList.add('hidden');
        document.getElementById('login-form-panel')?.classList.remove('hidden');
        document.getElementById('login-hint')?.classList.remove('hidden');
        const message = document.getElementById('reset-password-message');
        if (message) { message.textContent = ''; message.classList.add('hidden'); }
    },

    setResetMessage: function(message, success = false) {
        const el = document.getElementById('reset-password-message');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden', 'success');
        if (success) el.classList.add('success');
    },

    sendResetCode: async function() {
        const email = document.getElementById('reset-email')?.value?.trim();
        const button = document.getElementById('send-reset-code');
        if (!email) { this.setResetMessage('请输入绑定邮箱'); return; }
        if (button) { button.disabled = true; button.textContent = '发送中...'; }
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/auth/password-reset/request`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || '验证码发送失败');
            this.setResetMessage(data.message || '验证码已发送', true);
        } catch (error) {
            this.setResetMessage(error.message || '验证码发送失败');
        } finally {
            if (button) { button.disabled = false; button.textContent = '发送验证码'; }
        }
    },

    confirmPasswordReset: async function() {
        const email = document.getElementById('reset-email')?.value?.trim();
        const code = document.getElementById('reset-code')?.value?.trim();
        const new_password = document.getElementById('reset-new-password')?.value || '';
        const button = document.getElementById('confirm-reset-password');
        if (!email || !code || new_password.length < 6) { this.setResetMessage('请填写邮箱、6 位验证码和至少 6 位新密码'); return; }
        if (button) { button.disabled = true; button.textContent = '重置中...'; }
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/auth/password-reset/confirm`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, new_password })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || '密码重置失败');
            this.setResetMessage(data.message || '密码已重置', true);
            setTimeout(() => this.hideForgotPassword(), 900);
        } catch (error) {
            this.setResetMessage(error.message || '密码重置失败');
        } finally {
            if (button) { button.disabled = false; button.textContent = '重置密码'; }
        }
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
                id: data.id,
                username: data.username,
                role: data.role,
                mine_id: data.mine_id,
                mine_name: data.mine_name,
                token: data.access_token,
                display_name: data.display_name,
                email: data.email || '',
                must_change_password: !!data.must_change_password
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

    updateSession: function(data) {
        if (!this.currentUser || !data) return;
        const token = data.access_token || this.currentUser.token || localStorage.getItem('mineops_token') || '';
        this.currentUser = {
            ...this.currentUser,
            id: data.id ?? this.currentUser.id,
            username: data.username ?? this.currentUser.username,
            display_name: data.display_name ?? this.currentUser.display_name,
            email: Object.prototype.hasOwnProperty.call(data, 'email') ? (data.email || '') : (this.currentUser.email || ''),
            role: data.role ?? this.currentUser.role,
            mine_id: data.mine_id ?? this.currentUser.mine_id,
            mine_name: data.mine_name ?? this.currentUser.mine_name,
            must_change_password: Object.prototype.hasOwnProperty.call(data, 'must_change_password') ? !!data.must_change_password : !!this.currentUser.must_change_password,
            token
        };
        localStorage.setItem('mineops_user', JSON.stringify(this.currentUser));
        localStorage.setItem('mineops_token', token);
        this.updateAllUserInfo();
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
