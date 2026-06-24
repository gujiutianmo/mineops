// ============================================================
// MineOps UI Module — New Sidebar Layout + Responsive Design
// ============================================================

const UI = {
    currentPage: 'dashboard',
    currentSubPage: null,
    currentEditId: null,
    financeRecords: [],
    financeAnalysis: null,
    financeActiveType: 'all',

    cache: {
        mines: [],
        equipment: [],
        employees: [],
        factories: [],
        plates: [],
        fleetVehicles: [],
        users: []
    },

    charts: {},

    equipmentCategoryOptions: ['挖掘机', '破碎锤', '铲车', '矿卡', '短车'],
    financeExpenseCategories: ['外联', '工资'],

    // ── Sidebar Navigation ──
    sidebarItems: [
        { page: 'dashboard',    icon: 'fas fa-gauge-high',         label: '仪表板' },
        { page: 'ops-intelligence', icon: 'fas fa-brain',          label: '智能运营' },
        { page: 'mines',        icon: 'fas fa-mountain',           label: '矿山管理' },
        { page: 'users',        icon: 'fas fa-user-shield',        label: '用户管理' },
        { page: 'equipment',    icon: 'fas fa-truck-monster',      label: '设备管理' },
        { page: 'equipment-hours', icon: 'fas fa-clock',           label: '设备工时' },
        { page: 'employees',    icon: 'fas fa-users',              label: '员工管理' },
        { page: 'finance',      icon: 'fas fa-coins',              label: '财务管理' },
        { page: 'shipping',     icon: 'fas fa-ship',               label: '运输管理' },
        { page: 'fleet',        icon: 'fas fa-truck-moving',       label: '车队管理' }
    ],

    // ── Init ──
    init: function() {
        this.buildSidebar();
        this.setupEventListeners();
        this.setupModal();
        this.initTheme();
        // 等 Auth 完成认证后由 main.js 调用 onAuthReady
    },

    /** Dark Mode Toggle */
    initTheme: function() {
        const saved = localStorage.getItem('mineops-theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark');
            this.updateThemeIcon(true);
        }
    },

    toggleTheme: function() {
        const isDark = document.body.classList.contains('dark');
        if (isDark) {
            document.body.classList.remove('dark');
            localStorage.setItem('mineops-theme', 'light');
        } else {
            document.body.classList.add('dark');
            localStorage.setItem('mineops-theme', 'dark');
        }
        this.updateThemeIcon(!isDark);
        // 销毁并重建图表以匹配新主题颜色
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) { this.charts[key].destroy(); this.charts[key] = null; }
        });
        this.loadPage(this.currentPage);
    },

    updateThemeIcon: function(isDark) {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const label = btn.querySelector('span');
        if (isDark) {
            icon.className = 'fas fa-sun';
            label.textContent = '浅色';
        } else {
            icon.className = 'fas fa-moon';
            label.textContent = '深色';
        }
    },

    /** Auth 认证成功后调用 */
    onAuthReady: function() {
        if (Auth.currentUser?.must_change_password) {
            this.openSettings('account');
            setTimeout(() => this.showError('这是首次登录或管理员已重置密码，请先修改密码'), 100);
            return;
        }
        this.loadPage('dashboard');
        this.loadReminderBadge();
    },

    // ── Build Sidebar ──
    buildSidebar: function() {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        const userRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
        const hiddenByRole = {
            mine: ['mines'],
            user: ['mines', 'users']
        };

        let html = '';
        this.sidebarItems.forEach(item => {
            if ((hiddenByRole[userRole] || []).includes(item.page)) return;
            const href = item.href ? ` href="${item.href}"` : '';
            html += `<a class="sidebar-item" data-page="${item.page}"${href}>
                <i class="${item.icon}"></i>
                <span>${item.label}</span>
            </a>`;
        });
        nav.innerHTML = html;

        // Update user badge
        const userBadge = document.getElementById('user-role-badge');
        if (userBadge) {
            userBadge.textContent = userRole === 'super' ? '超级管理员' : userRole === 'mine' ? '矿山子管理员' : '矿山子用户';
            userBadge.className = userRole === 'super' ? 'badge badge-super' : 'badge badge-mine';
        }

        // delegate click
        nav.addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-item');
            if (!item) return;
            if (item.getAttribute('href')) return;
            const page = item.getAttribute('data-page');
            if (page) {
                this.loadPage(page);
                this.closeSidebar();
            }
        });
    },

    toggleSidebar: function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
        } else {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('show');
        }
    },

    closeSidebar: function() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    },

    openSettings: function(tab = 'account') {
        if (Auth.isSuperAdmin?.() && this.cache.mines.length === 0) {
            API.mines.getAll({ limit: 1000 }).then(mines => {
                this.cache.mines = mines || [];
                this.openSettings(tab);
            }).catch(() => {
                this.loadPage('settings');
                if (tab !== 'account') setTimeout(() => this.switchSettingsTab(tab), 0);
            });
            return;
        }
        this.loadPage('settings');
        this.closeSidebar();
        if (tab !== 'account') setTimeout(() => this.switchSettingsTab(tab), 0);
    },

    // ── Event Setup ──
    setupEventListeners: function() {
        // 新增按钮（全局）— 使用事件委托，因为按钮在页面渲染后才创建
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.addEventListener('click', (e) => {
                const btn = e.target.closest('#global-add-btn');
                if (btn) {
                    this.showAddModal();
                }
            });
        }

        // 窗口大小变化时关闭移动侧边栏
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) this.closeSidebar();
        });
    },

    // ── Load Page ──
    loadPage: function(pageName) {
        if (pageName === 'worklogs') pageName = 'equipment-hours';
        if (pageName !== 'dashboard') this.disposeMineMap();
        this.currentPage = pageName;
        this.currentSubPage = null;

        // 更新侧边栏激活项
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-page') === pageName);
        });

        // 更新页面标题
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = this.getPageTitle(pageName);

        // 渲染内容
        const area = document.getElementById('content-area');
        if (!area) return;
        area.innerHTML = this.getPageHTML(pageName);

        // 加载数据
        this.loadPageData(pageName);

        // 滚动到顶部
        area.scrollTop = 0;
    },

    getPageTitle: function(pageName) {
        const titles = {
            dashboard: '仪表板', mines: '矿山管理', equipment: '设备管理',
            users: '用户管理',
            'ops-intelligence': '智能运营中心',
            'equipment-hours': '设备工时',
            employees: '员工管理', finance: '财务管理', shipping: '运输管理',
            fleet: '车队管理',
            'fleet-vehicles': '车辆档案',
            'fleet-maintenance': '维修登记',
            'fleet-fuel-trips': '加油趟数',
            'plate-counter': '车牌比对',
            settings: '设置中心',
            'account-settings': '账户设置',
            'app-release': '版本下载',
            worklogs: '工作日志'
        };
        return titles[pageName] || pageName;
    },

    // ── Modal Setup ──
    setupModal: function() {
        // Global click on document for close
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close')) {
                this.hideModal();
            }
            if (e.target.id === 'modal-container' || e.target.closest('.modal-overlay-bg')) {
                this.hideModal();
            }
        });
    },

    showModal: function(html) {
        const container = document.getElementById('modal-container');
        if (!container) return;
        container.innerHTML = `
            <div class="modal active">
                <div class="modal-content">
                    ${html}
                </div>
            </div>
        `;
        // Attach event listeners inside modal
        const cancelBtn = container.querySelector('.modal-cancel');
        const submitBtn = container.querySelector('.modal-submit');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal());
        if (submitBtn) submitBtn.addEventListener('click', () => this.handleFormSubmit());
    },

    hideModal: function() {
        const container = document.getElementById('modal-container');
        if (container) container.innerHTML = '';
        this.currentEditId = null;
    },

    // ── Form Submit ──
    handleFormSubmit: function() {
        const form = document.getElementById('modal-form');
        if (!form) return;
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });

        // account creation for mines
        if (this.currentPage === 'mines' && !this.currentEditId) {
            const check = document.getElementById('create-account-check');
            data.create_account = check ? check.checked : false;
        }
        if (data.create_account) {
            if (!data.account_username?.trim()) { this.showError('请输入账户用户名'); return; }
            if (!data.account_password?.trim()) { this.showError('请输入账户密码'); return; }
        }

        const apiType = this.currentSubPage || this.currentPage;
        if (apiType === 'equipment' && data.type) {
            data.category = data.type;
        }
        if (apiType === 'finance' && data.trans_type === 'expense' && !this.financeExpenseCategories.includes(data.category)) {
            this.showError('支出模块只能选择外联或工资');
            return;
        }
        const api = API_MAP[apiType];
        if (!api) { this.showError('未知API模块'); return; }
        Object.keys(data).forEach(key => {
            if (data[key] === '') delete data[key];
        });
        this.ensureMineForPayload(apiType, data);

        const promise = this.currentEditId ? api.update(this.currentEditId, data) : api.create(data);
        promise.then(() => {
            this.showSuccess(this.currentEditId ? '更新成功！' : '创建成功！');
            this.hideModal();
            this.loadPageData(this.currentPage);
        }).catch(error => {
            this.showError('操作失败: ' + error.message);
        });
    },

    // ── Add / Edit Modals ──
    showAddModal: function() {
        this.currentEditId = null;
        const type = this.currentSubPage || this.currentPage;
        if (this.needsMineField(type) && Auth.isSuperAdmin?.() && this.cache.mines.length === 0) {
            API.mines.getAll({ limit: 1000 }).then(mines => {
                this.cache.mines = mines;
                this.showAddModal();
            }).catch(error => this.showError('加载矿山列表失败: ' + error.message));
            return;
        }
        const title = `新增${this.getPageTitle(this.currentPage)}`;

        const fieldsHtml = this.getFormFields(type);
        const modalHtml = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <form id="modal-form">${fieldsHtml}</form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">取消</button>
                <button class="btn btn-primary modal-submit">保存</button>
            </div>
        `;
        this.showModal(modalHtml);
        this.setupEquipmentCategoryBehavior(type);
        this.setupFinanceFormBehavior(type);
        this.setupFleetFormBehavior(type);

        // 矿山创建账户复选框联动
        if (type === 'mines' && !this.currentEditId) {
            setTimeout(() => {
                const check = document.getElementById('create-account-check');
                const fields = document.getElementById('account-fields');
                if (check && fields) {
                    check.addEventListener('change', function() {
                        fields.style.display = this.checked ? 'block' : 'none';
                    });
                }
            }, 50);
        }
    },

    showEditModal: function(tableType, id) {
        this.currentEditId = id;
        if (this.needsMineField(tableType) && Auth.isSuperAdmin?.() && this.cache.mines.length === 0) {
            API.mines.getAll({ limit: 1000 }).then(mines => {
                this.cache.mines = mines;
                this.showEditModal(tableType, id);
            }).catch(error => this.showError('加载矿山列表失败: ' + error.message));
            return;
        }
        const title = `编辑${this.getPageTitle(tableType)}`;
        const fieldsHtml = this.getFormFields(tableType);
        const modalHtml = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <form id="modal-form">${fieldsHtml}</form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">取消</button>
                <button class="btn btn-primary modal-submit">保存</button>
            </div>
        `;
        this.showModal(modalHtml);
        this.setupEquipmentCategoryBehavior(tableType);
        this.setupFinanceFormBehavior(tableType);
        this.setupFleetFormBehavior(tableType);
        // fill form
        this.getEditData(tableType, id).then(data => {
            if (data) {
                this.fillForm(data);
                this.setupEquipmentCategoryBehavior(tableType);
                this.setupFinanceFormBehavior(tableType);
                this.setupFleetFormBehavior(tableType);
            }
        });
    },

    getEditData: function(tableType, id) {
        if (API_MAP[tableType]) {
            return API_MAP[tableType].getById(id).catch(error => {
                this.showError('获取数据失败: ' + error.message);
                return null;
            });
        }
        return Promise.resolve(null);
    },

    fillForm: function(data) {
        const form = document.getElementById('modal-form');
        if (!form) return;
        form.querySelectorAll('input, select, textarea').forEach(input => {
            const name = input.getAttribute('name');
            if (name && data[name] !== undefined) {
                if (input.type === 'date' && data[name]) {
                    input.value = new Date(data[name]).toISOString().split('T')[0];
                } else if (input.type === 'datetime-local' && data[name]) {
                    input.value = new Date(data[name]).toISOString().slice(0, 16);
                } else {
                    input.value = data[name];
                }
            }
        });
    },

    // ── Confirm Delete ──
    confirmDelete: function(tableType, id) {
        if (!confirm('确定要删除这条记录吗？')) return;
        const api = API_MAP[tableType];
        if (!api) { this.showError('未知API模块'); return; }
        api.delete(id).then(() => {
            this.showSuccess('删除成功！');
            this.loadPageData(tableType.startsWith('fleet-') ? 'fleet' : tableType === 'plates' ? 'shipping' : tableType === 'factories' ? 'shipping' : tableType);
        }).catch(error => {
            this.showError('删除失败: ' + error.message);
        });
    },

    // ═══════════════════════════════════════
    // PAGE HTML RENDERING
    // ═══════════════════════════════════════

    getPageHTML: function(page) {
        switch (page) {
            case 'dashboard': return this.getDashboardHTML();
            case 'ops-intelligence': return this.getOpsIntelligenceHTML();
            case 'mines': return this.getCrudPageHTML('mines', '矿山');
            case 'users': return this.getUsersHTML();
            case 'settings': return this.getSettingsCenterHTML();
            case 'email-settings': return this.getEmailSettingsHTML();
            case 'account-settings': return this.getAccountSettingsHTML();
            case 'equipment': return this.getEquipmentHTML();
            case 'equipment-hours': return this.getEquipmentHoursHTML();
            case 'employees': return this.getEmployeesHTML();
            case 'finance': return this.getFinanceHTML();
            case 'shipping': return this.getShippingHTML();
            case 'fleet': return this.getFleetHTML();
            case 'plate-counter': return this.getPlateCounterHTML();
            case 'app-release': return this.getAppReleaseHTML();
            case 'worklogs': return this.getEquipmentHoursHTML();
            default: return '<p class="empty-message">未知页面</p>';
        }
    },

    // ── Dashboard ──
    getDashboardHTML: function() {
        const displayName = Auth.currentUser?.display_name || Auth.currentUser?.username || '管理员';
        const mineName = Auth.currentUser?.mine_name || '当前矿山';
        return `
        <section class="shift-brief">
            <div class="shift-brief__intro">
                <span class="shift-brief__eyebrow">今日班次</span>
                <h2>早上好，${this.escapeHtml(displayName)}</h2>
                <p>${this.escapeHtml(mineName)} · 运营数据与现场任务已准备就绪</p>
            </div>
            <div class="shift-brief__actions">
                <button type="button" onclick="UI.loadPage('equipment-hours')">
                    <i class="fas fa-gas-pump"></i><span>油耗<small>设备与车队用油</small></span>
                </button>
                <button type="button" onclick="UI.loadPage('finance')">
                    <i class="fas fa-wallet"></i><span>财务<small>收入、支出与净额</small></span>
                </button>
                <button type="button" onclick="UI.loadPage('plate-counter')">
                    <i class="fas fa-id-card"></i><span>车牌比对<small>每日车牌与趟数</small></span>
                </button>
                <button type="button" onclick="UI.loadPage('equipment-hours')">
                    <i class="fas fa-clock"></i><span>工时<small>设备计时与补录</small></span>
                </button>
            </div>
        </section>

        <div class="stats-grid">
            <div class="stat-card orange" role="button" onclick="UI.loadPage('equipment-hours')">
                <div class="stat-icon stat-icon-orange"><i class="fas fa-gas-pump"></i></div>
                <div class="stat-info"><h3 id="dashboard-fuel-total">--</h3><p>本月油耗 (L)</p></div>
            </div>
            <div class="stat-card purple" role="button" onclick="UI.loadPage('finance')">
                <div class="stat-icon stat-icon-purple"><i class="fas fa-coins"></i></div>
                <div class="stat-info"><h3 id="finance-total">--</h3><p>财务净额</p></div>
            </div>
            <div class="stat-card cyan" role="button" onclick="UI.loadPage('plate-counter')">
                <div class="stat-icon stat-icon-cyan"><i class="fas fa-id-card"></i></div>
                <div class="stat-info"><h3 id="dashboard-plate-trips">--</h3><p>本月车牌比对趟数</p></div>
            </div>
            <div class="stat-card blue" role="button" onclick="UI.loadPage('equipment-hours')">
                <div class="stat-icon stat-icon-blue"><i class="fas fa-clock"></i></div>
                <div class="stat-info"><h3 id="dashboard-work-hours">--</h3><p>本月工时 (h)</p></div>
            </div>
            <div class="stat-card green" role="button" onclick="UI.loadPage('employees')">
                <div class="stat-icon stat-icon-green"><i class="fas fa-user-check"></i></div>
                <div class="stat-info">
                    <h3 id="dashboard-attendance-today">--</h3>
                    <p>今日出勤 <small id="dashboard-employee-summary">员工总数 --</small></p>
                </div>
            </div>
            <div class="stat-card amber" role="button" onclick="UI.loadPage('shipping')">
                <div class="stat-icon stat-icon-amber"><i class="fas fa-truck-ramp-box"></i></div>
                <div class="stat-info">
                    <h3 id="dashboard-shipping-today">--</h3>
                    <p>今日装车 <small id="dashboard-shipping-summary">活跃车牌 --</small></p>
                </div>
            </div>
        </div>

        <div class="chart-row">
            <div class="chart-container"><h3>近30天油耗趋势</h3><canvas id="fuel-trend-chart"></canvas></div>
            <div class="chart-container"><h3>财务概览</h3><div id="currency-summary"><p class="empty-message">加载中...</p></div></div>
        </div>
        <div class="chart-row mt-20">
            <div class="chart-container"><h3>支出模块分布</h3><canvas id="expense-pie-chart"></canvas></div>
            <div class="chart-container"><h3>智能录入 · 今日日志</h3>
                <div>
                    <input type="date" id="today-worklog-date" class="form-control w-150" style="display:inline;margin-bottom:12px;">
                    <div id="today-worklog-list" style="max-height:300px;overflow-y:auto;"></div>
                </div>
            </div>
        </div>

        <div class="recent-activity">
            <h3>最近活动</h3>
            <div id="activity-list"><p class="empty-message">暂无最近活动</p></div>
        </div>
        `;
    },

    // ── Finance Management ──
    getFinanceHTML: function() {
        const isSuper = (Auth.getUserRole ? Auth.getUserRole() : 'mine') === 'super';
        const mineFilter = isSuper
            ? `<label>矿山
                <select id="finance-mine-filter" class="form-control w-180">
                    <option value="">全部矿山（合并）</option>
                    ${(this.cache.mines || []).map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`).join('')}
                </select>
            </label>`
            : '';
        return `
        <div class="page-header finance-workspace-header">
            <div>
                <h2>财务管理</h2>
                <p class="page-subtitle">按日期、币种和收支类型查看导入流水、财务概览与支出结构。</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增财务</button>
                ${this.getImportExportButtons('finance')}
            </div>
        </div>

        <div class="filter-bar finance-filter-bar">
            ${mineFilter}
            <label>开始日期 <input type="date" id="finance-start-date"></label>
            <label>结束日期 <input type="date" id="finance-end-date"></label>
            <label>币种
                <select id="finance-currency-filter" class="form-control w-130">
                    <option value="">全部币种</option>
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                </select>
            </label>
            <button class="btn btn-primary btn-sm" id="finance-apply-filter"><i class="fas fa-filter"></i> 查询</button>
            <button class="btn btn-secondary btn-sm" id="finance-reset-filter"><i class="fas fa-rotate-left"></i> 重置</button>
        </div>

        <div class="dashboard-metric-grid finance-kpi-grid">
            <div class="dashboard-metric finance-kpi income"><span>收入合计</span><strong id="finance-kpi-income">--</strong></div>
            <div class="dashboard-metric finance-kpi expense"><span>支出合计</span><strong id="finance-kpi-expense">--</strong></div>
            <div class="dashboard-metric finance-kpi net"><span>净额</span><strong id="finance-kpi-net">--</strong></div>
            <div class="dashboard-metric finance-kpi"><span>记录数</span><strong id="finance-kpi-count">--</strong><small id="finance-kpi-period">全部期间</small></div>
        </div>

        <div class="dashboard-grid finance-analysis-grid mt-20">
            <div class="chart-container finance-chart-card">
                <h3>收支趋势</h3>
                <canvas id="finance-trend-chart"></canvas>
            </div>
            <div class="chart-container finance-chart-card">
                <h3>支出模块占比</h3>
                <canvas id="finance-module-chart"></canvas>
            </div>
            <div class="dashboard-panel finance-panel-list">
                <h3>支出说明排行</h3>
                <div id="finance-description-ranking" class="finance-ranking-list"><p class="empty-message">加载中...</p></div>
            </div>
            <div class="dashboard-panel finance-panel-list">
                <h3>币种汇总</h3>
                <div id="finance-currency-breakdown" class="finance-currency-list"><p class="empty-message">加载中...</p></div>
            </div>
        </div>

        <div class="finance-ledger-panel mt-20">
            <div class="sub-tabs finance-record-tabs">
                <button class="sub-tab active finance-record-tab" type="button" data-finance-type="all">全部流水 <span id="finance-tab-all-count">0</span></button>
                <button class="sub-tab finance-record-tab" type="button" data-finance-type="income">收入记录 <span id="finance-tab-income-count">0</span></button>
                <button class="sub-tab finance-record-tab" type="button" data-finance-type="expense">支出记录 <span id="finance-tab-expense-count">0</span></button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="finance-table">
                    <thead><tr><th>类型</th><th>金额</th><th>货币</th><th>支出明细</th><th>日期</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="6" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        `;
    },

    // ── CRUD Page (mines / employees / finance) ──
    getCrudPageHTML: function(type, label) {
        const tableId = `${type}-table`;
        let cols = '';
        if (type === 'mines') cols = '<th>名称</th><th>创建时间</th><th style="width:120px">操作</th>';
        else if (type === 'employees') cols = '<th>法文名</th><th>中文名</th><th>人员类型</th><th>职位</th><th>薪资</th><th>货币</th><th style="width:120px">操作</th>';
        else if (type === 'finance') cols = '<th>类型</th><th>金额</th><th>货币</th><th>支出明细</th><th>日期</th><th style="width:120px">操作</th>';

        return `
        <div class="page-header">
            <h2>${label}管理</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增${label}</button>
                ${this.getImportExportButtons(type)}
            </div>
        </div>
        <div class="table-responsive table-container">
            <table class="data-table" id="${tableId}">
                <thead><tr>${cols}</tr></thead>
                <tbody><tr><td colspan="10" class="empty-message">加载中...</td></tr></tbody>
            </table>
        </div>
        `;
    },

    getImportExportButtons: function(type) {
        if (['mines'].includes(type)) return '';
        return `
            <button class="btn btn-secondary btn-sm" id="import-${type}-btn"><i class="fas fa-upload"></i> 导入</button>
            <button class="btn btn-secondary btn-sm" id="export-${type}-btn"><i class="fas fa-download"></i> 导出</button>
            <button class="btn btn-secondary btn-sm" id="download-${type}-template-btn"><i class="fas fa-file-download"></i> 模板</button>
            <input type="file" id="${type}-file-input" class="hidden" accept=".xlsx">
        `;
    },

    getUsersHTML: function() {
        const isSuper = Auth.isSuperAdmin?.();
        return `
        <div class="page-header">
            <h2>用户管理</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="add-user-btn"><i class="fas fa-plus"></i> 新增用户</button>
            </div>
        </div>
        <div class="search-bar">
            ${isSuper ? '<select id="user-mine-filter" class="form-control" style="max-width:220px"><option value="">全部矿山</option></select>' : ''}
            <select id="user-role-filter" class="form-control w-180">
                <option value="">全部角色</option>
                <option value="mine">矿山子管理员</option>
                <option value="user">矿山子用户</option>
            </select>
            <select id="user-active-filter" class="form-control w-130">
                <option value="">全部状态</option>
                <option value="1">启用</option>
                <option value="0">停用</option>
            </select>
            <button class="btn btn-secondary" id="user-filter-btn"><i class="fas fa-filter"></i> 筛选</button>
        </div>
        <div class="table-responsive table-container">
            <table class="data-table" id="users-table">
                <thead><tr><th>用户名</th><th>显示名称</th><th>邮箱</th><th>角色</th><th>所属矿山</th><th>状态</th><th>创建时间</th><th style="width:140px">操作</th></tr></thead>
                <tbody><tr><td colspan="8" class="empty-message">加载中...</td></tr></tbody>
            </table>
        </div>
        `;
    },

    getEmailSettingsHTML: function(embedded = false) {
        return `
        ${embedded ? '<div class="settings-section-heading"><div><h3>系统邮箱配置</h3><p>用于发送忘记密码验证码，仅超级管理员可查看和修改。</p></div></div>' : '<div class="page-header"><div><h2>系统邮箱配置</h2><p class="page-subtitle">用于发送忘记密码验证码，仅超级管理员可查看和修改。</p></div></div>'}
        <div class="dashboard-panel email-settings-panel">
            <form id="email-settings-form" class="email-settings-grid">
                <div class="form-group"><label>SMTP 服务器</label><input name="smtp_host" class="form-control" placeholder="smtp.example.com" required></div>
                <div class="form-group"><label>SMTP 端口</label><input name="smtp_port" type="number" class="form-control" value="587" required></div>
                <div class="form-group"><label>SMTP 用户名</label><input name="smtp_username" class="form-control" autocomplete="username"></div>
                <div class="form-group"><label>SMTP 密码 / 授权码</label><div class="password-field-wrap"><input name="smtp_password" id="smtp-password" type="password" class="form-control" placeholder="留空表示保持原密码" autocomplete="new-password"><button type="button" class="password-toggle" onclick="Auth.togglePassword('smtp-password', this)"><i class="fas fa-eye"></i></button></div><small id="smtp-password-state">尚未配置密码</small></div>
                <div class="form-group"><label>发件邮箱</label><input name="sender_email" type="email" class="form-control" placeholder="mineops@example.com" required></div>
                <div class="form-group"><label>发件人名称</label><input name="sender_name" class="form-control" value="MineOps"></div>
                <label class="email-setting-check"><input name="use_tls" type="checkbox" checked> 使用 STARTTLS</label>
                <label class="email-setting-check"><input name="use_ssl" type="checkbox"> 使用 SSL</label>
                <label class="email-setting-check"><input name="enabled" type="checkbox" checked> 启用密码找回邮件</label>
            </form>
            <div class="email-settings-actions">
                <button class="btn btn-primary" id="save-email-settings"><i class="fas fa-save"></i> 保存配置</button>
                <input id="email-test-recipient" type="email" class="form-control" placeholder="测试收件邮箱">
                <button class="btn btn-secondary" id="test-email-settings"><i class="fas fa-paper-plane"></i> 发送测试邮件</button>
            </div>
            <p id="email-settings-status" class="page-subtitle"></p>
        </div>`;
    },

    getSettingsCenterHTML: function() {
        const isSuper = Auth.isSuperAdmin?.();
        const isManager = ['super', 'mine'].includes(Auth.getUserRole?.());
        return `
        <div class="page-header settings-page-header">
            <div><h2>设置中心</h2><p class="page-subtitle">账户、安全、提醒、报表和数据治理集中管理。</p></div>
        </div>
        <div class="settings-center-shell">
            <nav class="settings-tabs" aria-label="设置分类">
                <button type="button" class="settings-tab active" data-settings-tab="account" onclick="UI.switchSettingsTab('account')">
                    <i class="fas fa-user-gear"></i><span>账户设置</span>
                </button>
                <button type="button" class="settings-tab" data-settings-tab="reminders" onclick="UI.switchSettingsTab('reminders')"><i class="fas fa-bell"></i><span>提醒中心</span></button>
                <button type="button" class="settings-tab" data-settings-tab="reports" onclick="UI.switchSettingsTab('reports')"><i class="fas fa-chart-column"></i><span>报表中心</span></button>
                ${isManager ? '<button type="button" class="settings-tab" data-settings-tab="governance" onclick="UI.switchSettingsTab(\'governance\')"><i class="fas fa-database"></i><span>数据治理</span></button>' : ''}
                ${isSuper ? '<button type="button" class="settings-tab" data-settings-tab="security" onclick="UI.switchSettingsTab(\'security\')"><i class="fas fa-shield-halved"></i><span>安全中心</span></button>' : ''}
                ${isSuper ? '<button type="button" class="settings-tab" data-settings-tab="audit" onclick="UI.switchSettingsTab(\'audit\')"><i class="fas fa-clock-rotate-left"></i><span>操作日志</span></button>' : ''}
                ${isSuper ? '<button type="button" class="settings-tab" data-settings-tab="email" onclick="UI.switchSettingsTab(\'email\')"><i class="fas fa-envelope-circle-check"></i><span>邮箱配置</span></button>' : ''}
                <button type="button" class="settings-tab" data-settings-tab="downloads" onclick="UI.switchSettingsTab('downloads')">
                    <i class="fas fa-download"></i><span>软件下载</span>
                </button>
            </nav>
            <section id="settings-panel" class="settings-panel">${this.getAccountSettingsHTML(true)}</section>
        </div>`;
    },

    switchSettingsTab: function(tab) {
        const superOnly = ['email', 'security', 'audit'];
        if (superOnly.includes(tab) && !Auth.isSuperAdmin?.()) tab = 'account';
        if (tab === 'governance' && !['super', 'mine'].includes(Auth.getUserRole?.())) tab = 'account';
        const panel = document.getElementById('settings-panel');
        if (!panel) return;
        document.querySelectorAll('.settings-tab').forEach(button => {
            button.classList.toggle('active', button.dataset.settingsTab === tab);
        });
        if (tab === 'reminders') {
            panel.innerHTML = this.getReminderCenterHTML();
            this.setupReminderCenter();
            this.loadReminders();
        } else if (tab === 'reports') {
            panel.innerHTML = this.getReportCenterHTML();
            this.setupReportCenter();
            this.loadReportOverview();
        } else if (tab === 'governance') {
            panel.innerHTML = this.getGovernanceHTML();
            this.setupGovernance();
            this.loadGovernance();
        } else if (tab === 'security') {
            panel.innerHTML = this.getSecurityCenterHTML();
            this.setupSecurityCenter();
            this.loadSecuritySettings();
        } else if (tab === 'audit') {
            panel.innerHTML = this.getAuditLogHTML();
            this.setupAuditLog();
            this.loadAuditLogs();
        } else if (tab === 'email') {
            panel.innerHTML = this.getEmailSettingsHTML(true);
            this.setupEmailSettings();
            this.loadEmailSettings();
        } else if (tab === 'downloads') {
            panel.innerHTML = this.getAppReleaseHTML(true);
            const refresh = document.getElementById('refresh-release-btn');
            if (refresh) refresh.onclick = () => this.loadAppRelease();
            this.loadAppRelease();
        } else {
            panel.innerHTML = this.getAccountSettingsHTML(true);
            this.setupAccountSettings();
            this.loadAccountSettings();
        }
    },

    getAccountSettingsHTML: function(embedded = false) {
        const user = Auth.currentUser || {};
        const roleLabel = user.role === 'super' ? '超级管理员' : user.role === 'mine' ? '矿山子管理员' : '矿山子用户';
        return `
        ${embedded ? '' : '<div class="page-header"><div><h2>账户设置</h2><p class="page-subtitle">管理自己的登录信息与密码安全。</p></div></div>'}
        <div class="account-settings-layout">
            <section class="dashboard-panel account-settings-card">
                <div class="account-settings-heading"><span class="account-settings-icon"><i class="fas fa-address-card"></i></span><div><h3>账户资料</h3><p>修改用户名后当前登录会话会自动更新。</p></div></div>
                <form id="account-profile-form">
                    <div class="form-group"><label>用户名</label><input name="username" class="form-control" value="${this.escapeAttr(user.username || '')}" autocomplete="username" required></div>
                    <div class="form-group"><label>显示名称</label><input name="display_name" class="form-control" value="${this.escapeAttr(user.display_name || '')}" required></div>
                    <div class="form-group"><label>绑定邮箱</label><input name="email" type="email" class="form-control" value="${this.escapeAttr(user.email || '')}" placeholder="用于忘记密码找回" autocomplete="email"></div>
                    <div class="account-readonly-grid"><div><span>账户角色</span><strong>${roleLabel}</strong></div><div><span>所属矿山</span><strong>${this.escapeHtml(user.mine_name || '全部矿山')}</strong></div></div>
                    <button type="button" id="save-account-profile" class="btn btn-primary"><i class="fas fa-save"></i> 保存账户资料</button>
                </form>
            </section>
            <section class="dashboard-panel account-settings-card">
                <div class="account-settings-heading"><span class="account-settings-icon secure"><i class="fas fa-shield-halved"></i></span><div><h3>修改密码</h3><p>修改前需要验证当前密码。</p></div></div>
                <form id="account-password-form">
                    ${this.getAccountPasswordField('account-current-password', 'current_password', '当前密码')}
                    ${this.getAccountPasswordField('account-new-password', 'new_password', '新密码，默认至少 8 位并包含数字')}
                    ${this.getAccountPasswordField('account-confirm-password', 'confirm_password', '再次输入新密码')}
                    <button type="button" id="save-account-password" class="btn btn-primary"><i class="fas fa-key"></i> 修改密码</button>
                </form>
            </section>
        </div>`;
    },

    getAccountPasswordField: function(id, name, label) {
        return `<div class="form-group"><label>${label}</label><div class="password-field-wrap"><input id="${id}" name="${name}" type="password" class="form-control" autocomplete="${name === 'current_password' ? 'current-password' : 'new-password'}"><button type="button" class="password-toggle" onclick="Auth.togglePassword('${id}', this)" aria-label="显示密码"><i class="fas fa-eye"></i></button></div></div>`;
    },

    getSettingsMineField: function(id) {
        if (!Auth.isSuperAdmin?.()) return '';
        const options = (this.cache.mines || []).map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`).join('');
        return `<label>矿山<select id="${id}" class="form-control"><option value="">全部矿山</option>${options}</select></label>`;
    },

    getReminderCenterHTML: function() {
        return `<div class="settings-section-heading"><div><h3>统一提醒中心</h3><p>汇总车辆证件、设备保养、超时工时和账户邮箱提醒。</p></div>
            <div class="settings-inline-controls">${this.getSettingsMineField('reminder-mine')}<label>提前<select id="reminder-days" class="form-control"><option value="7">7 天</option><option value="30" selected>30 天</option><option value="60">60 天</option><option value="90">90 天</option></select></label><button id="refresh-reminders" class="btn btn-secondary"><i class="fas fa-rotate"></i> 刷新</button></div></div>
            <div id="reminder-summary" class="settings-kpi-grid"></div><div id="reminder-list" class="settings-list"><p class="empty-message">加载中...</p></div>`;
    },

    setupReminderCenter: function() {
        document.getElementById('refresh-reminders')?.addEventListener('click', () => this.loadReminders());
        document.getElementById('reminder-days')?.addEventListener('change', () => this.loadReminders());
        document.getElementById('reminder-mine')?.addEventListener('change', () => this.loadReminders());
    },

    loadReminderBadge: function() {
        API.adminTools.reminders({ days_ahead: 30 }).then(data => {
            const badge = document.getElementById('reminder-center-badge');
            if (!badge) return;
            badge.textContent = data.total || 0;
            badge.classList.toggle('hidden', !data.total);
        }).catch(() => {});
    },

    loadReminders: function() {
        const params = { days_ahead: document.getElementById('reminder-days')?.value || 30 };
        const mineId = document.getElementById('reminder-mine')?.value;
        if (mineId) params.mine_id = mineId;
        API.adminTools.reminders(params).then(data => {
            const summary = document.getElementById('reminder-summary');
            const list = document.getElementById('reminder-list');
            if (summary) summary.innerHTML = `<div><span>全部提醒</span><strong>${data.total || 0}</strong></div><div class="danger"><span>已逾期</span><strong>${data.danger || 0}</strong></div><div class="warning"><span>即将到期</span><strong>${data.warning || 0}</strong></div><div><span>信息提示</span><strong>${data.info || 0}</strong></div>`;
            if (list) list.innerHTML = data.items?.length ? data.items.map(item => `<article class="settings-list-item ${item.level}"><span class="settings-list-icon"><i class="fas ${item.level === 'danger' ? 'fa-triangle-exclamation' : item.level === 'warning' ? 'fa-clock' : 'fa-circle-info'}"></i></span><div><strong>${this.escapeHtml(item.title)}</strong><p>${this.escapeHtml(item.detail || '')}${item.days_remaining < 0 ? ` · 已逾期 ${Math.abs(item.days_remaining)} 天` : item.days_remaining > 0 ? ` · 剩余 ${item.days_remaining} 天` : ''}</p></div></article>`).join('') : '<p class="empty-message">当前没有需要处理的提醒</p>';
            this.loadReminderBadge();
        }).catch(error => this.showError('加载提醒失败: ' + error.message));
    },

    getReportCenterHTML: function() {
        const month = new Date().toISOString().slice(0, 7);
        return `<div class="settings-section-heading"><div><h3>月度报表中心</h3><p>统一查看财务、运输、工时、油耗和车牌趟数。</p></div><div class="settings-inline-controls">${this.getSettingsMineField('report-mine')}<label>月份<input id="report-month" type="month" class="form-control" value="${month}"></label><button id="refresh-report" class="btn btn-primary"><i class="fas fa-chart-line"></i> 生成报表</button></div></div>
            <div id="report-overview" class="settings-kpi-grid report-kpi-grid"><p class="empty-message">加载中...</p></div>
            <div class="dashboard-panel report-export-panel"><h3>导出数据</h3><p class="page-subtitle">导出时会自动使用当前月份和矿山范围。</p><div class="report-export-actions"><button data-report-export="finance" class="btn btn-secondary"><i class="fas fa-wallet"></i> 财务明细</button><button data-report-export="hours" class="btn btn-secondary"><i class="fas fa-clock"></i> 工时明细</button><button data-report-export="plates" class="btn btn-secondary"><i class="fas fa-id-card"></i> 车牌月报</button><button data-report-export="fleet" class="btn btn-secondary"><i class="fas fa-truck"></i> 车队台账</button></div></div>`;
    },

    setupReportCenter: function() {
        document.getElementById('refresh-report')?.addEventListener('click', () => this.loadReportOverview());
        document.querySelectorAll('[data-report-export]').forEach(button => button.onclick = () => this.exportSettingsReport(button.dataset.reportExport));
    },

    getReportParams: function() {
        const yearMonth = document.getElementById('report-month')?.value || new Date().toISOString().slice(0, 7);
        const mineId = document.getElementById('report-mine')?.value || '';
        return { year_month: yearMonth, mine_id: mineId };
    },

    loadReportOverview: function() {
        const params = this.getReportParams();
        if (!/^\d{4}-\d{2}$/.test(params.year_month)) { this.showError('请选择报表月份'); return; }
        API.adminTools.reportOverview(params).then(data => {
            const panel = document.getElementById('report-overview');
            if (!panel) return;
            panel.innerHTML = `<div><span>财务记录</span><strong>${data.finance_records || 0}</strong></div><div><span>装车记录</span><strong>${data.shipping_records || 0}</strong></div><div><span>设备工时</span><strong>${data.work_hours || 0} h</strong></div><div><span>设备油耗</span><strong>${data.fuel_liters || 0} L</strong></div><div><span>车牌趟数</span><strong>${data.plate_trips || 0}</strong><small>${data.plate_saved_days || 0} 个保存日</small></div><div><span>人员 / 设备</span><strong>${data.employee_count || 0} / ${data.equipment_count || 0}</strong></div>`;
        }).catch(error => this.showError('生成报表失败: ' + error.message));
    },

    exportSettingsReport: function(type) {
        const { year_month, mine_id } = this.getReportParams();
        const [year, month] = year_month.split('-');
        const start_date = `${year_month}-01`;
        const end_date = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
        const mineParams = mine_id ? { mine_id } : {};
        const tasks = {
            finance: () => API.financeImport.exportExcel({ ...mineParams, start_date, end_date }),
            hours: () => API.equipmentHours.exportExcel({ ...mineParams, start_date, end_date }),
            plates: () => API.plateCounter.exportMonthly({ ...mineParams, year_month }),
            fleet: () => API.fleet.exportWorkbook(mineParams)
        };
        tasks[type]?.().catch(error => this.showError('导出失败: ' + error.message));
    },

    getSecurityCenterHTML: function() {
        return `<div class="settings-section-heading"><div><h3>安全中心</h3><p>控制登录锁定、密码强度、会话时长和敏感操作确认。</p></div></div><div class="dashboard-panel"><form id="security-settings-form" class="security-settings-grid"><div class="form-group"><label>最大失败次数</label><input name="max_login_attempts" type="number" min="3" max="20" class="form-control"></div><div class="form-group"><label>锁定时间（分钟）</label><input name="lock_minutes" type="number" min="1" max="1440" class="form-control"></div><div class="form-group"><label>密码最短长度</label><input name="password_min_length" type="number" min="6" max="32" class="form-control"></div><div class="form-group"><label>会话时长（分钟）</label><input name="session_minutes" type="number" min="30" max="1440" class="form-control"></div><label class="email-setting-check"><input name="require_number" type="checkbox"> 密码必须包含数字</label><label class="email-setting-check"><input name="require_mixed_case" type="checkbox"> 密码必须包含大小写字母</label><label class="email-setting-check"><input name="confirm_sensitive_actions" type="checkbox"> 敏感操作要求二次确认</label></form><button id="save-security-settings" class="btn btn-primary"><i class="fas fa-shield"></i> 保存安全策略</button></div>`;
    },

    setupSecurityCenter: function() { document.getElementById('save-security-settings')?.addEventListener('click', () => this.saveSecuritySettings()); },
    loadSecuritySettings: function() {
        API.adminTools.getSecurity().then(data => {
            const form = document.getElementById('security-settings-form'); if (!form) return;
            Object.entries(data).forEach(([key, value]) => { const field = form.elements[key]; if (field) field.type === 'checkbox' ? field.checked = !!value : field.value = value; });
        }).catch(error => this.showError('加载安全策略失败: ' + error.message));
    },
    saveSecuritySettings: function() {
        const form = document.getElementById('security-settings-form'); if (!form) return;
        const raw = Object.fromEntries(new FormData(form).entries());
        const data = { max_login_attempts: Number(raw.max_login_attempts), lock_minutes: Number(raw.lock_minutes), password_min_length: Number(raw.password_min_length), session_minutes: Number(raw.session_minutes), require_number: form.elements.require_number.checked, require_mixed_case: form.elements.require_mixed_case.checked, confirm_sensitive_actions: form.elements.confirm_sensitive_actions.checked };
        API.adminTools.updateSecurity(data).then(() => this.showSuccess('安全策略已保存')).catch(error => this.showError('保存失败: ' + error.message));
    },

    getAuditLogHTML: function() {
        return `<div class="settings-section-heading"><div><h3>操作日志</h3><p>记录登录、新增、修改、删除、导入和导出操作。</p></div><div class="settings-inline-controls"><input id="audit-username" class="form-control" placeholder="用户名"><select id="audit-action" class="form-control"><option value="">全部操作</option><option>LOGIN</option><option>LOGIN_FAILED</option><option>CREATE</option><option>UPDATE</option><option>DELETE</option><option>IMPORT</option><option>EXPORT</option></select><button id="refresh-audit" class="btn btn-secondary">查询</button></div></div><div id="audit-summary" class="settings-kpi-grid"></div><div class="table-responsive table-container"><table class="data-table"><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>模块</th><th>详情</th><th>IP</th></tr></thead><tbody id="audit-log-body"><tr><td colspan="6" class="empty-message">加载中...</td></tr></tbody></table></div>`;
    },
    setupAuditLog: function() { document.getElementById('refresh-audit')?.addEventListener('click', () => this.loadAuditLogs()); },
    loadAuditLogs: function() {
        const params = { limit: 300, username: document.getElementById('audit-username')?.value || '', action: document.getElementById('audit-action')?.value || '' };
        Promise.all([API.audit.list(params), API.audit.stats()]).then(([logs, stats]) => {
            const summary = document.getElementById('audit-summary');
            if (summary) summary.innerHTML = `<div><span>日志总数</span><strong>${stats.total_logs || 0}</strong></div>${(stats.by_action || []).slice(0, 3).map(item => `<div><span>${this.escapeHtml(item.action)}</span><strong>${item.count}</strong></div>`).join('')}`;
            const body = document.getElementById('audit-log-body');
            if (body) body.innerHTML = logs.length ? logs.map(row => `<tr><td>${new Date(row.created_at).toLocaleString()}</td><td>${this.escapeHtml(row.username || '')}</td><td><span class="audit-action">${this.escapeHtml(row.action)}</span></td><td>${this.escapeHtml(row.resource)}</td><td>${this.escapeHtml(row.detail || '')}</td><td>${this.escapeHtml(row.ip_address || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-message">暂无日志</td></tr>';
        }).catch(error => this.showError('加载操作日志失败: ' + error.message));
    },

    getGovernanceHTML: function() {
        const month = new Date().toISOString().slice(0, 7);
        return `<div class="settings-section-heading"><div><h3>数据治理</h3><p>结账后锁定月份，误删数据可从回收站恢复。</p></div></div><div class="dashboard-panel governance-lock-form"><h3>月份锁定</h3><div class="settings-inline-controls">${this.getSettingsMineField('lock-mine')}<label>模块<select id="lock-module" class="form-control"><option value="all">全部核心数据</option><option value="finance">财务</option><option value="shipping">运输</option><option value="worklogs">设备工时</option><option value="plate-counter">车牌比对</option></select></label><label>月份<input id="lock-month" type="month" class="form-control" value="${month}"></label><button id="create-period-lock" class="btn btn-primary"><i class="fas fa-lock"></i> 锁定月份</button></div><div id="period-lock-list" class="settings-chip-list"></div></div><div class="dashboard-panel mt-20"><div class="settings-section-heading"><div><h3>回收站</h3><p>删除记录会保留原始快照，可一键恢复。</p></div><button id="refresh-recycle" class="btn btn-secondary">刷新</button></div><div class="table-responsive"><table class="data-table"><thead><tr><th>删除时间</th><th>模块</th><th>记录 ID</th><th>删除人</th><th>操作</th></tr></thead><tbody id="recycle-bin-body"><tr><td colspan="5" class="empty-message">加载中...</td></tr></tbody></table></div></div>`;
    },
    setupGovernance: function() {
        document.getElementById('create-period-lock')?.addEventListener('click', () => this.createPeriodLock());
        document.getElementById('refresh-recycle')?.addEventListener('click', () => this.loadGovernance());
    },
    loadGovernance: function() {
        Promise.all([API.adminTools.locks({}), API.adminTools.recycleBin()]).then(([locks, items]) => {
            const lockList = document.getElementById('period-lock-list');
            if (lockList) lockList.innerHTML = locks.length ? locks.map(lock => `<span class="settings-chip"><i class="fas fa-lock"></i>${this.escapeHtml(lock.year_month)} · ${this.escapeHtml(lock.module)}<button onclick="UI.deletePeriodLock('${lock.id}')" title="解锁"><i class="fas fa-xmark"></i></button></span>`).join('') : '<p class="empty-message">暂无锁定月份</p>';
            const body = document.getElementById('recycle-bin-body');
            if (body) body.innerHTML = items.length ? items.map(item => `<tr><td>${new Date(item.deleted_at).toLocaleString()}</td><td>${this.escapeHtml(item.resource)}</td><td>${this.escapeHtml(item.resource_id)}</td><td>${this.escapeHtml(item.deleted_by || '')}</td><td><button class="btn btn-secondary btn-sm" onclick="UI.restoreRecycleItem('${item.id}')"><i class="fas fa-rotate-left"></i> 恢复</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-message">回收站为空</td></tr>';
        }).catch(error => this.showError('加载数据治理失败: ' + error.message));
    },
    createPeriodLock: function() {
        const data = { module: document.getElementById('lock-module')?.value, year_month: document.getElementById('lock-month')?.value, mine_id: document.getElementById('lock-mine')?.value || Auth.getUserMineId?.() || null };
        if (!data.mine_id) { this.showError('请选择矿山'); return; }
        if (!confirm(`锁定 ${data.year_month} 后，该月份数据将不能新增、修改或删除。确定继续吗？`)) return;
        API.adminTools.createLock(data).then(() => { this.showSuccess('月份已锁定'); this.loadGovernance(); }).catch(error => this.showError('锁定失败: ' + error.message));
    },
    deletePeriodLock: function(id) { if (confirm('确定解除该月份锁定吗？')) API.adminTools.deleteLock(id).then(() => { this.showSuccess('月份已解锁'); this.loadGovernance(); }).catch(error => this.showError('解锁失败: ' + error.message)); },
    restoreRecycleItem: function(id) { if (confirm('确定恢复这条数据吗？')) API.adminTools.restore(id).then(() => { this.showSuccess('数据已恢复'); this.loadGovernance(); }).catch(error => this.showError('恢复失败: ' + error.message)); },

    getEmployeesHTML: function() {
        const today = new Date().toISOString().split('T')[0];
        return `
        <div class="page-header">
            <h2>员工管理</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增员工</button>
                ${this.getImportExportButtons('employees')}
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-user-check"></i></div><div class="stat-info"><h3 id="emp-today-count">--</h3><p>今日出勤人数</p></div></div>
            <div class="stat-card amber"><div class="stat-icon stat-icon-amber"><i class="fas fa-person-walking"></i></div><div class="stat-info"><h3 id="emp-active-count">--</h3><p>正在上班</p></div></div>
            <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-clock"></i></div><div class="stat-info"><h3 id="emp-today-hours">--</h3><p>今日签到工时</p></div></div>
            <div class="stat-card blue"><div class="stat-icon stat-icon-blue"><i class="fas fa-calendar-days"></i></div><div class="stat-info"><h3 id="emp-month-hours">--</h3><p>本月签到工时</p></div></div>
        </div>
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="employees-list">员工档案</button>
            <button class="sub-tab" data-sub="employees-attendance">签到记录</button>
            <button class="sub-tab" data-sub="employees-active">正在上班</button>
        </div>
        <div id="employees-list" class="sub-page active">
            <div class="table-responsive table-container">
                <table class="data-table" id="employees-table">
                    <thead><tr><th>法文名</th><th>中文名</th><th>人员类型</th><th>职位</th><th>薪资</th><th>货币</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="7" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="employees-attendance" class="sub-page">
            <div class="search-bar">
                <input type="date" id="attendance-start-date" class="form-control w-150" value="${today}">
                <input type="date" id="attendance-end-date" class="form-control w-150" value="${today}">
                <select id="attendance-employee-filter" class="form-control" style="max-width:260px"><option value="">全部员工</option></select>
                <select id="attendance-status-filter" class="form-control w-150">
                    <option value="">全部状态</option>
                    <option value="checked_in">已签到</option>
                    <option value="checked_out">已签退</option>
                </select>
                <button class="btn btn-secondary" id="attendance-filter-btn"><i class="fas fa-filter"></i> 筛选</button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="employee-attendance-table">
                    <thead><tr><th>员工</th><th>职位</th><th>签到时间</th><th>签退时间</th><th>时长</th><th>状态</th><th>记录人</th><th>备注</th></tr></thead>
                    <tbody><tr><td colspan="8" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="employees-active" class="sub-page">
            <div id="employee-active-list" class="today-worklog-list"><p class="empty-message">加载中...</p></div>
        </div>
        `;
    },

    // ── Equipment Page ──
    getEquipmentHTML: function() {
        return `
        <div class="page-header">
            <h2>设备管理</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增设备</button>
                ${this.getImportExportButtons('equipment')}
            </div>
        </div>
        <!-- Filters -->
        <div class="search-bar">
            <input type="text" id="equipment-search" class="form-control" style="max-width:250px" placeholder="搜索设备名称/代码/品牌...">
            <select id="equipment-type-filter" class="form-control w-150"><option value="">全部类别</option>${this.getEquipmentCategoryOptionHtml()}</select>
            <select id="equipment-status-filter" class="form-control w-130"><option value="">全部状态</option><option value="active">运行中</option><option value="inactive">闲置中</option><option value="maintenance">维修中</option></select>
        </div>
        <!-- Sub Tabs -->
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="eq-list">设备列表</button>
            <button class="sub-tab" data-sub="eq-hours-stats">工时统计</button>
            <button class="sub-tab" data-sub="eq-summary">月度汇总</button>
            <button class="sub-tab" data-sub="eq-detail">工作明细</button>
        </div>
        <!-- Sub Pages -->
        <div id="eq-list" class="sub-page active">
            <div class="table-responsive table-container">
                <table class="data-table" id="equipment-table">
                    <thead><tr><th>设备代码</th><th>名称</th><th>品牌</th><th>设备类别</th><th>短号</th><th>矿山</th><th>状态</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="10" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="eq-hours-stats" class="sub-page">
            <div class="filter-bar">
                <label>年份 <input type="number" id="stats-year" class="w-130" placeholder="2026"></label>
                <label>月份 <input type="number" id="stats-month" class="w-130" placeholder="4" min="1" max="12"></label>
                ${this.getEquipmentReportMineFilter('stats-mine-filter')}
                <button class="btn btn-primary btn-sm" id="load-equipment-stats-btn">查询统计</button>
            </div>
            <div class="stats-grid">
                <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-clock"></i></div><div class="stat-info"><h3 id="eq-stat-total-hours">--</h3><p>总工时</p></div></div>
                <div class="stat-card orange"><div class="stat-icon stat-icon-orange"><i class="fas fa-gas-pump"></i></div><div class="stat-info"><h3 id="eq-stat-total-fuel">--</h3><p>总油耗</p></div></div>
                <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-truck-monster"></i></div><div class="stat-info"><h3 id="eq-stat-active">--</h3><p>有记录设备</p></div></div>
                <div class="stat-card blue"><div class="stat-icon stat-icon-blue"><i class="fas fa-chart-line"></i></div><div class="stat-info"><h3 id="eq-stat-util">--</h3><p>平均利用率</p></div></div>
            </div>
            <div class="table-responsive table-container"><div id="equipment-stats-content" class="empty-message">请选择年月查询</div></div>
        </div>
        <div id="eq-detail" class="sub-page">
            <div class="filter-bar">
                <label>年份 <input type="number" id="detail-year" class="w-130" placeholder="2026"></label>
                <label>月份 <input type="number" id="detail-month" class="w-130" placeholder="4" min="1" max="12"></label>
                ${this.getEquipmentReportMineFilter('detail-mine-filter')}
                <button class="btn btn-primary btn-sm" id="load-detail-btn">查询明细</button>
                <button class="btn btn-secondary btn-sm" id="export-detail-btn">导出设备工作时间明细表</button>
            </div>
            <div class="table-responsive table-container"><div id="monthly-detail-content" class="empty-message">请选择年月查询</div></div>
        </div>
        <div id="eq-summary" class="sub-page">
            <div class="filter-bar">
                <label>年份 <input type="number" id="summary-year" class="w-130" placeholder="2026"></label>
                <label>月份 <input type="number" id="summary-month" class="w-130" placeholder="4" min="1" max="12"></label>
                ${this.getEquipmentReportMineFilter('summary-mine-filter')}
                <button class="btn btn-primary btn-sm" id="load-summary-btn">查询汇总</button>
                <button class="btn btn-secondary btn-sm" id="export-summary-btn">导出设备月度汇总工时表</button>
            </div>
            <div class="table-responsive table-container"><div id="monthly-summary-content" class="empty-message">请选择年月查询</div></div>
        </div>
        `;
    },

    // ── Ops Intelligence ──
    getOpsIntelligenceHTML: function() {
        return `
        <div class="page-header">
            <h2>智能运营中心</h2>
            <div class="page-actions">
                <select id="ops-mine-filter" class="form-control w-180 hidden"></select>
                <select id="ops-days" class="form-control w-130">
                    <option value="7">近 7 天</option>
                    <option value="30" selected>近 30 天</option>
                    <option value="90">近 90 天</option>
                    <option value="180">近 180 天</option>
                </select>
                <button class="btn btn-primary" onclick="UI.loadOpsIntelligence()"><i class="fas fa-rotate"></i> 刷新</button>
            </div>
        </div>

        <div class="ops-hero">
            <div>
                <div class="ops-eyebrow" id="ops-mine-name">--</div>
                <h2 id="ops-health-label">--</h2>
                <p id="ops-period">--</p>
            </div>
            <div class="ops-score">
                <span id="ops-score">--</span>
                <small>健康分</small>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-clock"></i></div><div class="stat-info"><h3 id="ops-total-hours">--</h3><p>总工时</p></div></div>
            <div class="stat-card orange"><div class="stat-icon stat-icon-orange"><i class="fas fa-gas-pump"></i></div><div class="stat-info"><h3 id="ops-fuel-rate">--</h3><p>单位油耗 L/h</p></div></div>
            <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-truck"></i></div><div class="stat-info"><h3 id="ops-shipping-trips">--</h3><p>运输记录</p></div></div>
            <div class="stat-card purple"><div class="stat-icon stat-icon-purple"><i class="fas fa-id-card"></i></div><div class="stat-info"><h3 id="ops-plate-trips">--</h3><p>车牌比对趟数</p></div></div>
            <div class="stat-card blue"><div class="stat-icon stat-icon-blue"><i class="fas fa-truck-monster"></i></div><div class="stat-info"><h3 id="ops-active-devices">--</h3><p>活跃设备</p></div></div>
            <div class="stat-card amber"><div class="stat-icon stat-icon-amber"><i class="fas fa-triangle-exclamation"></i></div><div class="stat-info"><h3 id="ops-alert-count">--</h3><p>预警项</p></div></div>
        </div>

        <div class="chart-row mt-20">
            <div class="chart-container ops-span">
                <h3>运营趋势</h3>
                <canvas id="ops-trend-chart"></canvas>
            </div>
        </div>

        <div class="ops-grid mt-20">
            <div class="chart-container">
                <h3>风险预警</h3>
                <div id="ops-alert-list" class="ops-list"><p class="empty-message">加载中...</p></div>
            </div>
            <div class="chart-container">
                <h3>优化建议</h3>
                <div id="ops-recommendation-list" class="ops-list"><p class="empty-message">加载中...</p></div>
            </div>
        </div>

        <div class="ops-grid mt-20">
            <div class="chart-container">
                <h3>设备利用排行</h3>
                <div id="ops-equipment-ranking"><p class="empty-message">加载中...</p></div>
            </div>
            <div class="chart-container">
                <h3>数据健康</h3>
                <div id="ops-data-health" class="ops-health-grid"></div>
                <div id="ops-unknown-plates" class="mt-20"></div>
            </div>
        </div>

        <div class="chart-container mt-20">
            <h3>智慧矿山升级路线</h3>
            <div id="ops-roadmap" class="ops-roadmap"></div>
        </div>
        `;
    },

    getSmartWorklogEntryHTML: function() {
        return `
        <div class="smart-entry-container">
            <div class="smart-entry-left">
                  <h3>严格补录 · 多日工时解析</h3>
                  <textarea id="smart-parse-text" class="smart-parse-textarea" placeholder="2026.6.3白天&#10;【钩机/炮机】&#10;4号三一钩机【7:00-12:00 13:00-18:00】（赵总）&#10;&#10;2026.6.3晚班&#10;设备名称【19:00-23:00 00:00-06:00】（备注）"></textarea>
                <div class="smart-entry-actions">
                    <select id="smart-parse-type" class="form-control w-150">
                        <option value="auto">自动识别</option>
                        <option value="whatsapp">WhatsApp消息</option>
                        <option value="natural">中文自然语言</option>
                    </select>
                      <button class="btn btn-primary" id="smart-parse-btn"><i class="fas fa-magnifying-glass-check"></i> 严格解析</button>
                      <span class="parse-hint">存在任何不确定项时将阻止保存。</span>
                </div>
                <div id="parse-preview" class="parse-preview"></div>
                <div id="parse-batch-actions" class="parse-batch-actions hidden">
                    <button class="btn btn-secondary btn-sm" id="parse-check-all">全选</button>
                    <button class="btn btn-secondary btn-sm" id="parse-uncheck-all">取消全选</button>
                      <button class="btn btn-primary btn-sm" id="parse-batch-save"><i class="fas fa-save"></i> 确认并保存补录</button>
                </div>
            </div>
            <div class="smart-entry-right">
                <h3>今日补录日志</h3>
                <input type="date" id="today-worklog-date" class="form-control" style="margin-bottom:12px;">
                <button class="btn btn-secondary btn-sm btn-block" id="load-today-worklogs-btn">刷新</button>
                <div id="today-worklog-list" class="today-worklog-list mt-20" style="max-height:360px;overflow-y:auto;"></div>
            </div>
        </div>
        `;
    },

    // ── Equipment Hours Page ──
    getEquipmentHoursHTML: function() {
        return `
        <div class="page-header">
            <h2>设备工时</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="eh-start-btn"><i class="fas fa-play"></i> 开始工作</button>
                <button class="btn btn-secondary" id="eh-export-btn"><i class="fas fa-download"></i> 导出</button>
            </div>
        </div>
        <div class="page-header" style="margin-bottom:14px;">
            <h2>工时模块</h2>
        </div>
        <div class="stats-grid">
            <div class="stat-card amber"><div class="stat-icon stat-icon-amber"><i class="fas fa-clock"></i></div><div class="stat-info"><h3 id="eh-today-hours">--</h3><p>今日工时 (h)</p></div></div>
            <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-calendar"></i></div><div class="stat-info"><h3 id="eh-month-hours">--</h3><p>本月工时 (h)</p></div></div>
            <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-person-digging"></i></div><div class="stat-info"><h3 id="eh-active-count">--</h3><p>进行中记录</p></div></div>
            <div class="stat-card blue"><div class="stat-icon stat-icon-blue"><i class="fas fa-list-check"></i></div><div class="stat-info"><h3 id="eh-record-count">--</h3><p>筛选记录</p></div></div>
        </div>
        <div class="chart-row">
            <div class="chart-container">
                <h3>近 7 日工时趋势</h3>
                <canvas id="eh-daily-chart"></canvas>
            </div>
            <div class="chart-container">
                <h3>当前工作中</h3>
                <div id="eh-active-list"><p class="empty-message">加载中...</p></div>
            </div>
        </div>
        <div class="search-bar">
            <input type="date" id="eh-start-date" class="form-control w-150">
            <input type="date" id="eh-end-date" class="form-control w-150">
            <select id="eh-equipment-filter" class="form-control" style="max-width:260px"><option value="">全部设备</option></select>
            <select id="eh-status-filter" class="form-control w-150">
                <option value="">全部状态</option>
                <option value="in_progress">工作中</option>
                <option value="completed">已完成</option>
                <option value="manual">手动补录</option>
            </select>
            <button class="btn btn-secondary" id="eh-filter-btn"><i class="fas fa-filter"></i> 筛选</button>
            <div class="agave-batch-actions" id="eh-batch-actions" style="display:none">
                <span class="agave-footer-hint" id="eh-batch-count">已选 0 条</span>
                <button class="btn btn-danger btn-sm" id="eh-batch-delete-btn"><i class="fas fa-trash"></i> 批量删除</button>
                <button class="btn btn-secondary btn-sm" id="eh-batch-clear-btn">取消选择</button>
            </div>
        </div>
        <div class="table-responsive table-container">
            <table class="data-table" id="equipment-hours-table">
                <thead><tr><th style="width:40px"><input type="checkbox" id="eh-select-all" title="全选"></th><th>操作员</th><th>设备编号</th><th>设备名称</th><th>开始时间</th><th>结束时间</th><th>工时</th><th>状态</th><th>备注</th><th style="width:120px">操作</th></tr></thead>
                <tbody><tr><td colspan="10" class="empty-message">加载中...</td></tr></tbody>
            </table>
        </div>
        <div class="page-header" style="margin-top:24px;margin-bottom:14px;">
            <h2>加油模块</h2>
        </div>
        <div class="chart-container">
            <h3>批量登记设备加油</h3>
            <div class="filter-bar">
                <label>日期 <input type="date" id="fuel-entry-date" class="w-150"></label>
                <label>每台油量(L) <input type="number" id="fuel-entry-liters" class="w-130" min="0" step="0.1" placeholder="0"></label>
                <label style="flex:1;min-width:220px;">备注 <input type="text" id="fuel-entry-memo" class="form-control" placeholder="例如：柴油补给、夜班加油"></label>
                <button class="btn btn-primary btn-sm" id="fuel-save-btn"><i class="fas fa-gas-pump"></i> 保存加油</button>
            </div>
            <div class="table-responsive table-container" style="max-height:320px;overflow:auto;">
                <table class="data-table" id="fuel-equipment-table">
                    <thead><tr><th style="width:48px"><input type="checkbox" id="fuel-select-all"></th><th>设备编号</th><th>设备名称</th><th>类型</th><th>矿山</th></tr></thead>
                    <tbody><tr><td colspan="5" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div class="page-header" style="margin-top:24px;margin-bottom:14px;">
            <h2>补录模块</h2>
            <div class="page-actions">
                <button class="btn btn-secondary" id="eh-manual-btn"><i class="fas fa-plus"></i> 手动补录工时</button>
            </div>
        </div>
        ${this.getSmartWorklogEntryHTML()}
        <div class="chart-container mt-20">
            <div class="page-header" style="margin-bottom:12px;">
                <h3>补录数据</h3>
                <div class="page-actions">
                    <button class="btn btn-secondary btn-sm" id="eh-manual-refresh-btn"><i class="fas fa-sync"></i> 刷新</button>
                </div>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="equipment-manual-hours-table">
                    <thead><tr><th>操作员</th><th>设备编号</th><th>设备名称</th><th>开始时间</th><th>结束时间</th><th>工时</th><th>备注</th><th style="width:90px">操作</th></tr></thead>
                    <tbody><tr><td colspan="8" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        `;
    },

    // ── Shipping Page ──
    getShippingHTML: function() {
        return `
        <div class="page-header">
            <h2>运输管理</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增运输记录</button>
            </div>
        </div>
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="shipping-list">运输记录</button>
            <button class="sub-tab" data-sub="shipping-plates">授权车牌</button>
            <button class="sub-tab" data-sub="shipping-factories">工厂管理</button>
            <button class="sub-tab" data-sub="shipping-reports">统计报表</button>
        </div>
        <div id="shipping-list" class="sub-page active">
            <div class="table-responsive table-container">
                <table class="data-table" id="shipping-table">
                    <thead><tr><th>车牌号</th><th>装载时间</th><th>工厂</th><th>货物类型</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="5" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="shipping-plates" class="sub-page">
            <div class="page-header" style="margin-bottom:16px;">
                <h4>授权车牌管理</h4>
                <button class="btn btn-primary btn-sm" id="add-plate-btn"><i class="fas fa-plus"></i> 新增车牌</button>
            </div>
            ${this.getImportExportButtons('plate')}
            <div class="table-responsive table-container">
                <table class="data-table" id="plates-table">
                    <thead><tr><th>车牌号</th><th>矿山</th><th>创建时间</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="4" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="shipping-factories" class="sub-page">
            <div class="page-header" style="margin-bottom:16px;">
                <h4>工厂管理</h4>
                <button class="btn btn-primary btn-sm" id="add-factory-btn"><i class="fas fa-plus"></i> 新增工厂</button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="factories-table">
                    <thead><tr><th>名称</th><th>矿山</th><th>创建时间</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="4" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="shipping-reports" class="sub-page">
            <div class="page-header"><h4>统计报表</h4></div>
            ${this.getShippingReportsHTML()}
        </div>
        `;
    },

    getShippingReportsHTML: function() {
        const now = new Date();
        return `
        <!-- 车牌比对 -->
        <div class="chart-container">
            <h4>车牌比对 (未授权 vs 已授权)</h4>
            <div class="filter-bar compact">
                <label>开始 <input type="date" id="comparison-start-date"></label>
                <label>结束 <input type="date" id="comparison-end-date"></label>
                <button class="btn btn-primary btn-sm" id="run-comparison-btn">查询</button>
            </div>
            <div id="plate-comparison-result"></div>
        </div>
        <!-- 车牌排名 -->
        <div class="chart-container">
            <h4>车牌运输排名</h4>
            <div class="filter-bar compact">
                <label>年份 <input type="number" id="ranking-year" class="w-130" value="${now.getFullYear()}"></label>
                <label>月份 <input type="number" id="ranking-month" class="w-130" value="${now.getMonth() + 1}" min="1" max="12"></label>
                <button class="btn btn-primary btn-sm" id="run-ranking-btn">查询</button>
            </div>
            <div id="plate-ranking-result"></div>
        </div>
        <!-- 工厂统计 -->
        <div class="chart-container">
            <h4>工厂运输统计</h4>
            <div class="filter-bar compact">
                <label>年份 <input type="number" id="factory-stats-year" class="w-130" value="${now.getFullYear()}"></label>
                <label>月份 <input type="number" id="factory-stats-month" class="w-130" value="${now.getMonth() + 1}" min="1" max="12"></label>
                <button class="btn btn-primary btn-sm" id="run-factory-stats-btn">查询</button>
            </div>
            <div id="factory-stats-result"></div>
        </div>
        `;
    },

    // ── Fleet Page ──
    getFleetHTML: function() {
        const today = new Date().toISOString().split('T')[0];
        const fleetMineFilter = Auth.isSuperAdmin?.()
            ? `<label>矿山 <select id="fleet-mine-filter" class="form-control w-180"><option value="">全部矿山</option>${(this.cache.mines || []).map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`).join('')}</select></label>`
            : '';
        return `
        <div class="page-header">
            <h2>车队管理</h2>
            <div class="page-actions">
                ${fleetMineFilter}
                <button class="btn btn-primary" id="add-fleet-vehicle-btn"><i class="fas fa-plus"></i> 新增车辆</button>
                <button class="btn btn-secondary" id="fleet-import-btn"><i class="fas fa-file-import"></i> 导入车队表</button>
                <button class="btn btn-secondary" id="fleet-template-btn"><i class="fas fa-file-download"></i> 模板</button>
                <button class="btn btn-secondary" id="fleet-export-btn"><i class="fas fa-download"></i> 导出</button>
                <input type="file" id="fleet-import-file" class="hidden" accept=".xlsx">
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-truck"></i></div><div class="stat-info"><h3 id="fleet-vehicle-count">--</h3><p>车辆总数</p></div></div>
            <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-circle-check"></i></div><div class="stat-info"><h3 id="fleet-active-count">--</h3><p>在用车辆</p></div></div>
            <div class="stat-card amber"><div class="stat-icon stat-icon-amber"><i class="fas fa-gas-pump"></i></div><div class="stat-info"><h3 id="fleet-fuel-liters">--</h3><p>加油升数</p></div></div>
            <div class="stat-card purple"><div class="stat-icon stat-icon-purple"><i class="fas fa-route"></i></div><div class="stat-info"><h3 id="fleet-trip-count">--</h3><p>总趟数</p></div></div>
        </div>
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="fleet-dashboard">汇总看板</button>
            <button class="sub-tab" data-sub="fleet-vehicles-panel">车辆档案</button>
            <button class="sub-tab" data-sub="fleet-maintenance-panel">维修登记</button>
            <button class="sub-tab" data-sub="fleet-fuel-panel">加油/趟数</button>
            <button class="sub-tab" data-sub="fleet-compare-panel">车牌比对</button>
        </div>

        <div id="fleet-dashboard" class="sub-page active">
            <div class="chart-row">
                <div class="chart-container">
                    <h3>车队状态</h3>
                    <div id="fleet-status-list" class="analysis-list"></div>
                </div>
                <div class="chart-container">
                    <h3>运营摘要</h3>
                    <div id="fleet-dashboard-kpis" class="analysis-list"></div>
                </div>
            </div>
            <div class="chart-row mt-20">
                <div class="chart-container">
                    <h3>维修状态</h3>
                    <div id="fleet-maintenance-status-list" class="analysis-list"></div>
                </div>
                <div class="chart-container">
                    <h3>配件使用</h3>
                    <div id="fleet-part-summary" class="analysis-list"></div>
                </div>
            </div>
            <div class="chart-row mt-20">
                <div class="chart-container">
                    <h3>车辆运营排行</h3>
                    <p class="empty-message">按维修费用、加油和车牌比对趟数综合汇总。</p>
                </div>
                <div class="chart-container">
                    <h3>本月趟数汇总</h3>
                    <div id="fleet-dashboard-month-summary"><p class="empty-message">切换到车牌比对页可按月汇总趟数。</p></div>
                </div>
            </div>
            <div class="table-responsive table-container mt-20">
                <table class="data-table" id="fleet-summary-table">
                    <thead><tr><th>车牌</th><th>维修费用</th><th>加油量</th><th>加油金额</th><th>趟数</th></tr></thead>
                    <tbody><tr><td colspan="5" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>

        <div id="fleet-vehicles-panel" class="sub-page">
            <div class="page-header" style="margin-bottom:16px">
                <h4>车辆档案</h4>
                <button class="btn btn-primary btn-sm" id="add-fleet-vehicle-inline-btn"><i class="fas fa-plus"></i> 新增车辆</button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="fleet-vehicles-table">
                    <thead><tr><th>车牌号码</th><th>司机姓名</th><th>司机电话</th><th>车辆类型</th><th>品牌/型号</th><th>当前里程</th><th>状态</th><th>备注</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="9" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>

        <div id="fleet-maintenance-panel" class="sub-page">
            <div class="page-header" style="margin-bottom:16px">
                <h4>维修配件登记</h4>
                <button class="btn btn-primary btn-sm" id="add-fleet-maintenance-btn"><i class="fas fa-plus"></i> 新增维修</button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="fleet-maintenance-table">
                    <thead><tr><th>维修日期</th><th>车牌号码</th><th>司机姓名</th><th>维修项目/配件</th><th>规格型号</th><th>数量</th><th>单价</th><th>金额</th><th>厂家/地点</th><th>经办人</th><th>下次保养里程</th><th>状态</th><th>备注</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="14" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>

        <div id="fleet-fuel-panel" class="sub-page">
            <div class="page-header" style="margin-bottom:16px">
                <h4>加油油耗与趟数</h4>
                <button class="btn btn-primary btn-sm" id="add-fleet-fuel-btn"><i class="fas fa-plus"></i> 新增加油记录</button>
            </div>
            <div class="table-responsive table-container">
                <table class="data-table" id="fleet-fuel-trips-table">
                    <thead><tr><th>日期</th><th>车牌号码</th><th>司机姓名</th><th>加油量</th><th>单价</th><th>金额</th><th>车牌比对趟数</th><th>每趟油耗</th><th>备注</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="10" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>

        <div id="fleet-compare-panel" class="sub-page">
            <div class="chart-row">
                <div class="chart-container">
                    <h3>运输车牌比对</h3>
                    <div class="filter-bar compact">
                        <label>开始 <input type="date" id="fleet-comparison-start-date"></label>
                        <label>结束 <input type="date" id="fleet-comparison-end-date" value="${today}"></label>
                        <button class="btn btn-primary btn-sm" id="fleet-run-comparison-btn">查询</button>
                    </div>
                    <div id="fleet-comparison-result"></div>
                </div>
                <div class="chart-container">
                    <h3>文本车牌统计</h3>
                    <div class="search-bar">
                        <input type="date" id="fleet-text-record-date" class="form-control w-150" value="${today}">
                        <input type="text" id="fleet-text-source" class="form-control" value="车队文本录入" placeholder="来源">
                        <button class="btn btn-primary" id="fleet-analyze-text-btn"><i class="fas fa-magnifying-glass-chart"></i> 开始比对</button>
                        <button class="btn btn-secondary" id="fleet-save-text-record-btn" disabled><i class="fas fa-save"></i> 保存比对数据</button>
                    </div>
                    <textarea id="fleet-raw-text" class="smart-parse-textarea" style="min-height:220px" placeholder="粘贴磅单、运输清单或识别文本；系统会用车辆档案里的车牌号码作为比对目标。"></textarea>
                    <div id="fleet-text-daily-list" class="mt-20"><p class="empty-message">比对后可按识别日期保存，并自动进入月度统计。</p></div>
                </div>
            </div>
            <div class="chart-row mt-20">
                <div class="chart-container">
                    <div class="page-header" style="margin-bottom:12px">
                        <h3>月度趟数汇总</h3>
                        <div class="page-actions">
                            <input type="month" id="fleet-trip-month" value="${today.slice(0, 7)}">
                            <button class="btn btn-secondary btn-sm" id="fleet-load-month-trips-btn"><i class="fas fa-chart-column"></i> 汇总</button>
                        </div>
                    </div>
                    <div id="fleet-month-trip-summary"></div>
                </div>
            </div>
            <div class="chart-row mt-20">
                <div class="table-responsive table-container">
                    <table class="data-table" id="fleet-text-summary-table">
                        <thead><tr><th>车牌</th><th>趟数</th></tr></thead>
                        <tbody><tr><td colspan="2" class="empty-message">请先开始比对</td></tr></tbody>
                    </table>
                </div>
                <div class="table-responsive table-container">
                    <table class="data-table" id="fleet-text-detail-table">
                        <thead><tr><th>车牌</th><th>来源</th><th>行号</th><th>原始行内容</th></tr></thead>
                        <tbody><tr><td colspan="4" class="empty-message">暂无匹配明细</td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>
        `;
    },

    // ── Plate Counter Page ──
    getPlateCounterHTML: function() {
        const today = new Date().toISOString().split('T')[0];
        const month = today.slice(0, 7);
        return `
        <div class="page-header">
            <h2>车牌比对</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="pc-analyze-btn"><i class="fas fa-magnifying-glass-chart"></i> 开始比对</button>
                <button class="btn btn-secondary" id="pc-save-btn"><i class="fas fa-save"></i> 保存当天记录</button>
                <button class="btn btn-secondary" id="pc-clear-btn"><i class="fas fa-eraser"></i> 清空录入</button>
            </div>
        </div>
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="pc-daily">每日录入</button>
            <button class="sub-tab" data-sub="pc-monthly">本月汇总</button>
            <button class="sub-tab" data-sub="pc-history">历史记录</button>
            <button class="sub-tab" data-sub="pc-targets">目标车牌</button>
        </div>
        <div id="pc-daily" class="sub-page active">
            <div class="chart-row">
                <div class="chart-container">
                    <h3>装车列表录入</h3>
                    <div class="search-bar">
                        <input type="date" id="pc-record-date" class="form-control w-150" value="${today}">
                        <input type="text" id="pc-source" class="form-control" style="max-width:220px" value="手工录入" placeholder="来源">
                        <label class="btn btn-secondary btn-sm" for="pc-file-input"><i class="fas fa-file-import"></i> 导入文件</label>
                        <input type="file" id="pc-file-input" class="hidden" accept=".xlsx,.csv,.tsv,.txt,.log">
                    </div>
                    <textarea id="pc-input" class="smart-parse-textarea" style="min-height:340px" placeholder="粘贴装车列表，每一行包含目标车牌即统计 1 趟。系统会忽略空格、横杠和符号，例如 8273 AX 05 会匹配 8273AX05。"></textarea>
                </div>
                <div class="chart-container">
                    <h3>今日统计</h3>
                    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
                        <div class="mini-stat-card"><div><div class="mini-stat-value" id="pc-total-trips">0</div><div class="mini-stat-label">总趟数</div></div></div>
                        <div class="mini-stat-card"><div><div class="mini-stat-value" id="pc-active-plates">0</div><div class="mini-stat-label">有趟数车牌</div></div></div>
                        <div class="mini-stat-card"><div><div class="mini-stat-value" id="pc-day-count">0</div><div class="mini-stat-label">识别天数</div></div></div>
                        <div class="mini-stat-card"><div><div class="mini-stat-value" id="pc-target-count">0</div><div class="mini-stat-label">目标车牌</div></div></div>
                    </div>
                    <div class="table-responsive table-container" style="max-height:340px;overflow:auto">
                        <table class="data-table" id="pc-summary-table">
                            <thead><tr><th>车牌</th><th>趟数</th></tr></thead>
                            <tbody><tr><td colspan="2" class="empty-message">请先开始比对</td></tr></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="table-responsive table-container mt-20">
                <table class="data-table" id="pc-detail-table">
                    <thead><tr><th>日期</th><th>车牌</th><th>来源</th><th>行号</th><th>原始行内容</th></tr></thead>
                    <tbody><tr><td colspan="5" class="empty-message">暂无匹配明细</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="pc-monthly" class="sub-page">
            <div class="search-bar">
                <input type="month" id="pc-month" class="form-control w-160" value="${month}">
                <button class="btn btn-primary" id="pc-load-month-btn"><i class="fas fa-chart-column"></i> 查询月报</button>
                <button class="btn btn-secondary" id="pc-export-month-btn"><i class="fas fa-download"></i> 导出月报</button>
            </div>
            <div class="stats-grid">
                <div class="stat-card amber"><div class="stat-icon stat-icon-amber"><i class="fas fa-truck"></i></div><div class="stat-info"><h3 id="pc-month-total">--</h3><p>月度总趟数</p></div></div>
                <div class="stat-card cyan"><div class="stat-icon stat-icon-cyan"><i class="fas fa-calendar-days"></i></div><div class="stat-info"><h3 id="pc-month-days">--</h3><p>保存天数</p></div></div>
                <div class="stat-card green"><div class="stat-icon stat-icon-green"><i class="fas fa-id-card"></i></div><div class="stat-info"><h3 id="pc-month-active">--</h3><p>有趟数车牌</p></div></div>
            </div>
            <div class="chart-row">
                <div class="chart-container"><h3>月度车牌排行</h3><canvas id="pc-month-chart"></canvas></div>
                <div class="chart-container"><h3>每日总趟数</h3><div id="pc-month-daily"></div></div>
            </div>
            <div class="table-responsive table-container mt-20">
                <table class="data-table" id="pc-month-summary-table">
                    <thead><tr><th>车牌</th><th>月度趟数</th></tr></thead>
                    <tbody><tr><td colspan="2" class="empty-message">请选择月份查询</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="pc-history" class="sub-page">
            <div class="table-responsive table-container">
                <table class="data-table" id="pc-history-table">
                    <thead><tr><th>日期</th><th>来源</th><th>总趟数</th><th>保存时间</th><th style="width:140px">操作</th></tr></thead>
                    <tbody><tr><td colspan="5" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="pc-targets" class="sub-page">
            <div class="chart-container">
                <h3>目标车牌清单</h3>
                <textarea id="pc-targets-text" class="smart-parse-textarea" style="min-height:420px" placeholder="一行一个车牌"></textarea>
                <div class="smart-entry-actions">
                    <button class="btn btn-primary" id="pc-save-targets-btn"><i class="fas fa-save"></i> 保存车牌清单</button>
                    <button class="btn btn-secondary" id="pc-reload-targets-btn"><i class="fas fa-rotate"></i> 重新载入</button>
                </div>
            </div>
        </div>
        `;
    },

    // ── Worklogs Page (重构：集成智能录入) ──
    getWorklogsHTML: function() {
        return `
        <!-- 智能录入区域 -->
        ${this.getSmartWorklogEntryHTML()}

        <!-- 历史日志查询 -->
        <div class="page-header" style="margin-top:20px;">
            <h2>历史日志</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="global-add-btn"><i class="fas fa-plus"></i> 新增日志</button>
                <button class="btn btn-secondary btn-sm" id="download-worklogs-template-btn"><i class="fas fa-file-download"></i> 模板</button>
                <button class="btn btn-secondary btn-sm" id="export-worklogs-btn"><i class="fas fa-download"></i> 导出</button>
            </div>
        </div>
        <div class="search-bar">
            <label>开始日期 <input type="date" id="wl-start-date" class="form-control w-150"></label>
            <label>结束日期 <input type="date" id="wl-end-date" class="form-control w-150"></label>
            <button class="btn btn-primary btn-sm" id="wl-filter-btn">筛选</button>
        </div>
        <div class="table-responsive table-container">
            <table class="data-table" id="worklogs-table">
                <thead><tr><th>设备</th><th>日期</th><th>工时</th><th>油耗</th><th>备注</th><th style="width:120px">操作</th></tr></thead>
                <tbody><tr><td colspan="6" class="empty-message">加载中...</td></tr></tbody>
            </table>
        </div>
        `;
    },

    getAppReleaseHTML: function(embedded = false) {
        const appUrl = `${window.location.origin}/app/`;
        return `
        ${embedded ? '' : `<div class="page-header">
            <h2>版本信息与 APP 下载</h2>
            <div class="page-actions">
                <button class="btn btn-primary" id="refresh-release-btn"><i class="fas fa-rotate"></i> 刷新版本信息</button>
            </div>
        </div>`}

        ${embedded ? '<div class="settings-section-heading"><div><h3>软件下载</h3><p>下载 MineOps 原生端、鸿蒙端、小程序及备用安装包。</p></div><button class="btn btn-secondary" id="refresh-release-btn"><i class="fas fa-rotate"></i> 刷新版本</button></div>' : ''}

        <div class="release-hero">
            <div>
                <div class="ops-eyebrow">MineOps Mobile</div>
                <h2 id="release-version">--</h2>
                <p id="release-build-time">正在读取服务器版本信息...</p>
            </div>
            <a class="btn btn-primary" href="${appUrl}" target="_blank" rel="noopener">
                <i class="fas fa-up-right-from-square"></i> 打开移动端
            </a>
        </div>

        <div class="dashboard-metric-grid">
            <div class="dashboard-metric">
                <span>移动端地址</span>
                <strong class="release-url">${appUrl}</strong>
            </div>
            <div class="dashboard-metric">
                <span>移动端路线</span>
                <strong>原生 Android / 鸿蒙</strong>
                <small>主路线改为原生端，H5 仅保留备用</small>
            </div>
            <div class="dashboard-metric">
                <span>原生版本</span>
                <strong>1.3.7</strong>
                <small>Java 原生界面直连后端 API</small>
            </div>
            <div class="dashboard-metric">
                <span>当前状态</span>
                <strong id="release-status">--</strong>
                <small>读取 BUILD_INFO</small>
            </div>
        </div>

        <div class="release-grid">
            ${this.getDownloadCard('Android 原生 APK', '原生 Android 1.3.7 调试安装包，支持密码显隐和邮箱找回。', '/downloads/mineops-android-native-1.3.7.apk', '下载 APK', 'fab fa-android')}
            ${this.getDownloadCard('Android 原生工程', '原生 Android 项目源码，可用 Android Studio 继续编译和发布。', '/downloads/mineops-android-native-source.zip', '下载源码', 'fas fa-code')}
            ${this.getDownloadCard('HarmonyOS 原生 HAP', '原生鸿蒙 ArkUI 1.2.7 调试包，未配置签名证书。', '/downloads/mineops-harmony-native-debug.hap', '下载 HAP', 'fas fa-mobile-screen')}
            ${this.getDownloadCard('HarmonyOS 原生工程', '原生鸿蒙项目源码，可用 DevEco Studio 继续签名、调试和发布。', '/downloads/mineops-harmony-native-source.zip', '下载源码', 'fas fa-code-branch')}
            ${this.getDownloadCard('iOS 描述文件', '适合 iPhone 添加到桌面，打开服务器移动端。', '/downloads/MineOps-iOS-WebClip.mobileconfig', '下载 iOS 文件', 'fab fa-apple')}
            ${this.getDownloadCard('小程序包', '微信小程序项目源码包，用于导入开发者工具。', '/downloads/mineops-miniapp.zip', '下载小程序包', 'fab fa-weixin')}
            ${this.getDownloadCard('移动端 H5 备用包', '保留浏览器访问和临时应急用，不作为主 APP 形态。', '/downloads/mineops-mobile-app.zip', '下载备用包', 'fas fa-file-zipper')}
        </div>
        `;
    },

    getDownloadCard: function(title, desc, href, buttonText, icon) {
        return `
        <div class="release-card">
            <div class="release-card-icon"><i class="${icon}"></i></div>
            <div>
                <h3>${title}</h3>
                <p>${desc}</p>
                <a class="btn btn-secondary" href="${href}" download><i class="fas fa-download"></i> ${buttonText}</a>
            </div>
        </div>`;
    },

    loadAppRelease: function() {
        const versionEl = document.getElementById('release-version');
        const buildEl = document.getElementById('release-build-time');
        const statusEl = document.getElementById('release-status');
        if (statusEl) statusEl.textContent = '读取中';
        fetch(`/app/BUILD_INFO.json?ts=${Date.now()}`)
            .then(resp => {
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return resp.json();
            })
            .then(info => {
                const version = info.version || info.name || 'MineOps Mobile';
                const buildTime = info.build_time ? new Date(info.build_time).toLocaleString() : '--';
                if (versionEl) versionEl.textContent = version;
                if (buildEl) buildEl.textContent = `服务器构建时间：${buildTime}`;
                if (statusEl) statusEl.textContent = '最新';
            })
            .catch(() => {
                if (versionEl) versionEl.textContent = 'MineOps Mobile';
                if (buildEl) buildEl.textContent = '暂未读取到 BUILD_INFO，请检查 /app/BUILD_INFO.json';
                if (statusEl) statusEl.textContent = '未读取';
            });
    },

    // ═══════════════════════════════════════
    // PAGE DATA LOADING
    // ═══════════════════════════════════════

    loadPageData: function(pageName) {
        // Reset sub-page
        this.currentSubPage = null;

        switch (pageName) {
            case 'dashboard': this.loadDashboard(); break;
            case 'ops-intelligence': this.loadOpsIntelligence(); break;
            case 'mines': this.loadMines(); break;
            case 'users': this.loadUsers(); break;
            case 'settings': this.loadAccountSettings(); break;
            case 'email-settings': this.loadEmailSettings(); break;
            case 'account-settings': this.loadAccountSettings(); break;
            case 'equipment': this.loadEquipment(); break;
            case 'equipment-hours': this.loadEquipmentHours(); break;
            case 'employees': this.loadEmployees(); break;
            case 'finance': this.loadFinance(); break;
            case 'shipping': this.loadShipping(); break;
            case 'fleet': this.loadFleet(); break;
            case 'plate-counter': this.loadPlateCounter(); break;
            case 'app-release': this.loadAppRelease(); break;
            case 'worklogs': this.loadWorklogs(); break;
        }

        // Re-setup dynamic listeners after HTML rendered
        setTimeout(() => this.setupDynamicListeners(), 100);
    },

    setupDynamicListeners: function() {
        // 设备搜索/筛选
        this.setupEquipmentFilters();
        // 用户管理
        this.setupUsers();
        this.setupEmailSettings();
        this.setupAccountSettings();
        // 设备导入导出
        this.setupImportExport('equipment');
        this.setupImportExport('employees');
        this.setupImportExport('finance');
        this.setupImportExport('plate');
        this.setupFinanceControls();
        // 员工签到数据
        this.setupEmployees();
        // 设备月度统计
        this.setupEquipmentMonthly();
        // 运输报表
        this.setupShippingReports();
        // 智能录入（设备页面 + 工作日志页面共用）
        this.setupSmartEntry();
        // 工作日志
        this.setupWorklogs();
        // 设备工时
        this.setupEquipmentHours();
        // 车牌比对
        this.setupPlateCounter();
        // 车队管理
        this.setupFleet();
        const releaseBtn = document.getElementById('refresh-release-btn');
        if (releaseBtn) releaseBtn.onclick = () => this.loadAppRelease();
        // 子标签切换
        this.setupSubTabs();
        // 侧边栏按钮
        this.setupSideButtons();
    },

    setupSideButtons: function() {
        const addPlateBtn = document.getElementById('add-plate-btn');
        const addFactoryBtn = document.getElementById('add-factory-btn');
        if (addPlateBtn) addPlateBtn.onclick = () => {
            this.currentSubPage = 'plates';
            this.showAddModal();
        };
        if (addFactoryBtn) addFactoryBtn.onclick = () => {
            this.currentSubPage = 'factories';
            this.showAddModal();
        };
    },

    setupSubTabs: function() {
        document.querySelectorAll('.sub-tab').forEach(tab => {
            tab.onclick = () => {
                const subId = tab.getAttribute('data-sub');
                const tabBar = tab.closest('.sub-tabs');
                const scope = tabBar?.parentElement || tab.closest('.content-area') || document;
                const siblingTabs = tabBar ? tabBar.querySelectorAll('.sub-tab') : scope.querySelectorAll('.sub-tab');
                const siblingPages = Array.from(scope.children || []).filter(child => child.classList?.contains('sub-page'));
                siblingTabs.forEach(t => t.classList.remove('active'));
                siblingPages.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const subPage = document.getElementById(subId);
                if (subPage) subPage.classList.add('active');

                // Handle sub-page loading
                if (subId === 'shipping-plates') {
                    this.currentSubPage = 'plates';
                    this.loadPlates();
                } else if (subId === 'shipping-factories') {
                    this.currentSubPage = 'factories';
                    this.loadFactories();
                } else if (subId === 'shipping-list') {
                    this.currentSubPage = 'shipping';
                    this.loadShipping();
                } else if (subId === 'shipping-reports') {
                    this.currentSubPage = 'reports';
                } else if (subId === 'fleet-vehicles-panel') {
                    this.currentSubPage = 'fleet-vehicles';
                } else if (subId === 'fleet-maintenance-panel') {
                    this.currentSubPage = 'fleet-maintenance';
                } else if (subId === 'fleet-fuel-panel') {
                    this.currentSubPage = 'fleet-fuel-trips';
                } else if (subId === 'fleet-dashboard' || subId === 'fleet-compare-panel') {
                    this.currentSubPage = null;
                } else if (subId === 'employees-attendance') {
                    this.currentSubPage = null;
                    this.refreshEmployeeAttendance();
                } else if (subId === 'employees-active') {
                    this.currentSubPage = null;
                    this.loadActiveEmployeeAttendance();
                } else if (subId === 'employees-list') {
                    this.currentSubPage = null;
                    this.renderTable('employees', this.cache.employees);
                } else if (subId === 'eq-hours-stats') {
                    this.currentSubPage = null;
                    document.getElementById('load-equipment-stats-btn')?.click();
                } else {
                    this.currentSubPage = null;
                }
            };
        });
    },

    // ── Dashboard Data ──
    disposeMineMap: function() {
        if (!this.mineMap) return;
        cancelAnimationFrame(this.mineMap.frame);
        this.mineMap.resizeObserver?.disconnect?.();
        this.mineMap.renderer?.dispose?.();
        this.mineMap.container?.replaceChildren?.();
        this.mineMap = null;
    },

    initMineMap: function() {
        const container = document.getElementById('mine-map-canvas');
        if (!container) return;
        this.disposeMineMap();

        const frame = document.createElement('div');
        frame.className = 'mine-map-image-frame';
        const image = document.createElement('img');
        image.className = 'mine-map-realistic-image';
        image.src = 'assets/mine-realistic-3d.png';
        image.alt = '一号矿山写实三维鸟瞰图';
        image.draggable = false;
        frame.appendChild(image);
        container.replaceChildren(frame);

        const state = { scale: 1.04, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
        const apply = () => {
            const maxX = container.clientWidth * (state.scale - 1) * 0.42 + 24;
            const maxY = container.clientHeight * (state.scale - 1) * 0.42 + 24;
            state.x = Math.max(-maxX, Math.min(maxX, state.x));
            state.y = Math.max(-maxY, Math.min(maxY, state.y));
            frame.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
        };
        const setDragging = isDragging => {
            state.dragging = isDragging;
            container.classList.toggle('dragging', isDragging);
        };
        container.addEventListener('pointerdown', event => {
            setDragging(true);
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            container.setPointerCapture?.(event.pointerId);
        });
        container.addEventListener('pointermove', event => {
            if (!state.dragging) return;
            state.x += event.clientX - state.lastX;
            state.y += event.clientY - state.lastY;
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            apply();
        });
        const endImageDrag = event => {
            setDragging(false);
            if (event?.pointerId) container.releasePointerCapture?.(event.pointerId);
        };
        container.addEventListener('pointerup', endImageDrag);
        container.addEventListener('pointercancel', endImageDrag);
        container.addEventListener('pointerleave', endImageDrag);
        container.addEventListener('wheel', event => {
            event.preventDefault();
            const next = state.scale + (event.deltaY < 0 ? 0.08 : -0.08);
            state.scale = Math.max(1, Math.min(1.55, next));
            apply();
        }, { passive: false });
        image.addEventListener('load', apply, { once: true });
        apply();
        this.mineMap = { container };
        return;

        if (typeof THREE === 'undefined') {
            container.innerHTML = '<p class="empty-message">三维地图组件未加载</p>';
            return;
        }

        const width = Math.max(container.clientWidth, 320);
        const height = Math.max(container.clientHeight, 320);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d111c);
        scene.fog = new THREE.Fog(0x0d111c, 18, 58);
        const textureLoader = new THREE.TextureLoader();
        const photoTexture = textureLoader.load('assets/mine-photos/mine1-4.jpg');
        photoTexture.encoding = THREE.sRGBEncoding;

        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.set(10, 9, 13);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        container.replaceChildren(renderer.domElement);

        const photoPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(22, 12),
            new THREE.MeshBasicMaterial({ map: photoTexture, transparent: true, opacity: 0.28, depthWrite: false })
        );
        photoPanel.position.set(0, 4.8, -10.8);
        scene.add(photoPanel);

        const ambient = new THREE.HemisphereLight(0xdceaff, 0x111827, 1.4);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(9, 14, 8);
        sun.castShadow = true;
        scene.add(sun);

        const map = new THREE.Group();
        map.rotation.x = -0.28;
        scene.add(map);

        const ground = new THREE.Mesh(
            new THREE.BoxGeometry(18, 0.35, 12),
            new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 0.92, metalness: 0.02 })
        );
        ground.position.y = -0.25;
        ground.receiveShadow = true;
        map.add(ground);

        const groundPhoto = new THREE.Mesh(
            new THREE.PlaneGeometry(17.5, 11.5),
            new THREE.MeshBasicMaterial({ map: photoTexture, transparent: true, opacity: 0.045, depthWrite: false })
        );
        groundPhoto.rotation.x = -Math.PI / 2;
        groundPhoto.position.y = -0.04;
        map.add(groundPhoto);

        const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x746a60, roughness: 0.9 });
        const redSlopeMat = new THREE.MeshStandardMaterial({ color: 0x7c3f2d, roughness: 0.92 });
        [[-7.5, -4.8, 1.8], [-5.3, 4.8, 1.2], [6.9, -4.7, 1.5], [7.6, 3.9, 1.1]].forEach(([x, z, s]) => {
            const ridge = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 1.5 * s, 5), ridgeMat);
            ridge.position.set(x, 0.55, z);
            ridge.scale.y = 0.55;
            ridge.castShadow = true;
            ridge.receiveShadow = true;
            map.add(ridge);
        });
        [[3.8, 5.0, 1.7], [6.2, 5.1, 1.35], [-4.2, 5.1, 1.15]].forEach(([x, z, s]) => {
            const slope = new THREE.Mesh(new THREE.ConeGeometry(1.9 * s, 1.35 * s, 5), redSlopeMat);
            slope.position.set(x, 0.68, z);
            slope.scale.set(1.35, 0.6, 0.75);
            slope.rotation.y = 0.4;
            slope.castShadow = true;
            map.add(slope);
        });

        const pitMats = [0x8a8175, 0x756b61, 0x5d564f, 0x3b3734].map(color =>
            new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.03 })
        );
        for (let i = 0; i < 4; i++) {
            const bench = new THREE.Mesh(
                new THREE.CylinderGeometry(3.8 - i * 0.62, 4.25 - i * 0.62, 0.32, 64),
                pitMats[i]
            );
            bench.position.set(-1.2, 0.1 + i * 0.24, -0.4);
            bench.scale.z = 0.72;
            bench.castShadow = true;
            bench.receiveShadow = true;
            map.add(bench);
        }
        const pitFloor = new THREE.Mesh(
            new THREE.CylinderGeometry(1.25, 1.45, 0.18, 64),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95 })
        );
        pitFloor.position.set(-1.2, 1.08, -0.4);
        pitFloor.scale.z = 0.62;
        map.add(pitFloor);

        const whiteRockMat = new THREE.MeshStandardMaterial({ color: 0xd7d7cf, roughness: 0.9 });
        [
            [-3.7, -1.4, 2.2, 0.12, 0.38],
            [0.9, 0.4, 2.8, -0.18, 0.42],
            [2.8, -2.2, 1.8, 0.34, 0.34],
            [-5.5, 1.8, 1.7, -0.44, 0.36],
            [4.4, 1.5, 2.3, 0.12, 0.5],
        ].forEach(([x, z, length, rot, y]) => {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 0.22), whiteRockMat);
            stripe.position.set(x, y, z);
            stripe.rotation.y = rot;
            stripe.castShadow = true;
            map.add(stripe);
        });

        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x12323a,
            roughness: 0.28,
            metalness: 0.08,
            transparent: true,
            opacity: 0.82,
        });
        [[-2.5, -2.1, 1.6, 0.62], [3.9, -3.45, 1.7, 0.48], [-0.8, -0.8, 0.9, 0.34]].forEach(([x, z, sx, sz]) => {
            const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat);
            pond.rotation.x = -Math.PI / 2;
            pond.position.set(x, 1.22, z);
            pond.scale.set(sx, sz, 1);
            map.add(pond);
        });

        const roadMat = new THREE.MeshStandardMaterial({ color: 0xb8874e, roughness: 0.74 });
        const makeRoad = points => {
            const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], 1.18, p[1])));
            const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.11, 8, false), roadMat);
            road.castShadow = true;
            map.add(road);
            return curve;
        };
        const mainRoad = makeRoad([[-7.5, 3.8], [-5.0, 2.0], [-2.2, 1.15], [0.6, 1.55], [2.7, 2.9], [5.8, 3.55], [7.5, 2.65]]);
        makeRoad([[-7.2, -4.6], [-4.6, -3.3], [-1.9, -2.0], [1.4, -1.5], [4.7, -2.1], [7.5, -3.65]]);
        makeRoad([[-5.8, 0.2], [-3.8, -0.4], [-1.0, -0.25], [1.0, 0.55], [2.8, 0.25], [4.9, -0.9]]);

        const cableMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
        [[[-7.6, -1.8], [-5.2, -0.8], [-3.7, 0.7], [-2.1, 1.8]], [[4.2, 4.7], [3.2, 2.2], [2.5, 0.6], [2.3, -1.2]], [[6.8, 4.6], [6.3, 2.4], [5.8, 0.4], [5.1, -1.6]]].forEach(points => {
            const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], 1.35, p[1])));
            const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.025, 6, false), cableMat);
            map.add(cable);
        });

        const plant = new THREE.Group();
        plant.position.set(5.4, 1.12, 2.9);
        const building = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 0.75, 1.1),
            new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.58, metalness: 0.08 })
        );
        building.castShadow = true;
        plant.add(building);
        const siloMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.48, metalness: 0.12 });
        [-0.55, 0.55].forEach(x => {
            const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 24), siloMat);
            silo.position.set(x, 0.72, -0.72);
            silo.castShadow = true;
            plant.add(silo);
        });
        map.add(plant);

        const redContainer = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.32, 0.38),
            new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 })
        );
        redContainer.position.set(-6.7, 1.26, 2.55);
        redContainer.rotation.y = -0.25;
        redContainer.castShadow = true;
        map.add(redContainer);

        const createExcavator = (x, z, rotation = 0) => {
            const excavator = new THREE.Group();
            excavator.position.set(x, 1.25, z);
            excavator.rotation.y = rotation;
            const yellow = new THREE.MeshStandardMaterial({ color: 0xd6a21d, roughness: 0.42 });
            const dark = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.62 });
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.36), dark);
            base.position.y = 0.08;
            excavator.add(base);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.32), yellow);
            cab.position.y = 0.28;
            excavator.add(cab);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.08), yellow);
            arm.position.set(0.52, 0.42, 0);
            arm.rotation.z = -0.35;
            excavator.add(arm);
            const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), dark);
            bucket.position.set(0.92, 0.22, 0);
            excavator.add(bucket);
            map.add(excavator);
        };
        createExcavator(-1.8, -1.45, 0.5);
        createExcavator(2.8, -1.9, -0.35);

        const trucks = [];
        const createTruck = (offset, color) => {
            const truck = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.55, 0.25, 0.34),
                new THREE.MeshStandardMaterial({ color, roughness: 0.45 })
            );
            body.position.y = 0.15;
            truck.add(body);
            const cab = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.25, 0.34),
                new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.4 })
            );
            cab.position.set(0.34, 0.2, 0);
            truck.add(cab);
            [-0.2, 0.2].forEach(x => [-0.18, 0.18].forEach(z => {
                const wheel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12),
                    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 })
                );
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(x, 0.02, z);
                truck.add(wheel);
            }));
            truck.userData.offset = offset;
            trucks.push(truck);
            map.add(truck);
        };
        createTruck(0.05, 0xf59e0b);
        createTruck(0.38, 0x10b981);
        createTruck(0.72, 0x60a5fa);

        const beaconMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x064e3b, roughness: 0.4 });
        [[-6.8, -2.7], [2.6, 4.4], [7.1, 0.2]].forEach(([x, z]) => {
            const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 18), beaconMat);
            beacon.position.set(x, 1.35, z);
            map.add(beacon);
        });

        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        renderer.domElement.addEventListener('pointerdown', e => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            renderer.domElement.setPointerCapture?.(e.pointerId);
        });
        renderer.domElement.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            map.rotation.y += dx * 0.008;
            map.rotation.x = Math.max(-0.62, Math.min(0.08, map.rotation.x + dy * 0.004));
            lastX = e.clientX;
            lastY = e.clientY;
        });
        const endDrag = () => { dragging = false; };
        renderer.domElement.addEventListener('pointerup', endDrag);
        renderer.domElement.addEventListener('pointerleave', endDrag);

        const resize = () => {
            const w = Math.max(container.clientWidth, 320);
            const h = Math.max(container.clientHeight, 320);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        const clock = new THREE.Clock();
        this.mineMap = { container, renderer, resizeObserver, frame: 0 };
        const animate = () => {
            const elapsed = clock.getElapsedTime();
            if (!dragging) map.rotation.y += 0.0012;
            trucks.forEach(truck => {
                const t = (elapsed * 0.035 + truck.userData.offset) % 1;
                const pos = mainRoad.getPointAt(t);
                const next = mainRoad.getPointAt((t + 0.01) % 1);
                truck.position.copy(pos);
                truck.position.y += 0.1;
                truck.lookAt(next.x, truck.position.y, next.z);
            });
            renderer.render(scene, camera);
            if (this.mineMap) this.mineMap.frame = requestAnimationFrame(animate);
        };
        animate();
    },

    getSelectedOpsMineId: function() {
        if (!Auth.isSuperAdmin?.()) return Auth.getUserMineId?.() || '';
        return document.getElementById('ops-mine-filter')?.value || '';
    },

    prepareOpsMineSelector: function() {
        const select = document.getElementById('ops-mine-filter');
        if (!select) return Promise.resolve();
        if (!Auth.isSuperAdmin?.()) {
            select.classList.add('hidden');
            select.innerHTML = '';
            return Promise.resolve();
        }
        const apply = () => {
            const current = select.value;
            select.innerHTML = this.cache.mines.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('');
            if (current && this.cache.mines.some(m => m.id === current)) select.value = current;
            select.classList.remove('hidden');
            select.onchange = () => this.loadOpsIntelligence();
        };
        if (this.cache.mines.length) {
            apply();
            return Promise.resolve();
        }
        return API.mines.getAll({ limit: 1000 }).then(mines => {
            this.cache.mines = mines || [];
            apply();
        }).catch(e => this.showError('加载矿山列表失败: ' + e.message));
    },

    loadDashboard: function() {
        this.initMineMap();
        API.dashboard.getStats().then(stats => {
            const financeText = Object.entries(stats.financeByCurrency || {})
                .map(([currency, total]) => `${currency} ${total.toFixed(0)}`)
                .join(' / ');
            document.getElementById('finance-total').textContent = financeText || '--';
        }).catch(() => {});

        API.dashboard.getEquipmentMonthlyStats().then(data => {
            const hours = document.getElementById('dashboard-work-hours');
            const fuel = document.getElementById('dashboard-fuel-total');
            if (hours) hours.textContent = Number(data.total_hours || 0).toFixed(1);
            if (fuel) fuel.textContent = Number(data.total_fuel || 0).toFixed(1);
        }).catch(() => {});

        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        API.plateCounter.monthly({ year_month: yearMonth }).then(data => {
            const plateTrips = document.getElementById('dashboard-plate-trips');
            if (plateTrips) plateTrips.textContent = data.total_trips || 0;
        }).catch(() => {});

        Promise.all([
            API.employees.getAll({ limit: 1000 }),
            API.employeeAttendance.stats({ period: 'today' })
        ]).then(([employees, attendance]) => {
            const attendanceEl = document.getElementById('dashboard-attendance-today');
            const summaryEl = document.getElementById('dashboard-employee-summary');
            if (attendanceEl) attendanceEl.textContent = attendance.unique_employees || 0;
            if (summaryEl) {
                summaryEl.textContent = `在岗 ${attendance.active_records || 0} · 员工总数 ${(employees || []).length}`;
            }
        }).catch(() => {});

        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        API.shipping.getAll({
            start_date: `${today}T00:00:00`,
            end_date: `${today}T23:59:59`,
            limit: 1000
        }).then(records => {
            const rows = records || [];
            const activePlates = new Set(rows.map(item => String(item.plate_number || '').trim().toUpperCase()).filter(Boolean));
            const shippingEl = document.getElementById('dashboard-shipping-today');
            const summaryEl = document.getElementById('dashboard-shipping-summary');
            if (shippingEl) shippingEl.textContent = rows.length;
            if (summaryEl) summaryEl.textContent = `活跃车牌 ${activePlates.size}`;
        }).catch(() => {});

        // Status overview card
        API.dashboard.getStatusOverview().then(data => {
            if (data && data.status_counts) {
                const s = data.status_counts;
                const status = `运行${s.working || 0} 闲置${s.idle || 0} 维修${s.maintenance || 0}`;
                const mapStatus = document.getElementById('mine-map-status');
                if (mapStatus) mapStatus.textContent = status;
            }
        }).catch(() => {});

        this.loadFuelTrendChart();
        this.loadFinanceCharts();
        this.loadDashboardActivities();
        this.loadDashboardTodayWorklogs();
    },

    loadOpsIntelligence: function() {
        const days = document.getElementById('ops-days')?.value || 30;
        const alertList = document.getElementById('ops-alert-list');
        const recList = document.getElementById('ops-recommendation-list');
        if (alertList) alertList.innerHTML = '<p class="empty-message">加载中...</p>';
        if (recList) recList.innerHTML = '<p class="empty-message">加载中...</p>';

        this.prepareOpsMineSelector().then(() => {
            const params = { days };
            const mineId = this.getSelectedOpsMineId();
            if (mineId) params.mine_id = mineId;
            return API.opsIntelligence.overview(params);
        }).then(data => {
            this.renderOpsIntelligence(data);
        }).catch(e => this.showError('加载智能运营中心失败: ' + e.message));
    },

    renderOpsIntelligence: function(data) {
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        const k = data.kpis || {};
        const h = data.health || {};
        const p = data.period || {};

        setText('ops-mine-name', data.mine?.name || 'MineOps');
        setText('ops-health-label', h.label || '--');
        setText('ops-period', `${p.start || ''} 至 ${p.end || ''}`);
        setText('ops-score', h.score ?? '--');
        setText('ops-total-hours', Number(k.total_hours || 0).toFixed(1));
        setText('ops-fuel-rate', Number(k.fuel_per_hour || 0).toFixed(1));
        setText('ops-shipping-trips', k.shipping_trips || 0);
        setText('ops-plate-trips', k.plate_counter_trips || 0);
        setText('ops-active-devices', `${k.active_device_count || 0}/${k.equipment_active || 0}`);
        setText('ops-alert-count', h.alert_count || 0);

        this.renderOpsTrend(data.trend || []);
        this.renderOpsAlerts(data.alerts || []);
        this.renderOpsRecommendations(data.recommendations || []);
        this.renderOpsEquipmentRanking(data.top_equipment || []);
        this.renderOpsDataHealth(data);
        this.renderOpsRoadmap(data.roadmap || []);
    },

    renderOpsTrend: function(rows) {
        const canvas = document.getElementById('ops-trend-chart');
        if (!canvas) return;
        if (this.charts.opsTrend) this.charts.opsTrend.destroy();
        canvas.height = 300;
        const chartContainer = canvas.closest('.chart-container');
        if (chartContainer) chartContainer.style.height = '390px';
        const labels = rows.map(row => row.date);
        this.charts.opsTrend = new Chart(canvas, {
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: '工时',
                        data: rows.map(row => row.hours || 0),
                        backgroundColor: 'rgba(6, 182, 212, 0.35)',
                        borderColor: '#06b6d4',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: '运输记录',
                        data: rows.map(row => row.shipping_trips || 0),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        tension: 0.35,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'line',
                        label: '车牌比对趟数',
                        data: rows.map(row => row.plate_counter_trips || 0),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        tension: 0.35,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#64748b' } } },
                scales: {
                    x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    y1: { beginAtZero: true, position: 'right', ticks: { color: '#64748b' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    },

    renderOpsAlerts: function(alerts) {
        const container = document.getElementById('ops-alert-list');
        if (!container) return;
        if (!alerts.length) {
            container.innerHTML = '<p class="empty-message">暂无预警</p>';
            return;
        }
        const iconMap = { critical: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info', success: 'fa-circle-check' };
        container.innerHTML = alerts.map(item => `
            <div class="ops-item ${this.escapeHtml(item.severity || 'info')}">
                <div class="ops-item-icon"><i class="fas ${iconMap[item.severity] || 'fa-circle-info'}"></i></div>
                <div>
                    <strong>${this.escapeHtml(item.title || '')}</strong>
                    <p>${this.escapeHtml(item.message || '')}</p>
                    <small>${this.escapeHtml(item.action || '')}</small>
                </div>
            </div>
        `).join('');
    },

    renderOpsRecommendations: function(items) {
        const container = document.getElementById('ops-recommendation-list');
        if (!container) return;
        if (!items.length) {
            container.innerHTML = '<p class="empty-message">暂无建议</p>';
            return;
        }
        container.innerHTML = items.map(item => `
            <div class="ops-item ${this.escapeHtml(item.priority || 'medium')}">
                <div class="ops-item-icon"><i class="fas fa-lightbulb"></i></div>
                <div>
                    <strong>${this.escapeHtml(item.title || '')}</strong>
                    <p>${this.escapeHtml(item.reason || '')}</p>
                    <small>${this.escapeHtml(item.action || '')}</small>
                </div>
            </div>
        `).join('');
    },

    renderOpsEquipmentRanking: function(rows) {
        const container = document.getElementById('ops-equipment-ranking');
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = '<p class="empty-message">暂无设备工时数据</p>';
            return;
        }
        container.innerHTML = `
            <table class="ranking-table">
                <thead><tr><th>设备</th><th>分类</th><th>工时</th><th>油耗</th><th>L/h</th></tr></thead>
                <tbody>
                    ${rows.slice(0, 8).map(row => `
                        <tr>
                            <td>${this.escapeHtml(row.code || '')} ${this.escapeHtml(row.name || '')}</td>
                            <td>${this.escapeHtml(row.category || '')}</td>
                            <td>${Number(row.hours || 0).toFixed(1)}</td>
                            <td>${Number(row.fuel || 0).toFixed(1)}</td>
                            <td>${Number(row.fuel_per_hour || 0).toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderOpsDataHealth: function(data) {
        const health = data.data_health || {};
        const k = data.kpis || {};
        const cards = [
            ['工时天数', health.worklog_days || 0],
            ['运输天数', health.shipping_days || 0],
            ['车牌比对天数', health.plate_counter_days || 0],
            ['未分类设备', health.unclassified_equipment || 0],
            ['进行中工时', health.open_sessions || 0],
            ['超时工时', health.stale_sessions || 0],
            ['财务记录', k.finance_record_count || 0],
            ['车牌数', k.shipping_plate_count || 0]
        ];
        const container = document.getElementById('ops-data-health');
        if (container) {
            container.innerHTML = cards.map(([label, value]) => `
                <div class="ops-health-card"><strong>${value}</strong><span>${label}</span></div>
            `).join('');
        }

        const unknown = document.getElementById('ops-unknown-plates');
        if (!unknown) return;
        const rows = data.unknown_shipping_plates || [];
        if (!rows.length) {
            unknown.innerHTML = '<p class="empty-message">未发现未登记运输车牌</p>';
            return;
        }
        unknown.innerHTML = `
            <h4 class="section-mini-title">高频未登记车牌</h4>
            <table class="ranking-table">
                <thead><tr><th>车牌</th><th>记录数</th></tr></thead>
                <tbody>${rows.slice(0, 6).map(row => `<tr><td>${this.escapeHtml(row.plate)}</td><td>${row.trips}</td></tr>`).join('')}</tbody>
            </table>
        `;
    },

    renderOpsRoadmap: function(items) {
        const container = document.getElementById('ops-roadmap');
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="roadmap-item">
                <span class="roadmap-stage">${this.escapeHtml(item.stage || '')}</span>
                <div>
                    <strong>${this.escapeHtml(item.title || '')}</strong>
                    <p>${this.escapeHtml(item.value || '')}</p>
                </div>
                <span class="roadmap-status ${this.escapeHtml(item.status || '')}">${this.escapeHtml(item.status || '')}</span>
            </div>
        `).join('');
    },

    loadDashboardActivities: function() {
        API.dashboard.getRecentActivity().then(activities => {
            const container = document.getElementById('activity-list');
            if (!container) return;
            if (!activities || activities.length === 0) {
                container.innerHTML = '<p class="empty-message">暂无最近活动</p>';
                return;
            }
            container.innerHTML = activities.map(a => `
                <div class="activity-item">
                    <div class="activity-icon"><i class="fas ${a.icon || 'fa-circle'}"></i></div>
                    <div class="activity-details">
                        <p><strong>${a.title || ''}</strong></p>
                        <p>${a.description || ''}</p>
                        <p class="activity-time">${a.time || ''}</p>
                    </div>
                </div>
            `).join('');
        }).catch(() => {});
    },

    loadDashboardTodayWorklogs: function() {
        const dateInput = document.getElementById('today-worklog-date');
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
        this.loadTodayWorklogs();
    },

    // ── Fuel Trend Chart ──
    loadFuelTrendChart: function() {
        API.dashboard.getFuelTrend().then(data => {
            const canvas = document.getElementById('fuel-trend-chart');
            if (!canvas) return;
            if (this.charts.fuelTrend) this.charts.fuelTrend.destroy();
            canvas.height = 280;
            const chartContainer = canvas.closest('.chart-container');
            if (chartContainer) chartContainer.style.height = '370px';

            const labels = data.map(d => d.date);
            const fuelData = data.map(d => d.total_fuel);

            this.charts.fuelTrend = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: '油耗 (升)',
                        data: fuelData,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#2563eb',
                        borderWidth: 2
                    }]
                },
                options: this.getDarkChartOptions()
            });
        }).catch(() => {});
    },

    // ── Finance Charts ──
    loadFinanceCharts: function() {
        API.dashboard.getFinanceSummary().then(data => {
            const container = document.getElementById('currency-summary');
            if (!container) return;
            const currencies = data.currencies || {};
            if (Object.keys(currencies).length === 0) {
                container.innerHTML = '<p class="empty-message">暂无数据</p>';
                return;
            }
            container.innerHTML = Object.entries(currencies).map(([k, v]) => `
                <div class="currency-item">
                    <span class="currency-label">${k}</span>
                    <div class="currency-values">
                        <span class="income-value">收入: ${v.income.toFixed(2)}</span>
                        <span class="expense-value">支出: ${v.expense.toFixed(2)}</span>
                    </div>
                </div>
            `).join('');
        }).catch(() => {});

        API.dashboard.getExpenseByCategory().then(data => {
            const canvas = document.getElementById('expense-pie-chart');
            if (!canvas) return;
            if (this.charts.expensePie) this.charts.expensePie.destroy();
            canvas.height = 280;
            const chartContainer = canvas.closest('.chart-container');
            if (chartContainer) chartContainer.style.height = '370px';
            const cats = data.categories || [];
            if (cats.length === 0) return;
            const colors = ['#2563eb','#1d4ed8','#3b82f6','#ef4444','#f97316','#10b981','#06b6d4','#8b5cf6','#6366f1','#ec4899'];
            this.charts.expensePie = new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: cats.map(c => c.currency ? `${c.category} (${c.currency})` : c.category),
                    datasets: [{ data: cats.map(c => c.amount), backgroundColor: colors.slice(0, cats.length) }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#7c819a', font: { size: 11 }, padding: 12 }
                        }
                    }
                }
            });
        }).catch(() => {});
    },

    getDarkChartOptions: function() {
        // Theme-aware chart options (keeps legacy name for compatibility)
        return this.getChartOptions();
    },

    getChartOptions: function() {
        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        return {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: false,
            plugins: {
                legend: {
                    labels: { color: textColor, font: { size: 12 }, padding: 16 }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { color: gridColor }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { color: gridColor }
                }
            }
        };
    },

    // ── Mines ──
    loadMines: function() {
        API.mines.getAll().then(mines => {
            this.cache.mines = mines;
            this.renderTable('mines', mines);
        }).catch(e => this.showError('加载矿山失败: ' + e.message));
    },

    // ── Users ──
    loadUsers: function() {
        if ((Auth.getUserRole ? Auth.getUserRole() : 'mine') === 'user') {
            this.showError('当前账号无权访问用户管理');
            return;
        }
        const minePromise = Auth.isSuperAdmin?.() && this.cache.mines.length === 0
            ? API.mines.getAll({ limit: 1000 }).then(mines => { this.cache.mines = mines || []; })
            : Promise.resolve();

        minePromise.then(() => {
            this.populateUserMineFilter();
            return API.users.getAll(this.getUserFilterParams());
        }).then(users => {
            this.cache.users = users || [];
            this.renderUsersTable(this.cache.users);
        }).catch(e => this.showError('加载用户失败: ' + e.message));
    },

    setupUsers: function() {
        const addBtn = document.getElementById('add-user-btn');
        const filterBtn = document.getElementById('user-filter-btn');
        if (addBtn) addBtn.onclick = () => this.showUserModal();
        if (filterBtn) filterBtn.onclick = () => this.loadUsers();
    },

    populateUserMineFilter: function() {
        const select = document.getElementById('user-mine-filter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部矿山</option>' + this.cache.mines
            .map(mine => `<option value="${mine.id}">${this.escapeHtml(mine.name)}</option>`)
            .join('');
        if (current && this.cache.mines.some(mine => mine.id === current)) select.value = current;
    },

    getUserFilterParams: function() {
        const params = { limit: 1000 };
        const mineId = document.getElementById('user-mine-filter')?.value || '';
        const role = document.getElementById('user-role-filter')?.value || '';
        const active = document.getElementById('user-active-filter')?.value || '';
        if (mineId) params.mine_id = mineId;
        if (role) params.role = role;
        if (active !== '') params.active = active;
        return params;
    },

    renderUsersTable: function(users) {
        const tbody = document.querySelector('#users-table tbody');
        if (!tbody) return;
        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-message">暂无用户</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(user => {
            const canManage = this.canManageUserAccount(user);
            const actionHtml = canManage
                ? `<button class="action-btn edit user-edit" data-id="${user.id}" title="编辑"><i class="fas fa-edit"></i></button>
                   ${Number(user.active) === 1 ? `<button class="action-btn delete user-disable" data-id="${user.id}" title="停用"><i class="fas fa-ban"></i></button>` : ''}`
                : '<span style="color:var(--muted);font-size:12px;">不可编辑</span>';
            return `<tr>
                <td>${this.escapeHtml(user.username)}</td>
                <td>${this.escapeHtml(user.display_name)}</td>
                <td>${this.escapeHtml(user.email || '未绑定')}</td>
                <td>${this.getAccountRoleBadge(user.role)}</td>
                <td>${this.escapeHtml(user.mine_name || this.getMineName(user.mine_id))}</td>
                <td>${this.getAccountActiveBadge(user.active)}</td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '--'}</td>
                <td class="actions">${actionHtml}</td>
            </tr>`;
        }).join('');
        this.setupUserTableActions();
    },

    setupUserTableActions: function() {
        document.querySelectorAll('#users-table .user-edit').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                API.users.getById(id).then(user => this.showUserModal(user))
                    .catch(e => this.showError('获取用户失败: ' + e.message));
            };
        });
        document.querySelectorAll('#users-table .user-disable').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                if (!confirm('确定要停用这个用户吗？停用后该账号不能再登录。')) return;
                API.users.delete(id).then(() => {
                    this.showSuccess('用户已停用');
                    this.loadUsers();
                }).catch(e => this.showError('停用失败: ' + e.message));
            };
        });
    },

    canManageUserAccount: function(user) {
        const currentRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
        if (Auth.currentUser?.id && user.id === Auth.currentUser.id) return false;
        if (currentRole === 'super') return true;
        if (currentRole === 'mine') return user.role === 'user';
        return false;
    },

    getAccountRoleBadge: function(role) {
        if (role === 'super') return '<span class="status-badge maintenance">超级管理员</span>';
        if (role === 'mine') return '<span class="status-badge active">矿山子管理员</span>';
        if (role === 'user') return '<span class="status-badge inactive">矿山子用户</span>';
        return this.escapeHtml(role || '');
    },

    getAccountActiveBadge: function(active) {
        return Number(active) === 1
            ? '<span class="status-badge active">启用</span>'
            : '<span class="status-badge inactive">停用</span>';
    },

    showUserModal: function(user = null) {
        if (Auth.isSuperAdmin?.() && this.cache.mines.length === 0) {
            API.mines.getAll({ limit: 1000 }).then(mines => {
                this.cache.mines = mines || [];
                this.showUserModal(user);
            }).catch(e => this.showError('加载矿山列表失败: ' + e.message));
            return;
        }

        this.currentEditId = user ? user.id : null;
        const isEdit = !!user;
        const isSuper = Auth.isSuperAdmin?.();
        const role = user?.role || 'user';
        const mineOptions = this.cache.mines
            .map(mine => `<option value="${mine.id}" ${mine.id === user?.mine_id ? 'selected' : ''}>${this.escapeHtml(mine.name)}</option>`)
            .join('');
        const roleField = isSuper
            ? `<div class="form-group"><label>角色</label><select name="role" id="user-role-input" class="form-control">
                    <option value="mine" ${role === 'mine' ? 'selected' : ''}>矿山子管理员</option>
                    <option value="user" ${role === 'user' ? 'selected' : ''}>矿山子用户</option>
                    <option value="super" ${role === 'super' ? 'selected' : ''}>超级管理员</option>
                </select></div>`
            : '<input type="hidden" name="role" value="user">';
        const mineField = isSuper
            ? `<div class="form-group" id="user-mine-field"><label>所属矿山</label><select name="mine_id" class="form-control">${mineOptions}</select></div>`
            : `<input type="hidden" name="mine_id" value="${this.escapeAttr(Auth.getUserMineId?.() || '')}">`;
        const activeField = isEdit
            ? `<div class="form-group"><label>状态</label><select name="active" class="form-control"><option value="1" ${Number(user.active) === 1 ? 'selected' : ''}>启用</option><option value="0" ${Number(user.active) !== 1 ? 'selected' : ''}>停用</option></select></div>`
            : '';

        const modalHtml = `
            <div class="modal-header">
                <h3>${isEdit ? '编辑用户' : '新增用户'}</h3>
                <button class="close modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <form id="modal-form">
                    <div class="form-group"><label>用户名</label><input type="text" name="username" class="form-control" value="${this.escapeAttr(user?.username || '')}" required></div>
                    <div class="form-group"><label>显示名称</label><input type="text" name="display_name" class="form-control" value="${this.escapeAttr(user?.display_name || '')}" required></div>
                    <div class="form-group"><label>邮箱</label><input type="email" name="email" class="form-control" value="${this.escapeAttr(user?.email || '')}" placeholder="用于忘记密码找回"></div>
                    <div class="form-group"><label>密码</label><input type="password" name="password" class="form-control" ${isEdit ? 'placeholder="不修改请留空"' : 'required'}></div>
                    ${roleField}
                    ${mineField}
                    ${activeField}
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">取消</button>
                <button class="btn btn-primary save-user-submit">保存</button>
            </div>
        `;
        this.showModal(modalHtml);
        const saveBtn = document.querySelector('#modal-container .save-user-submit');
        if (saveBtn) saveBtn.onclick = () => this.saveUser();
        const roleInput = document.getElementById('user-role-input');
        const toggleMine = () => {
            const field = document.getElementById('user-mine-field');
            if (!field || !roleInput) return;
            field.style.display = roleInput.value === 'super' ? 'none' : '';
        };
        if (roleInput) {
            roleInput.onchange = toggleMine;
            toggleMine();
        }
    },

    saveUser: function() {
        const form = document.getElementById('modal-form');
        if (!form) return;
        const data = {};
        new FormData(form).forEach((value, key) => { data[key] = typeof value === 'string' ? value.trim() : value; });

        if (!data.username) { this.showError('请输入用户名'); return; }
        if (!data.display_name) { this.showError('请输入显示名称'); return; }
        if (!this.currentEditId && (!data.password || data.password.length < 6)) { this.showError('密码至少需要 6 位'); return; }
        if (this.currentEditId && !data.password) delete data.password;
        if (data.role === 'super') delete data.mine_id;
        if (data.role !== 'super' && Auth.isSuperAdmin?.() && !data.mine_id) { this.showError('请选择所属矿山'); return; }

        const promise = this.currentEditId ? API.users.update(this.currentEditId, data) : API.users.create(data);
        promise.then(() => {
            this.showSuccess(this.currentEditId ? '用户已更新' : '用户已创建');
            this.hideModal();
            this.loadUsers();
        }).catch(e => this.showError('保存失败: ' + e.message));
    },

    // ── Equipment ──
    loadEquipment: function() {
        let p = Promise.resolve();
        // 只在有权限时加载矿山列表，矿山子用户使用自己的 mine_id
        const userRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
        if (userRole === 'super' && this.cache.mines.length === 0) {
            p = API.mines.getAll().then(m => { this.cache.mines = m; }).catch(() => {});
        }
        p.then(() => API.equipment.getAll()).then(eq => {
            this.cache.equipment = eq;
            this.filterEquipmentTable();
        }).catch(e => this.showError('加载设备失败: ' + e.message));
    },

    // ── Employees ──
    loadEmployees: function() {
        API.employees.getAll({ limit: 1000 }).then(employees => {
            this.cache.employees = employees;
            this.renderTable('employees', employees);
            this.populateEmployeeAttendanceFilters();
            this.loadEmployeeAttendanceDashboard();
            this.refreshEmployeeAttendance();
            this.loadActiveEmployeeAttendance();
        }).catch(e => this.showError('加载员工失败: ' + e.message));
    },

    setupEmployees: function() {
        const filterBtn = document.getElementById('attendance-filter-btn');
        if (filterBtn) {
            filterBtn.onclick = () => this.refreshEmployeeAttendance();
        }
    },

    populateEmployeeAttendanceFilters: function() {
        const select = document.getElementById('attendance-employee-filter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部员工</option>' + this.cache.employees.map(employee => {
            const label = `${employee.name_cn || employee.name_fr || '未命名'}${employee.job ? ' - ' + employee.job : ''}`;
            return `<option value="${employee.id}">${this.escapeHtml(label)}</option>`;
        }).join('');
        select.value = current;
    },

    getEmployeeAttendanceParams: function() {
        const params = { page: 1, page_size: 200 };
        const start = document.getElementById('attendance-start-date')?.value;
        const end = document.getElementById('attendance-end-date')?.value;
        const employeeId = document.getElementById('attendance-employee-filter')?.value;
        const status = document.getElementById('attendance-status-filter')?.value;
        if (start) params.start_date = start;
        if (end) params.end_date = end;
        if (employeeId) params.employee_id = employeeId;
        if (status) params.status = status;
        return params;
    },

    loadEmployeeAttendanceDashboard: function() {
        Promise.all([
            API.employeeAttendance.stats({ period: 'today' }),
            API.employeeAttendance.stats({ period: 'month' }),
            API.employeeAttendance.active()
        ]).then(([today, month, active]) => {
            const todayCount = document.getElementById('emp-today-count');
            const activeCount = document.getElementById('emp-active-count');
            const todayHours = document.getElementById('emp-today-hours');
            const monthHours = document.getElementById('emp-month-hours');
            if (todayCount) todayCount.textContent = today.unique_employees || 0;
            if (activeCount) activeCount.textContent = active.length || 0;
            if (todayHours) todayHours.textContent = Number(today.total_hours || 0).toFixed(1);
            if (monthHours) monthHours.textContent = Number(month.total_hours || 0).toFixed(1);
        }).catch(e => this.showError('加载签到统计失败: ' + e.message));
    },

    refreshEmployeeAttendance: function() {
        const tbody = document.querySelector('#employee-attendance-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-message">加载中...</td></tr>';
        API.employeeAttendance.records(this.getEmployeeAttendanceParams()).then(data => {
            this.renderEmployeeAttendanceTable(data.items || []);
        }).catch(e => this.showError('加载签到记录失败: ' + e.message));
    },

    loadActiveEmployeeAttendance: function() {
        const container = document.getElementById('employee-active-list');
        if (!container) return;
        container.innerHTML = '<p class="empty-message">加载中...</p>';
        API.employeeAttendance.active().then(records => {
            if (!records.length) {
                container.innerHTML = '<p class="empty-message">当前没有正在上班的员工</p>';
                return;
            }
            container.innerHTML = records.map(record => `
                <div class="today-wl-item">
                    <span class="wl-eq">${this.escapeHtml(record.employee_name || '员工')}</span>
                    <span>${this.escapeHtml(record.employee_job || '未填写岗位')}</span>
                    <span class="wl-hours">签到 ${new Date(record.check_in_time).toLocaleString()}</span>
                    <span class="wl-remark">${this.escapeHtml(record.remark || '')}</span>
                    <button class="btn btn-secondary btn-sm emp-checkout-btn" data-id="${record.id}">签退</button>
                </div>
            `).join('');
            container.querySelectorAll('.emp-checkout-btn').forEach(btn => {
                btn.onclick = () => this.checkoutEmployeeAttendance(btn.getAttribute('data-id'));
            });
        }).catch(e => { container.innerHTML = `<p class="empty-message">加载失败: ${this.escapeHtml(e.message)}</p>`; });
    },

    renderEmployeeAttendanceTable: function(records) {
        const tbody = document.querySelector('#employee-attendance-table tbody');
        if (!tbody) return;
        if (!records.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-message">暂无签到记录</td></tr>';
            return;
        }
        tbody.innerHTML = records.map(record => `
            <tr>
                <td>${this.escapeHtml(record.employee_name || '员工')}</td>
                <td>${this.escapeHtml(record.employee_job || '')}</td>
                <td>${new Date(record.check_in_time).toLocaleString()}</td>
                <td>${record.check_out_time ? new Date(record.check_out_time).toLocaleString() : '—'}</td>
                <td><strong>${Number(record.duration_hours || 0).toFixed(2)}</strong></td>
                <td>${this.getAttendanceStatusBadge(record.status)}</td>
                <td>${this.escapeHtml(record.recorder_name || '')}</td>
                <td>${this.escapeHtml(record.remark || '')}</td>
            </tr>
        `).join('');
    },

    getAttendanceStatusBadge: function(status) {
        if (status === 'checked_in') return '<span class="status-badge maintenance">已签到</span>';
        if (status === 'checked_out') return '<span class="status-badge active">已签退</span>';
        return this.escapeHtml(status || '');
    },

    checkoutEmployeeAttendance: function(id) {
        if (!id || !confirm('确定为这名员工签退吗？')) return;
        API.employeeAttendance.checkOut(id, {}).then(() => {
            this.showSuccess('员工已签退');
            this.loadEmployeeAttendanceDashboard();
            this.refreshEmployeeAttendance();
            this.loadActiveEmployeeAttendance();
        }).catch(e => this.showError('签退失败: ' + e.message));
    },

    // ── Finance ──
    loadFinance: function() {
        if (Auth.isSuperAdmin?.() && this.cache.mines.length === 0) {
            API.mines.getAll({ limit: 1000 }).then(mines => {
                this.cache.mines = mines || [];
                this.populateFinanceMineFilter();
                this.loadFinance();
            }).catch(e => this.showError('加载矿山列表失败: ' + e.message));
            return;
        }
        this.populateFinanceMineFilter();
        const params = this.getFinanceFilterParams();
        const recordsParams = { ...params, limit: 1000 };
        Promise.all([
            API.finance.analysis(params),
            API.finance.getAll(recordsParams)
        ]).then(([analysis, finance]) => {
            this.financeAnalysis = analysis || {};
            this.financeRecords = Array.isArray(finance) ? finance : [];
            this.renderFinanceOverview();
            this.renderFinanceCharts();
            this.renderFinanceLedger();
            this.setupFinanceControls();
        }).catch(e => this.showError('加载财务失败: ' + e.message));
    },

    populateFinanceMineFilter: function() {
        const select = document.getElementById('finance-mine-filter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部矿山（合并）</option>' + (this.cache.mines || [])
            .map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`)
            .join('');
        if (current && this.cache.mines.some(mine => mine.id === current)) select.value = current;
    },

    setupFinanceControls: function() {
        const apply = document.getElementById('finance-apply-filter');
        const reset = document.getElementById('finance-reset-filter');
        if (apply && !apply.dataset.bound) {
            apply.dataset.bound = '1';
            apply.onclick = () => this.loadFinance();
        }
        if (reset && !reset.dataset.bound) {
            reset.dataset.bound = '1';
            reset.onclick = () => {
                ['finance-mine-filter', 'finance-start-date', 'finance-end-date', 'finance-currency-filter'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.financeActiveType = 'all';
                this.loadFinance();
            };
        }
        document.querySelectorAll('.finance-record-tab').forEach(tab => {
            if (tab.dataset.bound) return;
            tab.dataset.bound = '1';
            tab.onclick = () => {
                this.financeActiveType = tab.getAttribute('data-finance-type') || 'all';
                this.renderFinanceLedger();
            };
        });
    },

    getFinanceFilterParams: function() {
        const params = {};
        const mineId = document.getElementById('finance-mine-filter')?.value || '';
        const startDate = document.getElementById('finance-start-date')?.value || '';
        const endDate = document.getElementById('finance-end-date')?.value || '';
        if (mineId) params.mine_id = mineId;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        return params;
    },

    getFinanceCurrencyFilter: function() {
        return document.getElementById('finance-currency-filter')?.value || '';
    },

    financeCurrencyEntries: function(currencies) {
        const entries = Object.entries(currencies || {});
        const selected = this.getFinanceCurrencyFilter();
        const filtered = selected ? entries.filter(([currency]) => currency === selected) : entries;
        const order = { USD: 0, CDF: 1 };
        return filtered.sort(([left], [right]) => (order[left] ?? 10) - (order[right] ?? 10) || left.localeCompare(right));
    },

    financeMoney: function(value, currency) {
        const amount = Number(value || 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return currency ? `${currency} ${amount}` : amount;
    },

    financeMoneyStack: function(currencies, key) {
        const rows = this.financeCurrencyEntries(currencies);
        if (!rows.length) return `<span class="finance-money-line">${this.getFinanceCurrencyFilter() || 'USD'} 0.00</span>`;
        return rows.map(([currency, item]) => {
            const amount = key === 'net'
                ? Number(item.income || 0) - Number(item.expense || 0)
                : Number(item[key] || 0);
            return `<span class="finance-money-line ${amount < 0 ? 'negative' : ''}">${this.financeMoney(amount, currency)}</span>`;
        }).join('');
    },

    renderFinanceOverview: function() {
        const analysis = this.financeAnalysis || {};
        const currencies = analysis.currencies || {};
        const startDate = document.getElementById('finance-start-date')?.value || '';
        const endDate = document.getElementById('finance-end-date')?.value || '';
        const periodText = startDate || endDate ? `${startDate || '最早'} 至 ${endDate || '今日'}` : '全部期间';
        const set = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };
        set('finance-kpi-income', this.financeMoneyStack(currencies, 'income'));
        set('finance-kpi-expense', this.financeMoneyStack(currencies, 'expense'));
        set('finance-kpi-net', this.financeMoneyStack(currencies, 'net'));
        set('finance-kpi-count', String(analysis.record_count ?? this.financeRecords.length));
        const period = document.getElementById('finance-kpi-period');
        if (period) period.textContent = periodText;
        this.renderFinanceCurrencyBreakdown(currencies);
    },

    renderFinanceCurrencyBreakdown: function(currencies) {
        const container = document.getElementById('finance-currency-breakdown');
        if (!container) return;
        const rows = this.financeCurrencyEntries(currencies);
        if (!rows.length) {
            container.innerHTML = '<p class="empty-message">暂无币种汇总</p>';
            return;
        }
        container.innerHTML = rows.map(([currency, item]) => {
            const income = Number(item.income || 0);
            const expense = Number(item.expense || 0);
            const net = income - expense;
            return `<div class="finance-breakdown-row">
                <span>${this.escapeHtml(currency)}</span>
                <strong>${this.financeMoney(net, '')}</strong>
                <small>收入 ${this.financeMoney(income, '')} · 支出 ${this.financeMoney(expense, '')}</small>
            </div>`;
        }).join('');
    },

    renderFinanceCharts: function() {
        this.renderFinanceTrendChart();
        this.renderFinanceModuleChart();
        this.renderFinanceDescriptionRanking();
    },

    renderFinanceTrendChart: function() {
        const canvas = document.getElementById('finance-trend-chart');
        if (!canvas) return;
        if (this.charts.financeTrend) {
            this.charts.financeTrend.destroy();
            this.charts.financeTrend = null;
        }
        canvas.height = 300;
        const chartContainer = canvas.closest('.chart-container');
        if (chartContainer) chartContainer.style.height = '390px';
        const trend = this.financeAnalysis?.monthly_trend || [];
        const selected = this.getFinanceCurrencyFilter();
        const currency = selected || this.financeCurrencyEntries(this.financeAnalysis?.currencies || {})[0]?.[0] || trend[0]?.currency || 'USD';
        const rows = trend.filter(row => row.currency === currency);
        if (!rows.length) {
            canvas.replaceWith(canvas.cloneNode(true));
            return;
        }
        this.charts.financeTrend = new Chart(canvas, {
            data: {
                labels: rows.map(row => row.month),
                datasets: [
                    { type: 'bar', label: `收入 ${currency}`, data: rows.map(row => row.income), backgroundColor: 'rgba(16,185,129,0.72)', borderRadius: 6 },
                    { type: 'bar', label: `支出 ${currency}`, data: rows.map(row => row.expense), backgroundColor: 'rgba(239,68,68,0.72)', borderRadius: 6 },
                    { type: 'line', label: `净额 ${currency}`, data: rows.map(row => Number(row.income || 0) - Number(row.expense || 0)), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.32 }
                ]
            },
            options: this.getDarkChartOptions()
        });
    },

    renderFinanceModuleChart: function() {
        const canvas = document.getElementById('finance-module-chart');
        if (!canvas) return;
        if (this.charts.financeModule) {
            this.charts.financeModule.destroy();
            this.charts.financeModule = null;
        }
        canvas.height = 280;
        const chartContainer = canvas.closest('.chart-container');
        if (chartContainer) chartContainer.style.height = '370px';
        const selected = this.getFinanceCurrencyFilter();
        const rows = (this.financeAnalysis?.expense_categories || [])
            .filter(row => !selected || row.currency === selected)
            .slice(0, 8);
        if (!rows.length) {
            canvas.replaceWith(canvas.cloneNode(true));
            return;
        }
        const colors = ['#2563eb','#10b981','#06b6d4','#ef4444','#8b5cf6','#f97316','#6366f1','#ec4899'];
        this.charts.financeModule = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: rows.map(row => `${row.category || '未分类'}${selected ? '' : ` (${row.currency})`}`),
                datasets: [{ data: rows.map(row => row.amount), backgroundColor: colors.slice(0, rows.length), borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#7c819a', font: { size: 11 }, padding: 12 } } }
            }
        });
    },

    renderFinanceDescriptionRanking: function() {
        const container = document.getElementById('finance-description-ranking');
        if (!container) return;
        const selected = this.getFinanceCurrencyFilter();
        const rows = (this.financeAnalysis?.expense_descriptions || [])
            .filter(row => !selected || row.currency === selected)
            .slice(0, 8);
        if (!rows.length) {
            container.innerHTML = '<p class="empty-message">暂无支出说明分析</p>';
            return;
        }
        container.innerHTML = rows.map((row, index) => `<div class="finance-rank-row">
            <b>${index + 1}</b>
            <span>${this.escapeHtml(row.description || '未填写支出说明')}<small>${row.count || 0} 条 · ${this.escapeHtml(row.currency || '')}</small></span>
            <strong>${this.financeMoney(row.amount, '')}</strong>
        </div>`).join('');
    },

    renderFinanceLedger: function() {
        const tabs = document.querySelectorAll('.finance-record-tab');
        tabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-finance-type') === this.financeActiveType));
        const currency = this.getFinanceCurrencyFilter();
        const rows = this.financeRecords.filter(row => {
            const typeOk = this.financeActiveType === 'all' || row.trans_type === this.financeActiveType;
            const currencyOk = !currency || row.currency === currency;
            return typeOk && currencyOk;
        });
        const incomeCount = this.financeRecords.filter(row => (!currency || row.currency === currency) && row.trans_type === 'income').length;
        const expenseCount = this.financeRecords.filter(row => (!currency || row.currency === currency) && row.trans_type === 'expense').length;
        const allCount = this.financeRecords.filter(row => !currency || row.currency === currency).length;
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('finance-tab-all-count', allCount);
        setText('finance-tab-income-count', incomeCount);
        setText('finance-tab-expense-count', expenseCount);
        this.renderTable('finance', rows);
    },

    // ── Shipping ──
    loadShipping: function() {
        const p = this.cache.factories.length > 0 ? Promise.resolve() : API.factories.getAll().then(f => { this.cache.factories = f; });
        p.then(() => API.shipping.getAll()).then(shipping => {
            this.renderTable('shipping', shipping);
        }).catch(e => this.showError('加载运输数据失败: ' + e.message));
    },

    loadPlates: function() {
        API.plates.getAll().then(plates => {
            this.cache.plates = plates;
            this.renderTable('plates', plates);
        }).catch(e => this.showError('加载车牌失败: ' + e.message));
    },

    loadFactories: function() {
        API.factories.getAll().then(factories => {
            this.cache.factories = factories;
            this.renderTable('factories', factories);
        }).catch(e => this.showError('加载工厂失败: ' + e.message));
    },

    loadFleet: function() {
        const minesPromise = this.cache.mines.length
            ? Promise.resolve()
            : API.mines.getAll({ limit: 1000 }).then(mines => { this.cache.mines = mines; });

        minesPromise.then(() => {
            this.populateFleetMineFilter();
            const params = this.getFleetFilterParams();
            return Promise.all([
                API.fleet.dashboard(params),
                API.fleet.vehicles.getAll({ ...params, limit: 1000 }),
                API.fleet.maintenance.getAll({ ...params, limit: 1000 }),
                API.fleet.fuelTrips.getAll({ ...params, limit: 1000 }),
                API.fleet.plateComparison(params)
            ]);
        }).then(([dashboard, vehicles, maintenance, fuelTrips, comparison]) => {
            this.cache.fleetVehicles = vehicles;
            this.renderFleetDashboard(dashboard);
            this.renderTable('fleet-vehicles', vehicles);
            this.renderTable('fleet-maintenance', maintenance);
            this.renderTable('fleet-fuel-trips', fuelTrips);
            this.renderFleetPlateComparison(comparison);
        }).catch(e => this.showError('加载车队数据失败: ' + e.message));
    },

    loadPlateCounter: function() {
        this._plateCounterResult = null;
        this.loadPlateCounterTargets();
        this.loadPlateCounterHistory();
        this.loadPlateCounterMonth();
    },

    // ── Worklogs (增强：加载设备缓存 + 今日日志 + 历史日志列表) ──
    loadWorklogs: function() {
        // 确保设备缓存已加载（用于日志表中显示设备名称 + 智能录入匹配）
        const eqPromise = this.cache.equipment.length > 0
            ? Promise.resolve()
            : API.equipment.getAll({ limit: 2000 }).then(eq => { this.cache.equipment = eq; }).catch(() => {});

        eqPromise.then(() => {
            // 加载今日日志预览
            this.loadTodayWorklogs();
            // 加载历史日志表格
            this.refreshWorklogTable();
        });
    },

    loadEquipmentHours: function() {
        const now = new Date();
        const startInput = document.getElementById('eh-start-date');
        const endInput = document.getElementById('eh-end-date');
        if (startInput && !startInput.value) startInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        if (endInput && !endInput.value) endInput.value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const eqPromise = this.cache.equipment.length > 0
            ? Promise.resolve(this.cache.equipment)
            : API.equipment.getAll({ limit: 2000 }).then(eq => { this.cache.equipment = eq; return eq; });

        eqPromise.then(() => {
            this.populateEquipmentHoursFilters();
            this.loadTodayWorklogs();
            this.refreshEquipmentHours();
            this.refreshManualEquipmentHours();
            this.loadEquipmentHoursDashboard();
            this.loadEquipmentHoursActive();
            this.loadEquipmentHoursDailyChart();
        }).catch(e => this.showError('加载设备工时失败: ' + e.message));
    },

    /** 刷新历史日志表格 */
    refreshWorklogTable: function() {
        const params = this.getWorklogFilterParams ? this.getWorklogFilterParams() : { limit: 2000 };
        API.worklogs.getAll(params).then(wl => {
            this.renderTable('worklogs', wl);
        }).catch(e => this.showError('加载工作日志失败: ' + e.message));
    },

    // ═══════════════════════════════════════
    // TABLE RENDERING
    // ═══════════════════════════════════════

    getEquipmentName: function(id) {
        if (!id) return '--';
        const eq = this.cache.equipment.find(m => m.id == id);
        return eq ? (eq.name || eq.code || `#${id}`) : `#${id}`;
    },

    getMineName: function(id) {
        if (!id) return '--';
        const m = this.cache.mines.find(x => x.id == id);
        return m ? m.name : id;
    },

    getFactoryName: function(id) {
        if (!id) return '--';
        const f = this.cache.factories.find(x => x.id == id);
        return f ? f.name : id;
    },

    getStatusBadge: function(status) {
        if (!status || status === 'active') return '<span class="status-badge active">运行中</span>';
        if (status === 'inactive') return '<span class="status-badge inactive">闲置中</span>';
        if (status === 'maintenance') return '<span class="status-badge maintenance">维修中</span>';
        return this.escapeHtml(status);
    },

    getEquipmentCategoryOptionHtml: function(selected = '') {
        return this.equipmentCategoryOptions
            .map(value => `<option value="${this.escapeAttr(value)}"${value === selected ? ' selected' : ''}>${this.escapeHtml(value)}</option>`)
            .join('');
    },

    renderTable: function(type, data) {
        const tableId = `${type}-table`;
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        this.ensureBulkEditControls(type);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-message">暂无数据</td></tr>';
            this.updateBulkEditState(type);
            return;
        }
        tbody.innerHTML = data.map(item => this.getTableRow(type, item)).join('');
        this.attachTableActions(type);
        this.updateBulkEditState(type);
    },

    getTableRow: function(type, item) {
        const isSuper = (Auth.getUserRole ? Auth.getUserRole() : 'mine') === 'super';
        const quickStatusBtn = (type === 'equipment')
            ? `<button class="action-btn quick-status" data-id="${item.id}" title="快速切换状态"><i class="fas fa-exchange-alt"></i></button>`
            : '';
        const actions = `
            <td class="actions">
                ${quickStatusBtn}
                <button class="action-btn edit" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </td>`;
        const selectCell = this.isBulkEditableType(type)
            ? `<td class="bulk-select-cell"><input type="checkbox" class="bulk-row-select" data-id="${item.id}"></td>`
            : '';

        switch (type) {
            case 'mines':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.name)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            case 'equipment':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.code)}</td><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(item.brand)}</td><td>${this.escapeHtml(item.category || item.type)}</td><td>${this.escapeHtml(item.short_num)}</td><td>${this.getMineName(item.mine_id)}</td><td>${this.getStatusBadge(item.status)}</td>${actions}</tr>`;
            case 'employees':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.name_fr)}</td><td>${this.escapeHtml(item.name_cn)}</td><td>${this.escapeHtml(item.staff_type || '')}</td><td>${this.escapeHtml(item.job)}</td><td>${item.salary || ''}</td><td>${item.currency || ''}</td>${actions}</tr>`;
            case 'finance':
                return `<tr>${selectCell}<td>${item.trans_type === 'income' ? '收入' : '支出'}</td><td>${item.amount || ''}</td><td>${item.currency || ''}</td><td>${this.escapeHtml(item.description || '')}</td><td>${new Date(item.trans_date).toLocaleDateString()}</td>${actions}</tr>`;
            case 'shipping':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.plate_number)}</td><td>${new Date(item.load_time).toLocaleDateString()}</td><td>${this.getFactoryName(item.factory_id)}</td><td>${this.escapeHtml(item.cargo_type)}</td>${actions}</tr>`;
            case 'worklogs':
                return `<tr>${selectCell}<td>${this.getEquipmentName(item.equipment_id)}</td><td>${new Date(item.work_date).toLocaleDateString()}</td><td>${item.work_hours || ''}</td><td>${item.fuel_liters || ''}</td><td>${this.escapeHtml(item.remark)}</td>${actions}</tr>`;
            case 'plates':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.plate_number)}</td><td>${this.getMineName(item.mine_id)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            case 'factories':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.name)}</td><td>${this.getMineName(item.mine_id)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            case 'fleet-vehicles':
                return `<tr>${selectCell}<td>${this.escapeHtml(item.plate_number)}</td><td>${this.escapeHtml(item.driver_name)}</td><td>${this.escapeHtml(item.driver_phone)}</td><td>${this.escapeHtml(item.vehicle_type)}</td><td>${this.escapeHtml(item.brand_model)}</td><td>${this.formatFleetNumber(item.current_mileage_km)}</td><td>${this.escapeHtml(item.vehicle_status)}</td><td>${this.escapeHtml(item.remark)}</td>${actions}</tr>`;
            case 'fleet-maintenance':
                return `<tr>${selectCell}<td>${this.formatDateCell(item.repair_date)}</td><td>${this.escapeHtml(item.plate_number)}</td><td>${this.escapeHtml(item.driver_name)}</td><td>${this.escapeHtml(item.item_name)}</td><td>${this.escapeHtml(item.part_spec)}</td><td>${this.formatFleetNumber(item.quantity)}</td><td>${this.formatFleetNumber(item.unit_price)}</td><td>${this.formatFleetNumber(item.amount)}</td><td>${this.escapeHtml(item.vendor)}</td><td>${this.escapeHtml(item.handler)}</td><td>${this.formatFleetNumber(item.next_service_mileage_km)}</td><td>${this.escapeHtml(item.status)}</td><td>${this.escapeHtml(item.remark)}</td>${actions}</tr>`;
            case 'fleet-fuel-trips':
                return `<tr>${selectCell}<td>${this.formatDateCell(item.record_date)}</td><td>${this.escapeHtml(item.plate_number)}</td><td>${this.escapeHtml(item.driver_name)}</td><td>${this.formatFleetNumber(item.fuel_liters)}</td><td>${this.formatFleetNumber(item.fuel_unit_price)}</td><td>${this.formatFleetNumber(item.fuel_amount)}</td><td>${item.trip_count || 0}</td><td>${this.formatFleetNumber(item.fuel_consumption_l100km)}</td><td>${this.escapeHtml(item.remark)}</td>${actions}</tr>`;
            default: return '';
        }
    },

    attachTableActions: function(type) {
        const tableId = `${type}-table`;
        document.querySelectorAll(`#${tableId} .bulk-row-select`).forEach(input => {
            input.onchange = () => this.updateBulkEditState(type);
        });
        document.querySelectorAll(`#${tableId} .edit`).forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.showEditModal(type, id);
            };
        });
        document.querySelectorAll(`#${tableId} .delete`).forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.confirmDelete(type, id);
            };
        });
        // Quick status toggle for equipment
        document.querySelectorAll(`#${tableId} .quick-status`).forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (!confirm('确定要切换此设备的状态吗？')) return;
                API.equipment.quickToggleStatus(id).then(res => {
                    this.showSuccess(res.message || '状态已切换');
                    this.loadEquipment();
                }).catch(err => this.showError('切换失败: ' + err.message));
            };
        });
    },

    isBulkEditableType: function(type) {
        return Boolean(API_MAP[type] && API_MAP[type].update && !['mines', 'factories'].includes(type));
    },

    ensureBulkEditControls: function(type) {
        if (!this.isBulkEditableType(type)) return;
        const table = document.getElementById(`${type}-table`);
        if (!table) return;
        const headRow = table.querySelector('thead tr');
        if (headRow && !headRow.querySelector('.bulk-select-head')) {
            headRow.insertAdjacentHTML('afterbegin', `<th class="bulk-select-head" style="width:44px"><input type="checkbox" id="${type}-bulk-select-all"></th>`);
        }
        const container = table.closest('.table-container') || table.parentElement;
        if (!container || container.parentElement?.querySelector(`[data-bulk-toolbar="${type}"]`)) return;
        container.insertAdjacentHTML('beforebegin', `
            <div class="filter-bar compact bulk-edit-toolbar" data-bulk-toolbar="${type}">
                <span id="${type}-bulk-selected-count">已选择 0 条</span>
                <button class="btn btn-secondary btn-sm" id="${type}-bulk-edit-btn" disabled><i class="fas fa-pen-to-square"></i> 批量修改</button>
                <button class="btn btn-secondary btn-sm" id="${type}-bulk-clear-btn" disabled><i class="fas fa-xmark"></i> 清空选择</button>
            </div>
        `);
        document.getElementById(`${type}-bulk-select-all`)?.addEventListener('change', event => {
            table.querySelectorAll('.bulk-row-select').forEach(input => { input.checked = event.target.checked; });
            this.updateBulkEditState(type);
        });
        document.getElementById(`${type}-bulk-edit-btn`)?.addEventListener('click', () => this.showBulkEditModal(type));
        document.getElementById(`${type}-bulk-clear-btn`)?.addEventListener('click', () => {
            table.querySelectorAll('.bulk-row-select').forEach(input => { input.checked = false; });
            const all = document.getElementById(`${type}-bulk-select-all`);
            if (all) all.checked = false;
            this.updateBulkEditState(type);
        });
    },

    getBulkSelectedIds: function(type) {
        return Array.from(document.querySelectorAll(`#${type}-table .bulk-row-select:checked`))
            .map(input => input.getAttribute('data-id'))
            .filter(Boolean);
    },

    updateBulkEditState: function(type) {
        if (!this.isBulkEditableType(type)) return;
        const selected = this.getBulkSelectedIds(type);
        const count = document.getElementById(`${type}-bulk-selected-count`);
        const edit = document.getElementById(`${type}-bulk-edit-btn`);
        const clear = document.getElementById(`${type}-bulk-clear-btn`);
        if (count) count.textContent = `已选择 ${selected.length} 条`;
        if (edit) edit.disabled = selected.length === 0;
        if (clear) clear.disabled = selected.length === 0;
        const all = document.getElementById(`${type}-bulk-select-all`);
        const rows = document.querySelectorAll(`#${type}-table .bulk-row-select`);
        if (all) all.checked = rows.length > 0 && selected.length === rows.length;
    },

    getBulkEditableFields: function(type) {
        const commonRemark = { name: 'remark', label: '备注', kind: 'textarea' };
        const fields = {
            equipment: [
                { name: 'status', label: '状态', kind: 'select', options: [['active', '运行中'], ['inactive', '闲置中'], ['maintenance', '维修中']] },
                { name: 'type', label: '设备类别', kind: 'select', options: this.equipmentCategoryOptions.map(value => [value, value]) },
                { name: 'brand', label: '品牌', kind: 'text' }
            ],
            employees: [
                { name: 'staff_type', label: '人员类型', kind: 'select', options: [['刚方', '刚方'], ['中方', '中方']] },
                { name: 'job', label: '职位', kind: 'text' },
                { name: 'currency', label: '货币', kind: 'select', options: [['USD', 'USD'], ['CDF', 'CDF']] }
            ],
            finance: [
                { name: 'trans_type', label: '类型', kind: 'select', options: [['income', '收入'], ['expense', '支出']] },
                { name: 'category', label: '支出模块', kind: 'select', options: this.financeExpenseCategories.map(value => [value, value]) },
                { name: 'currency', label: '货币', kind: 'select', options: [['USD', 'USD'], ['CDF', 'CDF']] }
            ],
            shipping: [
                { name: 'factory_id', label: '工厂', kind: 'select', options: (this.cache.factories || []).map(f => [f.id, f.name]) },
                { name: 'cargo_type', label: '货物类型', kind: 'text' }
            ],
            plates: [
                { name: 'vehicle_type', label: '车辆类型', kind: 'text' },
                { name: 'color', label: '颜色', kind: 'text' },
                commonRemark
            ],
            worklogs: [
                { name: 'work_date', label: '工作日期', kind: 'date' },
                { name: 'work_hours', label: '工作小时', kind: 'number', step: '0.1' },
                { name: 'fuel_liters', label: '燃油升数', kind: 'number', step: '0.1' },
                commonRemark
            ],
            'fleet-vehicles': [
                { name: 'vehicle_type', label: '车辆类型', kind: 'text' },
                { name: 'vehicle_status', label: '车辆状态', kind: 'select', options: [['在用', '在用'], ['维修中', '维修中'], ['待配件', '待配件'], ['待保养', '待保养'], ['备用', '备用'], ['停用', '停用']] },
                { name: 'driver_name', label: '司机姓名', kind: 'text' },
                commonRemark
            ],
            'fleet-maintenance': [
                { name: 'repair_date', label: '维修日期', kind: 'date' },
                { name: 'status', label: '状态', kind: 'text' },
                { name: 'vendor', label: '维修厂家/地点', kind: 'text' },
                { name: 'handler', label: '经办人', kind: 'text' },
                commonRemark
            ],
            'fleet-fuel-trips': [
                { name: 'record_date', label: '日期', kind: 'date' },
                { name: 'fuel_unit_price', label: '单价', kind: 'number', step: '0.01' },
                commonRemark
            ]
        };
        return fields[type] || [];
    },

    renderBulkValueInput: function(field) {
        if (field.kind === 'select') {
            return `<select name="value" class="form-control">${(field.options || []).map(([value, label]) => `<option value="${this.escapeAttr(value)}">${this.escapeHtml(label)}</option>`).join('')}</select>`;
        }
        if (field.kind === 'textarea') return '<textarea name="value" class="form-control"></textarea>';
        if (field.kind === 'date') return '<input type="date" name="value" class="form-control">';
        if (field.kind === 'number') return `<input type="number" name="value" class="form-control" step="${field.step || '0.01'}">`;
        return '<input type="text" name="value" class="form-control">';
    },

    showBulkEditModal: function(type) {
        const ids = this.getBulkSelectedIds(type);
        if (!ids.length) { this.showError('请先勾选要修改的数据'); return; }
        const fields = this.getBulkEditableFields(type);
        if (!fields.length) { this.showError('当前表暂不支持批量修改'); return; }
        this.showModal(`
            <div class="modal-header"><h3>批量修改 ${this.getPageTitle(type)}</h3><button class="close modal-close"><i class="fas fa-times"></i></button></div>
            <div class="modal-body">
                <p class="empty-message">将同时修改已勾选的 ${ids.length} 条数据。</p>
                <form id="bulk-edit-form">
                    <div class="form-group"><label>要修改的字段</label><select name="field" id="bulk-edit-field" class="form-control">${fields.map(field => `<option value="${field.name}">${this.escapeHtml(field.label)}</option>`).join('')}</select></div>
                    <div class="form-group"><label>新值</label><div id="bulk-edit-value-wrap">${this.renderBulkValueInput(fields[0])}</div></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary modal-cancel">取消</button><button class="btn btn-primary" id="bulk-edit-submit">批量保存</button></div>
        `);
        const fieldSelect = document.getElementById('bulk-edit-field');
        const wrap = document.getElementById('bulk-edit-value-wrap');
        fieldSelect?.addEventListener('change', () => {
            const field = fields.find(item => item.name === fieldSelect.value) || fields[0];
            if (wrap) wrap.innerHTML = this.renderBulkValueInput(field);
        });
        document.getElementById('bulk-edit-submit')?.addEventListener('click', () => this.submitBulkEdit(type, ids));
    },

    submitBulkEdit: function(type, ids) {
        const form = document.getElementById('bulk-edit-form');
        if (!form) return;
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.field) { this.showError('请选择要修改的字段'); return; }
        const api = API_MAP[type];
        const payload = (type === 'equipment' && data.field === 'type')
            ? { type: data.value, category: data.value }
            : { [data.field]: data.value };
        const submit = document.getElementById('bulk-edit-submit');
        if (submit) submit.disabled = true;
        Promise.all(ids.map(id => api.update(id, payload))).then(() => {
            this.showSuccess(`已批量修改 ${ids.length} 条数据`);
            this.hideModal();
            this.loadPageData(this.currentPage);
        }).catch(e => {
            this.showError('批量修改失败: ' + e.message);
        }).finally(() => {
            if (submit) submit.disabled = false;
        });
    },

    escapeHtml: function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeAttr: function(str) {
        return this.escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    formatDateCell: function(value) {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? this.escapeHtml(value) : date.toLocaleDateString();
    },

    formatFleetNumber: function(value) {
        const num = Number(value || 0);
        return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    },

    // ═══════════════════════════════════════
    // FORM FIELDS (unchanged, from original)
    // ═══════════════════════════════════════

    needsMineField: function(type) {
        return ['equipment', 'employees', 'finance', 'shipping', 'worklogs', 'plates', 'factories', 'fleet-vehicles', 'fleet-maintenance', 'fleet-fuel-trips'].includes(type);
    },

    getDefaultMineId: function(payload = {}) {
        if (payload.mine_id) return payload.mine_id;
        if (payload.vehicle_id) {
            const vehicle = (this.cache.fleetVehicles || []).find(v => v.id === payload.vehicle_id);
            if (vehicle?.mine_id) return vehicle.mine_id;
        }
        const modalMine = document.querySelector('#modal-form [name="mine_id"]')?.value || '';
        if (modalMine) return modalMine;
        const currentMine = document.getElementById('finance-mine-filter')?.value
            || document.getElementById('fleet-mine-filter')?.value
            || document.getElementById('ops-mine-filter')?.value
            || document.getElementById('stats-mine-filter')?.value
            || '';
        if (currentMine) return currentMine;
        const userMine = Auth.getUserMineId ? Auth.getUserMineId() : '';
        if (userMine) return userMine;
        return (this.cache.mines || [])[0]?.id || '';
    },

    ensureMineForPayload: function(type, payload) {
        if (!this.needsMineField(type) || !payload || payload.mine_id) return payload;
        const mineId = this.getDefaultMineId(payload);
        if (mineId) payload.mine_id = mineId;
        return payload;
    },

    getMineField: function() {
        const userRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
        const userMineId = Auth.getUserMineId ? Auth.getUserMineId() : '';
        if (userRole !== 'super') {
            return userMineId ? `<input type="hidden" name="mine_id" value="${userMineId}">` : '';
        }
        const options = this.cache.mines.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)}</option>`).join('');
        return `<div class="form-group"><label>所属矿山</label><select name="mine_id" class="form-control" required>${options}</select></div>`;
    },

    getFleetVehicleOptions: function() {
        const vehicles = this.cache.fleetVehicles || [];
        if (!vehicles.length) return '<option value="">请先新增车辆档案</option>';
        return vehicles.map(v => `<option value="${v.id}">${this.escapeHtml(v.plate_number || '')} - ${this.escapeHtml(v.driver_name || '未填司机')} ${v.vehicle_type ? `(${this.escapeHtml(v.vehicle_type)})` : ''}</option>`).join('');
    },

    setupEquipmentCategoryBehavior: function(type) {
        if (type !== 'equipment') return;
        const form = document.getElementById('modal-form');
        if (!form) return;
        const categorySelect = form.querySelector('[name="type"]');
        const categoryInput = form.querySelector('input[name="category"]');
        if (!categorySelect) return;
        const validValues = new Set(this.equipmentCategoryOptions);
        const sync = () => {
            if (!validValues.has(categorySelect.value)) {
                categorySelect.value = categoryInput && validValues.has(categoryInput.value)
                    ? categoryInput.value
                    : (this.equipmentCategoryOptions[0] || '');
            }
            if (categoryInput) categoryInput.value = categorySelect.value;
        };
        categorySelect.addEventListener('change', sync);
        sync();
    },

    getFinanceExpenseCategoryOptionHtml: function(selected = '') {
        return this.financeExpenseCategories
            .map(value => `<option value="${this.escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${this.escapeHtml(value)}</option>`)
            .join('');
    },

    setupFinanceFormBehavior: function(type) {
        if (type !== 'finance') return;
        const form = document.getElementById('modal-form');
        if (!form) return;
        const typeSelect = form.querySelector('[name="trans_type"]');
        const incomeInput = form.querySelector('[data-finance-income-category]');
        const expenseSelect = form.querySelector('[data-finance-expense-category]');
        if (!typeSelect || !incomeInput || !expenseSelect) return;

        const moduleGroup = expenseSelect.closest('.form-group');
        const validCategories = new Set(this.financeExpenseCategories);
        const sync = () => {
            const isExpense = typeSelect.value === 'expense';
            if (moduleGroup) moduleGroup.classList.toggle('hidden', !isExpense);
            incomeInput.disabled = true;
            incomeInput.value = '';
            expenseSelect.disabled = !isExpense;
            incomeInput.classList.add('hidden');
            expenseSelect.classList.toggle('hidden', !isExpense);
            if (isExpense) {
                if (validCategories.has(incomeInput.value)) expenseSelect.value = incomeInput.value;
                if (!validCategories.has(expenseSelect.value)) expenseSelect.value = this.financeExpenseCategories[0] || '';
            }
        };
        typeSelect.addEventListener('change', sync);
        sync();
    },

    getFormFields: function(type) {
        switch (type) {
            case 'mines':
                return `<div class="form-group"><label>名称</label><input type="text" name="name" class="form-control" required></div>
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="create-account-check" style="width:18px;height:18px;">
                        <span style="font-weight:600;">同时创建矿山子账户</span>
                    </label>
                    <div id="account-fields" style="display:none;padding:12px;background:var(--bg2);border-radius:8px;margin-top:8px;">
                        <div class="form-group"><label>账户用户名</label><input type="text" name="account_username" class="form-control" placeholder="登录账号"></div>
                        <div class="form-group"><label>账户密码</label><input type="password" name="account_password" class="form-control" placeholder="登录密码"></div>
                        <div class="form-group"><label>显示名称</label><input type="text" name="account_display_name" class="form-control" placeholder="可选"></div>
                    </div>
                </div>`;
            case 'equipment': {
                const userRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
                const userMineId = Auth.getUserMineId ? Auth.getUserMineId() : '';
                const mineField = (userRole !== 'super' && userMineId)
                    ? `<input type="hidden" name="mine_id" value="${userMineId}">`
                    : `<div class="form-group"><label>所属矿山</label><select name="mine_id" class="form-control">${this.cache.mines.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>`;
                return `<div class="form-group"><label>设备代码</label><input type="text" name="code" class="form-control" required></div>
                <div class="form-group"><label>设备名称</label><input type="text" name="name" class="form-control" required></div>
                <div class="form-group"><label>品牌</label><input type="text" name="brand" class="form-control"></div>
                <div class="form-group"><label>设备类别</label><select name="type" class="form-control">${this.getEquipmentCategoryOptionHtml()}</select></div>
                <input type="hidden" name="category" value="${this.escapeAttr(this.equipmentCategoryOptions[0] || '')}">
                <div class="form-group"><label>短号</label><input type="text" name="short_num" class="form-control" placeholder="例如：400、210"></div>
                <div class="form-group"><label>别名</label><input type="text" name="aliases" class="form-control" placeholder="逗号分隔"></div>
                <div class="form-group"><label>车号</label><input type="text" name="vehicle_num" class="form-control" placeholder="例如：C23"></div>
                ${mineField}
                <div class="form-group"><label>状态</label><select name="status" class="form-control"><option value="active">运行中</option><option value="inactive">闲置中</option><option value="maintenance">维修中</option></select></div>`; }
            case 'employees':
                const employeeMineField = this.getMineField();
                return `<div class="form-group"><label>法文名</label><input type="text" name="name_fr" class="form-control" required></div>
                <div class="form-group"><label>中文名</label><input type="text" name="name_cn" class="form-control"></div>
                <div class="form-group"><label>人员类型</label><select name="staff_type" class="form-control"><option value="刚方">刚方</option><option value="中方">中方</option></select></div>
                <div class="form-group"><label>职位</label><input type="text" name="job" class="form-control"></div>
                <div class="form-group"><label>薪资</label><input type="number" step="0.01" name="salary" class="form-control"></div>
                <div class="form-group"><label>货币</label><select name="currency" class="form-control"><option value="USD">USD</option><option value="CDF">CDF</option></select></div>
                ${employeeMineField}`;
            case 'finance':
                const financeMineField = this.getMineField();
                return `<div class="form-group"><label>类型</label><select name="trans_type" class="form-control"><option value="income">收入</option><option value="expense">支出</option></select></div>
                <div class="form-group"><label>金额</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
                <div class="form-group"><label>货币</label><select name="currency" class="form-control"><option value="USD">USD</option><option value="CDF">CDF</option></select></div>
                <div class="form-group"><label>支出模块</label>
                    <input type="hidden" name="category" data-finance-income-category value="">
                    <select name="category" class="form-control hidden" data-finance-expense-category disabled>${this.getFinanceExpenseCategoryOptionHtml()}</select>
                </div>
                <div class="form-group"><label>支出明细 / 描述</label><textarea name="description" class="form-control"></textarea></div>
                <div class="form-group"><label>日期</label><input type="date" name="trans_date" class="form-control" required></div>
                ${financeMineField}`;
            case 'shipping':
                const shippingMineField = this.getMineField();
                return `<div class="form-group"><label>车牌号</label><input type="text" name="plate_number" class="form-control" required></div>
                <div class="form-group"><label>装载时间</label><input type="datetime-local" name="load_time" class="form-control" required></div>
                <div class="form-group"><label>工厂</label><select name="factory_id" class="form-control">${this.cache.factories.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>货物类型</label><input type="text" name="cargo_type" class="form-control"></div>
                ${shippingMineField}`;
            case 'worklogs':
                const worklogMineField = this.getMineField();
                return `<div class="form-group"><label>设备</label><select name="equipment_id" class="form-control">${this.cache.equipment.map(e => `<option value="${e.id}">${e.name || e.code}</option>`).join('')}</select></div>
                <div class="form-group"><label>工作日期</label><input type="date" name="work_date" class="form-control" required></div>
                <div class="form-group"><label>工作小时</label><input type="number" step="0.1" name="work_hours" class="form-control" required></div>
                <div class="form-group"><label>燃油升数</label><input type="number" step="0.1" name="fuel_liters" class="form-control"></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                ${worklogMineField}`;
            case 'plates':
                return `<div class="form-group"><label>车牌号</label><input type="text" name="plate_number" class="form-control" required></div>
                <div class="form-group"><label>车辆类型</label><input type="text" name="vehicle_type" class="form-control"></div>
                <div class="form-group"><label>品牌</label><input type="text" name="brand" class="form-control"></div>
                <div class="form-group"><label>颜色</label><input type="text" name="color" class="form-control"></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                ${this.getMineField()}`;
            case 'fleet-vehicles':
                return `<div class="form-group"><label>车牌号码</label><input type="text" name="plate_number" class="form-control" required></div>
                <div class="form-group"><label>司机姓名</label><input type="text" name="driver_name" class="form-control"></div>
                <div class="form-group"><label>司机电话</label><input type="text" name="driver_phone" class="form-control"></div>
                <div class="form-group"><label>车辆类型</label><input type="text" name="vehicle_type" class="form-control" placeholder="例如：矿卡、平板、油罐车"></div>
                <div class="form-group"><label>品牌/型号</label><input type="text" name="brand_model" class="form-control"></div>
                <div class="form-group"><label>当前里程(km)</label><input type="number" step="0.01" name="current_mileage_km" class="form-control"></div>
                <div class="form-group"><label>车辆状态</label><select name="vehicle_status" class="form-control"><option value="在用">在用</option><option value="维修中">维修中</option><option value="待配件">待配件</option><option value="待保养">待保养</option><option value="备用">备用</option><option value="停用">停用</option></select></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                ${this.getMineField()}`;
            case 'fleet-maintenance':
                return `<div class="form-group"><label>维修日期</label><input type="date" name="repair_date" class="form-control" required></div>
                <div class="form-group"><label>车辆</label><select name="vehicle_id" class="form-control" required>${this.getFleetVehicleOptions()}</select></div>
                <div class="form-group"><label>配件名称</label><input type="text" name="item_name" class="form-control" required></div>
                <div class="form-group"><label>配件规格/型号</label><input type="text" name="part_spec" class="form-control"></div>
                <div class="form-group"><label>数量</label><input type="number" step="0.01" name="quantity" class="form-control"></div>
                <div class="form-group"><label>单价(元)</label><input type="number" step="0.01" name="unit_price" class="form-control"></div>
                <div class="form-group"><label>配件总额(元)</label><input type="number" step="0.01" name="amount" class="form-control" readonly></div>
                <div class="form-group"><label>维修厂家/地点</label><input type="text" name="vendor" class="form-control"></div>
                <div class="form-group"><label>经办人</label><input type="text" name="handler" class="form-control"></div>
                <div class="form-group"><label>下次保养里程(km)</label><input type="number" step="0.01" name="next_service_mileage_km" class="form-control"></div>
                <div class="form-group"><label>状态</label><input type="text" name="status" class="form-control" placeholder="例如：完成、待处理"></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                ${this.getMineField()}`;
            case 'fleet-fuel-trips':
                return `<div class="form-group"><label>日期</label><input type="date" name="record_date" class="form-control" required></div>
                <div class="form-group"><label>车辆</label><select name="vehicle_id" class="form-control" required>${this.getFleetVehicleOptions()}</select></div>
                <div class="form-group"><label>加油量(升)</label><input type="number" step="0.01" name="fuel_liters" class="form-control"></div>
                <div class="form-group"><label>单价(元/升)</label><input type="number" step="0.01" name="fuel_unit_price" class="form-control"></div>
                <div class="form-group"><label>加油金额(元)</label><input type="number" step="0.01" name="fuel_amount" class="form-control" placeholder="留空时按加油量*单价计算"></div>
                <p class="empty-message">趟数将按所选日期的已保存车牌比对结果自动录入。</p>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                ${this.getMineField()}`;
            case 'factories':
                return `<div class="form-group"><label>名称</label><input type="text" name="name" class="form-control" required></div>
                ${this.getMineField()}`;
            default: return '<p>未知表单类型</p>';
        }
    },

    // ═══════════════════════════════════════
    // EQUIPMENT FILTERS
    // ═══════════════════════════════════════

    setupEquipmentFilters: function() {
        const search = document.getElementById('equipment-search');
        const typeFilter = document.getElementById('equipment-type-filter');
        const statusFilter = document.getElementById('equipment-status-filter');
        const handler = () => this.filterEquipmentTable();
        if (search) search.oninput = handler;
        if (typeFilter) typeFilter.onchange = handler;
        if (statusFilter) statusFilter.onchange = handler;
    },

    filterEquipmentTable: function() {
        const search = (document.getElementById('equipment-search')?.value || '').toLowerCase();
        const typeFilter = document.getElementById('equipment-type-filter')?.value || '';
        const statusFilter = document.getElementById('equipment-status-filter')?.value || '';

        const filtered = (this.cache.equipment || []).filter(item => {
            if (search) {
                const match = (item.name || '').toLowerCase().includes(search) ||
                              (item.code || '').toLowerCase().includes(search) ||
                              (item.brand || '').toLowerCase().includes(search);
                if (!match) return false;
            }
            if (typeFilter && (item.type || '') !== typeFilter) return false;
            if (statusFilter && (item.status || 'active') !== statusFilter) return false;
            return true;
        });
        this.renderTable('equipment', filtered);
    },

    // ═══════════════════════════════════════
    // IMPORT / EXPORT
    // ═══════════════════════════════════════

    getImportLabel: function(type) {
        const labels = { equipment: '设备', employees: '员工', finance: '财务', plate: '车牌', worklogs: '工作日志' };
        return labels[type] || type;
    },

    importNeedsMinePicker: function(type) {
        return Auth.isSuperAdmin?.() && ['employees', 'finance', 'plate'].includes(type);
    },

    refreshAfterImport: function(type) {
        if (type === 'employees') this.loadEmployees();
        else if (type === 'finance') this.loadFinance();
        else if (type === 'plate') this.loadPlates();
        else this.loadEquipment();
    },

    submitImportExcel: function(type, file, mineId, fileInput = null) {
        if (!file) { this.showError('请选择要导入的Excel文件'); return; }
        const api = IMPORT_EXPORT_MAP[type];
        if (!api) { this.showError('未知导入模块'); return; }
        const formData = new FormData();
        formData.append('file', file);
        const params = mineId ? { mine_id: mineId } : {};

        api.importExcel(formData, params).then(result => {
            const errors = result.errors || [];
            if (errors.length) {
                this.showError(`${result.message || '导入完成'}，${errors.length} 行未导入：${errors[0]}`);
            } else {
                this.showSuccess(result.message || '导入成功！');
            }
            if (fileInput) fileInput.value = '';
            this.hideModal();
            this.refreshAfterImport(type);
        }).catch(error => {
            this.showError('导入失败: ' + error.message);
            if (fileInput) fileInput.value = '';
        });
    },

    showImportModal: function(type) {
        const open = () => {
            const mineOptions = this.cache.mines
                .map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`)
                .join('');
            if (!mineOptions) {
                this.showError('请先创建矿山后再导入数据');
                return;
            }
            const label = this.getImportLabel(type);
            const hint = type === 'finance'
                ? '<p class="empty-message">财务支出模块只支持“外联”和“工资”。收入说明请填写描述列。</p>'
                : '';
            this.showModal(`
                <div class="modal-header">
                    <h3>导入${label}Excel</h3>
                    <button class="close modal-close"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    ${hint}
                    <div class="form-group"><label>导入到矿山</label><select id="import-mine-id" class="form-control" required>${mineOptions}</select></div>
                    <div class="form-group"><label>Excel文件</label><input type="file" id="import-excel-file" class="form-control" accept=".xlsx"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">取消</button>
                    <button class="btn btn-primary" id="import-excel-submit">开始导入</button>
                </div>
            `);
            document.getElementById('import-excel-submit')?.addEventListener('click', () => {
                const fileInput = document.getElementById('import-excel-file');
                const mineId = document.getElementById('import-mine-id')?.value || '';
                this.submitImportExcel(type, fileInput?.files?.[0], mineId, fileInput);
            });
        };

        if (this.cache.mines.length) {
            open();
            return;
        }
        API.mines.getAll({ limit: 1000 }).then(mines => {
            this.cache.mines = mines || [];
            open();
        }).catch(error => this.showError('加载矿山列表失败: ' + error.message));
    },

    setupImportExport: function(type) {
        const importBtn = document.getElementById(`import-${type}-btn`);
        const exportBtn = document.getElementById(`export-${type}-btn`);
        const templateBtn = document.getElementById(`download-${type}-template-btn`);
        const fileInput = document.getElementById(`${type}-file-input`);

        if (importBtn && fileInput) {
            importBtn.onclick = () => {
                if (this.importNeedsMinePicker(type)) this.showImportModal(type);
                else fileInput.click();
            };
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                this.submitImportExcel(type, file, '', fileInput);
            };
        }
        if (exportBtn) exportBtn.onclick = () => IMPORT_EXPORT_MAP[type].exportExcel().catch(e => this.showError('导出失败: ' + e.message));
        if (templateBtn) templateBtn.onclick = () => IMPORT_EXPORT_MAP[type].downloadTemplate().catch(e => this.showError('下载模板失败: ' + e.message));
    },

    // ═══════════════════════════════════════
    // EQUIPMENT MONTHLY
    // ═══════════════════════════════════════

    getEquipmentReportMineFilter: function(id) {
        if (!Auth.isSuperAdmin?.()) return '';
        return `<label>矿山 <select id="${id}" class="form-control w-180"><option value="">全部矿山</option></select></label>`;
    },

    populateEquipmentReportMineFilters: function() {
        if (!Auth.isSuperAdmin?.()) return Promise.resolve();
        const ids = ['stats-mine-filter', 'detail-mine-filter', 'summary-mine-filter'];
        const fill = () => {
            ids.forEach(id => {
                const select = document.getElementById(id);
                if (!select) return;
                const current = select.value;
                select.innerHTML = '<option value="">全部矿山</option>' + this.cache.mines
                    .map(mine => `<option value="${mine.id}">${this.escapeHtml(mine.name)}</option>`)
                    .join('');
                if (current && this.cache.mines.some(mine => mine.id === current)) select.value = current;
            });
        };
        if (this.cache.mines.length) {
            fill();
            return Promise.resolve();
        }
        return API.mines.getAll({ limit: 1000 }).then(mines => {
            this.cache.mines = mines || [];
            fill();
        }).catch(() => {});
    },

    getEquipmentReportParams: function(prefix) {
        const params = {
            year: document.getElementById(`${prefix}-year`)?.value,
            month: document.getElementById(`${prefix}-month`)?.value
        };
        const mineId = document.getElementById(`${prefix}-mine-filter`)?.value || '';
        if (mineId) params.mine_id = mineId;
        return params;
    },

    setupEquipmentMonthly: function() {
        const now = new Date();
        ['stats-year','stats-month','detail-year','detail-month','summary-year','summary-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = id.includes('month') ? now.getMonth() + 1 : now.getFullYear();
        });
        this.populateEquipmentReportMineFilters();

        const loadStatsBtn = document.getElementById('load-equipment-stats-btn');
        const loadBtn1 = document.getElementById('load-detail-btn');
        const loadBtn2 = document.getElementById('load-summary-btn');
        const exp1 = document.getElementById('export-detail-btn');
        const exp2 = document.getElementById('export-summary-btn');

        if (loadStatsBtn) loadStatsBtn.onclick = () => {
            const params = this.getEquipmentReportParams('stats');
            const ct = document.getElementById('equipment-stats-content');
            if (ct) ct.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.dashboard.getUtilization(params).then(data => this.renderEquipmentHoursStats(ct, data)).catch(e => {
                if (ct) ct.innerHTML = '<p class="empty-message">加载失败</p>';
                this.showError('加载工时统计失败: ' + e.message);
            });
        };
        if (loadBtn1) loadBtn1.onclick = () => {
            const params = this.getEquipmentReportParams('detail');
            const ct = document.getElementById('monthly-detail-content');
            if (ct) ct.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.equipmentImport.getMonthlyDetail(params).then(data => this.renderMonthlyTable(ct, data, true)).catch(e => { if (ct) ct.innerHTML = '<p class="empty-message">加载失败</p>'; });
        };
        if (loadBtn2) loadBtn2.onclick = () => {
            const params = this.getEquipmentReportParams('summary');
            const ct = document.getElementById('monthly-summary-content');
            if (ct) ct.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.equipmentImport.getMonthlySummary(params).then(data => this.renderMonthlyTable(ct, data, false)).catch(e => { if (ct) ct.innerHTML = '<p class="empty-message">加载失败</p>'; });
        };
        if (exp1) exp1.onclick = () => API.equipmentImport.exportMonthlyDetail(this.getEquipmentReportParams('detail')).catch(e => this.showError('导出设备工作时间明细表失败'));
        if (exp2) exp2.onclick = () => API.equipmentImport.exportMonthlySummary(this.getEquipmentReportParams('summary')).catch(e => this.showError('导出设备月度汇总工时表失败'));
        if (loadStatsBtn && !loadStatsBtn.dataset.loaded) {
            loadStatsBtn.dataset.loaded = '1';
            loadStatsBtn.click();
        }
    },

    renderEquipmentHoursStats: function(container, data) {
        const totalHours = document.getElementById('eq-stat-total-hours');
        const totalFuel = document.getElementById('eq-stat-total-fuel');
        const active = document.getElementById('eq-stat-active');
        const util = document.getElementById('eq-stat-util');
        if (totalHours) totalHours.textContent = Number(data.total_hours || 0).toFixed(1);
        if (totalFuel) totalFuel.textContent = Number(data.total_fuel || 0).toFixed(1);
        if (active) active.textContent = data.active_equipment || 0;
        if (util) util.textContent = `${Number(data.avg_utilization || 0).toFixed(1)}%`;
        if (!container) return;
        const rows = data.equipments || [];
        if (!rows.length) {
            container.innerHTML = '<p class="empty-message">暂无工时统计数据</p>';
            return;
        }
        container.innerHTML = `<table class="data-table">
            <thead><tr><th>设备编号</th><th>设备名称</th><th>类型</th><th>总工时</th><th>总油耗</th><th>工作天数</th><th>利用率</th><th>日均工时</th></tr></thead>
            <tbody>
                ${rows.map(row => `<tr>
                    <td>${this.escapeHtml(row.code || '')}</td>
                    <td>${this.escapeHtml(row.name || '')}</td>
                    <td>${this.escapeHtml(row.category || '')}</td>
                    <td>${Number(row.total_hours || 0).toFixed(2)}</td>
                    <td>${Number(row.total_fuel || 0).toFixed(2)}</td>
                    <td>${row.work_days || 0}</td>
                    <td>${Number(row.utilization_rate || 0).toFixed(1)}%</td>
                    <td>${Number(row.avg_daily_hours || 0).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    },

    renderMonthlyTable: function(container, data, isDetail) {
        if (!container) return;
        if (!data || data.length === 0) { container.innerHTML = '<p class="empty-message">暂无数据</p>'; return; }
        const formatNumber = value => Number(value || 0).toFixed(2);
        const formatTime = value => {
            if (!value) return '—';
            const time = new Date(value);
            return Number.isNaN(time.getTime()) ? this.escapeHtml(String(value)) : time.toLocaleString();
        };
        const head = isDetail
            ? '<tr><th>矿山</th><th>设备代码</th><th>设备名称</th><th>日期</th><th>开始时间</th><th>结束时间</th><th>工时</th><th>状态</th><th>操作员</th><th>备注</th></tr>'
            : '<tr><th>矿山</th><th>设备代码</th><th>设备名称</th><th>月度总工时</th><th>加油升数</th><th>工作天数</th><th>工时记录数</th></tr>';
        const rows = isDetail
            ? data.map(d => `<tr>
                <td>${this.escapeHtml(d.mine_name || this.getMineName(d.mine_id) || '')}</td>
                <td>${this.escapeHtml(d.equipment_code || '')}</td>
                <td>${this.escapeHtml(d.equipment_name || '')}</td>
                <td>${this.escapeHtml(d.work_date || '')}</td>
                <td>${formatTime(d.start_time)}</td>
                <td>${formatTime(d.end_time)}</td>
                <td>${formatNumber(d.work_hours || d.duration_hours)}</td>
                <td>${this.escapeHtml(d.status || '')}</td>
                <td>${this.escapeHtml(d.operator_name || '')}</td>
                <td>${this.escapeHtml(d.remark || '')}</td>
            </tr>`).join('')
            : data.map(d => `<tr>
                <td>${this.escapeHtml(d.mine_name || this.getMineName(d.mine_id) || '')}</td>
                <td>${this.escapeHtml(d.equipment_code || '')}</td>
                <td>${this.escapeHtml(d.equipment_name || '')}</td>
                <td>${formatNumber(d.total_hours)}</td>
                <td>${formatNumber(d.total_fuel)}</td>
                <td>${d.work_days || 0}</td>
                <td>${d.session_count || 0}</td>
            </tr>`).join('');
        container.innerHTML = `<table class="data-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
    },

    // ═══════════════════════════════════════
    // SHIPPING REPORTS
    // ═══════════════════════════════════════

    setupShippingReports: function() {
        const run1 = document.getElementById('run-comparison-btn');
        const run2 = document.getElementById('run-ranking-btn');
        const run3 = document.getElementById('run-factory-stats-btn');

        if (run1) run1.onclick = () => {
            const c = document.getElementById('plate-comparison-result');
            c.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.shippingReports.plateComparison({
                start_date: document.getElementById('comparison-start-date').value,
                end_date: document.getElementById('comparison-end-date').value
            }).then(data => this.renderPlateComparison(data)).catch(e => { c.innerHTML = '<p class="empty-message">查询失败</p>'; });
        };
        if (run2) run2.onclick = () => {
            const c = document.getElementById('plate-ranking-result');
            c.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.shippingReports.plateRanking({
                year: document.getElementById('ranking-year').value,
                month: document.getElementById('ranking-month').value
            }).then(data => this.renderPlateRanking(data)).catch(e => { c.innerHTML = '<p class="empty-message">查询失败</p>'; });
        };
        if (run3) run3.onclick = () => {
            const c = document.getElementById('factory-stats-result');
            c.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.shippingReports.factoryStats({
                year: document.getElementById('factory-stats-year').value,
                month: document.getElementById('factory-stats-month').value
            }).then(data => this.renderFactoryStats(data)).catch(e => { c.innerHTML = '<p class="empty-message">查询失败</p>'; });
        };
    },

    renderPlateComparison: function(data) {
        const c = document.getElementById('plate-comparison-result');
        let html = `<p>授权车牌 ${data.total_authorized_plates || 0} 个，运输记录车牌 ${data.total_shipping_plates || 0} 个</p>`;
        html += '<div class="comparison-section unauthorized"><h4>未授权 (' + (data.unauthorized?.length||0) + ')</h4>';
        html += (data.unauthorized||[]).length === 0 ? '<p class="empty-message">无</p>' : data.unauthorized.map(p => `<div class="plate-item"><span>${p.plate_number}</span><span class="plate-count">${p.count}次</span></div>`).join('');
        html += '</div><div class="comparison-section authorized"><h4>已授权 (' + (data.authorized?.length||0) + ')</h4>';
        html += (data.authorized||[]).length === 0 ? '<p class="empty-message">无</p>' : data.authorized.map(p => `<div class="plate-item"><span>${p.plate_number}</span><span class="plate-count">${p.count}次</span></div>`).join('');
        html += '</div>';
        if ((data.unauthorized_records || []).length > 0) {
            html += '<h4 style="margin:12px 0;color:var(--err)">未授权明细</h4>';
            html += '<table class="ranking-table"><thead><tr><th>车牌号</th><th>装车时间</th><th>工厂</th><th>货物</th><th>状态</th></tr></thead><tbody>';
            html += data.unauthorized_records.map(r => `<tr><td>${this.escapeHtml(r.plate_number)}</td><td>${new Date(r.load_time).toLocaleString()}</td><td>${this.escapeHtml(r.factory_name || r.factory_id || '')}</td><td>${this.escapeHtml(r.cargo_type || '')}</td><td>未授权</td></tr>`).join('');
            html += '</tbody></table>';
        }
        c.innerHTML = html;
    },

    renderPlateRanking: function(data) {
        const c = document.getElementById('plate-ranking-result');
        if (!data.ranking?.length) { c.innerHTML = '<p class="empty-message">暂无数据</p>'; return; }
        c.innerHTML = '<table class="ranking-table"><thead><tr><th>排名</th><th>车牌号</th><th>次数</th></tr></thead><tbody>' +
            data.ranking.map((r,i) => `<tr><td>${i+1}</td><td>${r.plate_number}</td><td>${r.count}</td></tr>`).join('') + '</tbody></table>';
    },

    renderFactoryStats: function(data) {
        const c = document.getElementById('factory-stats-result');
        if (!data.factories?.length) { c.innerHTML = '<p class="empty-message">暂无数据</p>'; return; }
        c.innerHTML = '<table class="ranking-table"><thead><tr><th>工厂</th><th>次数</th></tr></thead><tbody>' +
            data.factories.map(f => `<tr><td>${f.factory_name}</td><td>${f.count}</td></tr>`).join('') + '</tbody></table>';
    },

    // ═══════════════════════════════════════
    // WORKLOGS
    // ═══════════════════════════════════════

    setupWorklogs: function() {
        const now = new Date();
        const startInput = document.getElementById('wl-start-date');
        const endInput = document.getElementById('wl-end-date');
        if (startInput && !startInput.value) startInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        if (endInput && !endInput.value) endInput.value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const filterBtn = document.getElementById('wl-filter-btn');
        if (filterBtn) filterBtn.onclick = () => {
            const params = this.getWorklogFilterParams();
            API.worklogs.getAll(params).then(wl => {
                this.renderTable('worklogs', wl);
            }).catch(e => this.showError('加载工作日志失败: ' + e.message));
        };

        const templateBtn = document.getElementById('download-worklogs-template-btn');
        const exportBtn = document.getElementById('export-worklogs-btn');
        if (templateBtn) templateBtn.onclick = () => IMPORT_EXPORT_MAP.worklogs.downloadTemplate().catch(e => this.showError('下载模板失败: ' + e.message));
        if (exportBtn) exportBtn.onclick = () => {
            const params = this.getWorklogFilterParams();
            IMPORT_EXPORT_MAP.worklogs.exportExcel(params).catch(e => this.showError('导出失败: ' + e.message));
        };
    },

    getWorklogFilterParams: function() {
        const params = { limit: 2000 };
        const s = document.getElementById('wl-start-date')?.value;
        const e = document.getElementById('wl-end-date')?.value;
        if (s) params.start_date = s;
        if (e) params.end_date = e;
        return params;
    },

    // ═══════════════════════════════════════
    // FLEET MANAGEMENT
    // ═══════════════════════════════════════

    setupFleet: function() {
        const ensureFleetVehicles = (next) => {
            if ((this.cache.fleetVehicles || []).length) { next(); return; }
            API.fleet.vehicles.getAll({ ...this.getFleetFilterParams(), limit: 1000 }).then(vehicles => {
                this.cache.fleetVehicles = vehicles;
                next();
            }).catch(e => this.showError('加载车辆档案失败: ' + e.message));
        };
        const addVehicle = () => {
            this.currentSubPage = 'fleet-vehicles';
            this.showAddModal();
        };
        const addMaintenance = () => {
            this.currentSubPage = 'fleet-maintenance';
            ensureFleetVehicles(() => this.showAddModal());
        };
        const addFuel = () => {
            this.currentSubPage = 'fleet-fuel-trips';
            ensureFleetVehicles(() => this.showAddModal());
        };
        document.getElementById('add-fleet-vehicle-btn')?.addEventListener('click', addVehicle);
        document.getElementById('add-fleet-vehicle-inline-btn')?.addEventListener('click', addVehicle);
        document.getElementById('add-fleet-maintenance-btn')?.addEventListener('click', addMaintenance);
        document.getElementById('add-fleet-fuel-btn')?.addEventListener('click', addFuel);
        const mineFilter = document.getElementById('fleet-mine-filter');
        if (mineFilter) mineFilter.onchange = () => this.loadFleet();

        const importBtn = document.getElementById('fleet-import-btn');
        const importFile = document.getElementById('fleet-import-file');
        if (importBtn && importFile) {
            importBtn.onclick = () => importFile.click();
            importFile.onchange = () => this.importFleetWorkbook(importFile);
        }

        const templateBtn = document.getElementById('fleet-template-btn');
        if (templateBtn) templateBtn.onclick = () => API.fleet.downloadTemplate().catch(e => this.showError('下载模板失败: ' + e.message));
        const exportBtn = document.getElementById('fleet-export-btn');
        if (exportBtn) exportBtn.onclick = () => API.fleet.exportWorkbook(this.getFleetFilterParams()).catch(e => this.showError('导出失败: ' + e.message));

        const compareBtn = document.getElementById('fleet-run-comparison-btn');
        if (compareBtn) compareBtn.onclick = () => this.loadFleetPlateComparison();
        const loadMonthTripsBtn = document.getElementById('fleet-load-month-trips-btn');
        if (loadMonthTripsBtn) loadMonthTripsBtn.onclick = () => this.loadFleetMonthTripSummary();
        const analyzeBtn = document.getElementById('fleet-analyze-text-btn');
        if (analyzeBtn) analyzeBtn.onclick = () => this.analyzeFleetText();
        const saveTextRecordBtn = document.getElementById('fleet-save-text-record-btn');
        if (saveTextRecordBtn) saveTextRecordBtn.onclick = () => this.saveFleetTextPlateRecord();
        this.loadFleetMonthTripSummary();
    },

    populateFleetMineFilter: function() {
        const select = document.getElementById('fleet-mine-filter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部矿山</option>' + (this.cache.mines || [])
            .map(mine => `<option value="${this.escapeAttr(mine.id)}">${this.escapeHtml(mine.name)}</option>`)
            .join('');
        if (current && (this.cache.mines || []).some(mine => mine.id === current)) select.value = current;
    },

    getFleetFilterParams: function() {
        const params = {};
        const mineId = document.getElementById('fleet-mine-filter')?.value || '';
        if (mineId) params.mine_id = mineId;
        return params;
    },

    setupFleetFormBehavior: function(type) {
        const form = document.getElementById('modal-form');
        if (!form || !String(type || '').startsWith('fleet-')) return;
        const setToday = (name) => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input && !input.value) input.value = new Date().toISOString().split('T')[0];
        };
        const num = (name) => Number(form.querySelector(`[name="${name}"]`)?.value || 0);
        const set = (name, value) => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input && Number.isFinite(value)) input.value = value ? value.toFixed(2) : '';
        };
        if (type === 'fleet-maintenance') {
            setToday('repair_date');
            const calc = () => set('amount', num('quantity') * num('unit_price'));
            ['quantity', 'unit_price'].forEach(name => form.querySelector(`[name="${name}"]`)?.addEventListener('input', calc));
            calc();
        }
        if (type === 'fleet-fuel-trips') {
            setToday('record_date');
            const calc = () => {
                set('fuel_amount', num('fuel_liters') * num('fuel_unit_price'));
            };
            ['fuel_liters', 'fuel_unit_price'].forEach(name => {
                form.querySelector(`[name="${name}"]`)?.addEventListener('input', calc);
            });
            calc();
        }
    },

    importFleetWorkbook: function(input) {
        const file = input.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        API.fleet.importWorkbook(formData, this.getFleetFilterParams()).then(result => {
            const imported = result.imported || {};
            const updated = result.updated || {};
            this.showSuccess(`导入完成：车辆 ${imported.vehicles || 0} 条，更新 ${updated.vehicles || 0} 条，维修 ${imported.maintenance || 0} 条，加油/趟数 ${imported.fuel_trips || 0} 条`);
            input.value = '';
            this.loadFleet();
        }).catch(e => {
            input.value = '';
            this.showError('导入车队表失败: ' + e.message);
        });
    },

    renderFleetDashboard: function(data) {
        document.getElementById('fleet-vehicle-count') && (document.getElementById('fleet-vehicle-count').textContent = data.vehicle_count || 0);
        document.getElementById('fleet-active-count') && (document.getElementById('fleet-active-count').textContent = data.active_vehicle_count || 0);
        document.getElementById('fleet-fuel-liters') && (document.getElementById('fleet-fuel-liters').textContent = this.formatFleetNumber(data.fuel_liters));
        document.getElementById('fleet-trip-count') && (document.getElementById('fleet-trip-count').textContent = data.trip_count || 0);

        const statusList = document.getElementById('fleet-status-list');
        if (statusList) {
            const rows = Object.entries(data.status_counts || {});
            statusList.innerHTML = rows.length
                ? rows.map(([status, count]) => `<div class="analysis-item"><span>${this.escapeHtml(status)}</span><strong>${count}</strong></div>`).join('')
                : '<p class="empty-message">暂无车辆状态</p>';
        }

        const kpis = document.getElementById('fleet-dashboard-kpis');
        if (kpis) {
            const rows = [
                ['维修总费用', this.formatFleetNumber(data.maintenance_total)],
                ['加油金额', this.formatFleetNumber(data.fuel_amount)],
                ['总加油量', this.formatFleetNumber(data.fuel_liters)],
                ['车牌比对趟数', data.trip_count || 0],
            ];
            kpis.innerHTML = rows.map(([label, value]) => `<div class="analysis-item"><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value)}</strong></div>`).join('');
        }

        const maintenanceStatus = document.getElementById('fleet-maintenance-status-list');
        if (maintenanceStatus) {
            const rows = Object.entries(data.maintenance_status_counts || {});
            maintenanceStatus.innerHTML = rows.length
                ? rows.map(([status, count]) => `<div class="analysis-item"><span>${this.escapeHtml(status)}</span><strong>${count}</strong></div>`).join('')
                : '<p class="empty-message">暂无维修记录</p>';
        }

        const partSummary = document.getElementById('fleet-part-summary');
        if (partSummary) {
            const rows = data.part_summary || [];
            partSummary.innerHTML = rows.length
                ? rows.map(item => `<div class="analysis-item"><span>${this.escapeHtml(item.name)}</span><strong>${this.formatFleetNumber(item.quantity)}</strong></div>`).join('')
                : '<p class="empty-message">暂无配件记录</p>';
        }

        const tbody = document.querySelector('#fleet-summary-table tbody');
        if (tbody) {
            const rows = data.vehicle_summary || [];
            tbody.innerHTML = rows.length
                ? rows.map(row => `<tr><td>${this.escapeHtml(row.plate_number)}</td><td>${this.formatFleetNumber(row.maintenance_amount)}</td><td>${this.formatFleetNumber(row.fuel_liters)}</td><td>${this.formatFleetNumber(row.fuel_amount)}</td><td>${row.trip_count || 0}</td></tr>`).join('')
                : '<tr><td colspan="5" class="empty-message">暂无汇总数据</td></tr>';
        }
    },

    loadFleetPlateComparison: function() {
        const result = document.getElementById('fleet-comparison-result');
        if (result) result.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
        API.fleet.plateComparison({
            ...this.getFleetFilterParams(),
            start_date: document.getElementById('fleet-comparison-start-date')?.value,
            end_date: document.getElementById('fleet-comparison-end-date')?.value
        }).then(data => {
            const entryDate = document.getElementById('fleet-trip-entry-date');
            const endDate = document.getElementById('fleet-comparison-end-date')?.value;
            if (entryDate && endDate) entryDate.value = endDate;
            this.renderFleetPlateComparison(data);
        })
            .catch(e => { if (result) result.innerHTML = `<p class="empty-message">查询失败：${this.escapeHtml(e.message)}</p>`; });
    },

    renderFleetPlateComparison: function(data) {
        const c = document.getElementById('fleet-comparison-result');
        if (!c) return;
        let html = `<p>车队档案车牌 ${data.total_authorized_plates || 0} 个，运输记录车牌 ${data.total_shipping_plates || 0} 个</p>`;
        html += '<div class="comparison-section authorized"><h4>档案车辆比对结果 (' + (data.authorized?.length || 0) + ')</h4>';
        html += (data.authorized || []).length === 0 ? '<p class="empty-message">无</p>' : data.authorized.map(p => `<div class="plate-item"><span>${this.escapeHtml(p.plate_number)}</span><span class="plate-count">${p.count}次</span></div>`).join('');
        html += '</div>';
        c.innerHTML = html;
        const dailyTable = document.querySelector('#fleet-daily-trip-table tbody');
        if (dailyTable) dailyTable.innerHTML = '<tr><td colspan="4" class="empty-message">选择日期后读取已保存的每日车牌比对</td></tr>';
    },

    buildFleetDailyTripRows: function(rows) {
        const countsByPlate = {};
        (rows || []).forEach(row => {
            const key = this.normalizePlate(row.plate_number || row.plate || '');
            if (!key) return;
            countsByPlate[key] = {
                count: Number(row.count || 0),
                vehicle_id: row.vehicle_id || '',
                plate_number: row.plate_number || row.plate || '',
                driver_name: row.driver_name || ''
            };
        });
        const vehicles = this.cache.fleetVehicles || [];
        if (!vehicles.length) return Object.values(countsByPlate);
        return vehicles.map(vehicle => {
            const key = this.normalizePlate(vehicle.plate_number || '');
            const matched = countsByPlate[key] || {};
            return {
                vehicle_id: vehicle.id,
                plate_number: vehicle.plate_number || matched.plate_number || '',
                driver_name: vehicle.driver_name || matched.driver_name || '',
                count: Number(matched.count || 0)
            };
        });
    },

    renderFleetDailyTripEntry: function(rows) {
        const tbody = document.querySelector('#fleet-daily-trip-table tbody');
        if (!tbody) return;
        const displayRows = this.buildFleetDailyTripRows(rows);
        if (!displayRows.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">请先新增车辆档案，再录入每日趟数</td></tr>';
            return;
        }
        tbody.innerHTML = displayRows.map(row => {
            const vehicle = (this.cache.fleetVehicles || []).find(v => v.id === row.vehicle_id || this.normalizePlate(v.plate_number) === this.normalizePlate(row.plate_number));
            return `<tr>
                <td>${this.escapeHtml(row.plate_number || '')}</td>
                <td>${this.escapeHtml(row.driver_name || vehicle?.driver_name || '')}</td>
                <td>${row.count || 0}</td>
                <td><span class="status-badge active">自动同步</span></td>
            </tr>`;
        }).join('');
    },

    buildFleetTripPayload: function(vehicleId, plateNumber, tripCount, recordDate) {
        const vehicle = (this.cache.fleetVehicles || []).find(v => v.id === vehicleId || this.normalizePlate(v.plate_number) === this.normalizePlate(plateNumber));
        const payload = {
            record_date: recordDate || document.getElementById('fleet-trip-entry-date')?.value || document.getElementById('fleet-comparison-end-date')?.value || new Date().toISOString().split('T')[0],
            mine_id: vehicle?.mine_id || '',
            vehicle_id: vehicle?.id || vehicleId || '',
            plate_number: plateNumber || vehicle?.plate_number || '',
            driver_name: vehicle?.driver_name || '',
            trip_count: Math.floor(tripCount),
            remark: '车牌比对每日趟数'
        };
        return this.ensureMineForPayload('fleet-fuel-trips', payload);
    },

    saveFleetDailyTrips: function() {
        const recordDate = document.getElementById('fleet-trip-entry-date')?.value || new Date().toISOString().split('T')[0];
        const saveBtn = document.getElementById('fleet-save-daily-trips-btn');
        if (saveBtn) saveBtn.disabled = true;
        const params = this.getFleetFilterParams();
        API.plateCounter.getRecord(recordDate, params).then(record => {
            const rows = (record.summary || []).map(item => ({ plate_number: item.plate, count: item.count }));
            this.renderFleetDailyTripEntry(rows);
            return API.fleet.fuelTrips.sync({ ...params, record_date: recordDate });
        }).then(result => {
            this.showSuccess(`${recordDate} 已按车牌比对同步 ${result.total_trips || 0} 趟`);
            return Promise.all([
                API.fleet.dashboard(params),
                API.fleet.fuelTrips.getAll({ ...params, limit: 1000 })
            ]);
        }).then(([dashboard, fuelTrips]) => {
            this.renderFleetDashboard(dashboard);
            this.renderTable('fleet-fuel-trips', fuelTrips);
            this.loadFleetMonthTripSummary();
        }).catch(e => this.showError(e.message.includes('404') ? `${recordDate} 尚未保存车牌比对记录` : '读取每日趟数失败: ' + e.message))
            .finally(() => { if (saveBtn) saveBtn.disabled = false; });
    },

    loadEmailSettings: function() {
        if (!Auth.isSuperAdmin?.()) { this.showError('只有超级管理员可以配置系统邮箱'); return; }
        API.emailSettings.get().then(config => {
            const form = document.getElementById('email-settings-form');
            if (!form) return;
            ['smtp_host', 'smtp_port', 'smtp_username', 'sender_email', 'sender_name'].forEach(name => {
                if (form.elements[name]) form.elements[name].value = config[name] ?? '';
            });
            form.elements.use_tls.checked = !!config.use_tls;
            form.elements.use_ssl.checked = !!config.use_ssl;
            form.elements.enabled.checked = !!config.enabled;
            const state = document.getElementById('smtp-password-state');
            if (state) state.textContent = config.password_configured ? '密码已安全保存，留空不会修改' : '尚未配置密码';
            const testRecipient = document.getElementById('email-test-recipient');
            if (testRecipient && !testRecipient.value) testRecipient.value = Auth.currentUser?.email || config.sender_email || '';
        }).catch(error => this.showError('加载邮箱配置失败: ' + error.message));
    },

    setupEmailSettings: function() {
        const save = document.getElementById('save-email-settings');
        const test = document.getElementById('test-email-settings');
        if (save) save.onclick = () => this.saveEmailSettings();
        if (test) test.onclick = () => this.testEmailSettings();
    },

    saveEmailSettings: function() {
        const form = document.getElementById('email-settings-form');
        if (!form) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.smtp_port = Number(data.smtp_port || 587);
        data.use_tls = form.elements.use_tls.checked;
        data.use_ssl = form.elements.use_ssl.checked;
        data.enabled = form.elements.enabled.checked;
        API.emailSettings.update(data).then(result => {
            this.showSuccess(result.message || '邮箱配置已保存');
            this.loadEmailSettings();
        }).catch(error => this.showError('保存邮箱配置失败: ' + error.message));
    },

    testEmailSettings: function() {
        const recipient = document.getElementById('email-test-recipient')?.value?.trim();
        if (!recipient) { this.showError('请输入测试收件邮箱'); return; }
        API.emailSettings.test({ recipient }).then(result => this.showSuccess(result.message || '测试邮件已发送'))
            .catch(error => this.showError('发送测试邮件失败: ' + error.message));
    },

    loadAccountSettings: function() {
        API.get('/auth/me').then(user => {
            Auth.updateSession(user);
            const form = document.getElementById('account-profile-form');
            if (!form) return;
            form.elements.username.value = user.username || '';
            form.elements.display_name.value = user.display_name || '';
            form.elements.email.value = user.email || '';
        }).catch(error => this.showError('加载账户资料失败: ' + error.message));
    },

    setupAccountSettings: function() {
        const profileButton = document.getElementById('save-account-profile');
        const passwordButton = document.getElementById('save-account-password');
        if (profileButton) profileButton.onclick = () => this.saveAccountProfile();
        if (passwordButton) passwordButton.onclick = () => this.saveAccountPassword();
    },

    saveAccountProfile: function() {
        const form = document.getElementById('account-profile-form');
        const button = document.getElementById('save-account-profile');
        if (!form) return;
        const data = Object.fromEntries(new FormData(form).entries());
        data.username = String(data.username || '').trim();
        data.display_name = String(data.display_name || '').trim();
        data.email = String(data.email || '').trim();
        if (!data.username || !data.display_name) { this.showError('用户名和显示名称不能为空'); return; }
        if (button) button.disabled = true;
        API.accountSettings.updateProfile(data).then(user => {
            Auth.updateSession(user);
            this.showSuccess('账户资料已保存');
            this.loadAccountSettings();
        }).catch(error => this.showError('保存账户资料失败: ' + error.message))
            .finally(() => { if (button) button.disabled = false; });
    },

    saveAccountPassword: function() {
        const form = document.getElementById('account-password-form');
        const button = document.getElementById('save-account-password');
        if (!form) return;
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.current_password) { this.showError('请输入当前密码'); return; }
        if (String(data.new_password || '').length < 6) { this.showError('新密码长度不足'); return; }
        if (data.new_password !== data.confirm_password) { this.showError('两次输入的新密码不一致'); return; }
        if (data.current_password === data.new_password) { this.showError('新密码不能与当前密码相同'); return; }
        if (button) button.disabled = true;
        API.accountSettings.changePassword({ current_password: data.current_password, new_password: data.new_password })
            .then(result => {
                form.reset();
                Auth.updateSession({ must_change_password: false });
                this.showSuccess(result.message || '密码已更新');
            }).catch(error => this.showError('修改密码失败: ' + error.message))
            .finally(() => { if (button) button.disabled = false; });
    },

    saveFleetTripPayloadsForDate: function(recordDate, payloads) {
        const query = { start_date: recordDate, end_date: recordDate, limit: 2000 };
        const queryMineId = payloads.find(item => item.mine_id)?.mine_id || this.getDefaultMineId();
        if (queryMineId) query.mine_id = queryMineId;
        return API.fleet.fuelTrips.getAll(query).then(existingRows => {
            const existingByVehicle = {};
            const existingByPlate = {};
            (existingRows || []).forEach(row => {
                if (row.vehicle_id) existingByVehicle[row.vehicle_id] = row;
                if (row.plate_number) existingByPlate[this.normalizePlate(row.plate_number)] = row;
            });
            const tasks = payloads.map(payload => {
                const existing = (payload.vehicle_id && existingByVehicle[payload.vehicle_id])
                    || existingByPlate[this.normalizePlate(payload.plate_number)];
                if (existing) return API.fleet.fuelTrips.update(existing.id, payload);
                if (payload.trip_count > 0) return API.fleet.fuelTrips.create(payload);
                return null;
            }).filter(Boolean);
            if (!tasks.length) throw new Error('请至少录入一台车辆的趟数');
            return Promise.all(tasks);
        });
    },

    saveFleetTextDailyTrips: function() {
        const daily = this.fleetTextAnalysis?.daily || [];
        if (!daily.length) {
            this.showError('当前文本没有识别到日期，请先做文本车牌统计，或手动选择日期后保存当天趟数');
            return;
        }
        const saveBtn = document.getElementById('fleet-save-text-days-btn');
        if (saveBtn) saveBtn.disabled = true;
        const tasks = daily.map(day => {
            const payloads = (day.summary || [])
                .map(item => this.buildFleetTripPayload('', item.plate, Number(item.count || 0), day.date))
                .filter(item => item.vehicle_id || item.plate_number);
            return this.saveFleetTripPayloadsForDate(day.date, payloads).then(saved => ({ date: day.date, count: saved.length }));
        });
        Promise.all(tasks).then(results => {
            const total = results.reduce((sum, item) => sum + item.count, 0);
            this.showSuccess(`已按日期保存 ${results.length} 天，共 ${total} 条车辆趟数`);
            this.loadFleet();
            this.loadFleetMonthTripSummary();
        }).catch(e => this.showError('保存识别多日趟数失败: ' + e.message))
            .finally(() => { if (saveBtn) saveBtn.disabled = false; });
    },

    loadFleetMonthTripSummary: function() {
        const container = document.getElementById('fleet-month-trip-summary');
        if (!container) return;
        const month = document.getElementById('fleet-trip-month')?.value || new Date().toISOString().slice(0, 7);
        container.innerHTML = '<p class="empty-message">汇总中...</p>';
        API.plateCounter.monthly({ ...this.getFleetFilterParams(), year_month: month }).then(data => {
            const list = data.summary || [];
            if (!list.length) {
                container.innerHTML = '<p class="empty-message">本月暂无车牌比对记录</p>';
                return;
            }
            const daily = data.daily || [];
            container.innerHTML = `<div class="fleet-month-kpis"><span>本月合计 <strong>${data.total_trips || 0}</strong> 趟</span><span>已保存 <strong>${data.saved_days || 0}</strong> 天</span><span>活跃车牌 <strong>${data.active_plate_count || 0}</strong> 个</span></div>
                <table class="ranking-table"><thead><tr><th>车牌</th><th>月度趟数</th></tr></thead><tbody>
                ${list.map(row => `<tr><td>${this.escapeHtml(row.plate)}</td><td>${row.count || 0}</td></tr>`).join('')}
                </tbody></table>
                ${daily.length ? `<h4 class="mt-20">每日保存统计</h4><table class="ranking-table"><thead><tr><th>日期</th><th>来源</th><th>总趟数</th></tr></thead><tbody>${daily.map(row => `<tr><td>${row.date}</td><td>${this.escapeHtml(row.source || '')}</td><td>${row.total_trips || 0}</td></tr>`).join('')}</tbody></table>` : ''}`;
        }).catch(e => {
            container.innerHTML = `<p class="empty-message">汇总失败：${this.escapeHtml(e.message)}</p>`;
        });
    },

    normalizePlate: function(value) {
        return String(value || '').replace(/[\s\-_.·]+/g, '').toUpperCase();
    },

    analyzeFleetText: function() {
        const text = document.getElementById('fleet-raw-text')?.value || '';
        if (!text.trim()) { this.showError('请先粘贴需要比对的文本'); return; }
        const mineId = this.getFleetFilterParams().mine_id || this.getDefaultMineId();
        API.fleet.analyzeText({
            ...(mineId ? { mine_id: mineId } : {}),
            text,
            source: document.getElementById('fleet-text-source')?.value || '车队文本录入'
        }).then(result => {
            this.renderFleetTextResult(result);
            const saveBtn = document.getElementById('fleet-save-text-record-btn');
            if (saveBtn) saveBtn.disabled = !(result?.summary || []).length;
        })
            .catch(e => this.showError('车队文本比对失败: ' + e.message));
    },

    saveFleetTextPlateRecord: function() {
        const rawText = document.getElementById('fleet-raw-text')?.value || '';
        const recordDate = document.getElementById('fleet-text-record-date')?.value;
        if (!this.fleetTextAnalysis) { this.showError('请先完成车牌比对'); return; }
        if (!rawText.trim()) { this.showError('请输入需要保存的比对文本'); return; }
        if (!recordDate) { this.showError('请选择保存日期'); return; }
        const mineId = this.getFleetFilterParams().mine_id || this.getDefaultMineId();
        const saveBtn = document.getElementById('fleet-save-text-record-btn');
        if (saveBtn) saveBtn.disabled = true;
        API.fleet.savePlateRecord({
            ...(mineId ? { mine_id: mineId } : {}),
            record_date: recordDate,
            source: document.getElementById('fleet-text-source')?.value || '车队文本录入',
            raw_text: rawText
        }).then(result => {
            const savedDays = result.saved_days || result.saved_records?.length || 1;
            const totalTrips = result.total_trips ?? result.saved_records?.reduce((sum, item) => sum + Number(item.total_trips || 0), 0) ?? 0;
            this.showSuccess(`已保存 ${savedDays} 天车牌比对数据，共 ${totalTrips} 趟`);
            this.loadFleetMonthTripSummary();
            return Promise.all([
                API.fleet.dashboard(this.getFleetFilterParams()),
                API.fleet.fuelTrips.getAll({ ...this.getFleetFilterParams(), limit: 1000 })
            ]);
        }).then(([dashboard, fuelTrips]) => {
            this.renderFleetDashboard(dashboard);
            this.renderTable('fleet-fuel-trips', fuelTrips);
        }).catch(e => this.showError('保存比对数据失败: ' + e.message))
            .finally(() => { if (saveBtn) saveBtn.disabled = false; });
    },

    renderFleetTextResult: function(result) {
        this.fleetTextAnalysis = result || null;
        const summaryBody = document.querySelector('#fleet-text-summary-table tbody');
        const detailBody = document.querySelector('#fleet-text-detail-table tbody');
        if (summaryBody) {
            const rows = result?.summary || [];
            summaryBody.innerHTML = rows.length
                ? rows.map(item => `<tr><td>${this.escapeHtml(item.plate)}</td><td>${item.count}</td></tr>`).join('')
                : '<tr><td colspan="2" class="empty-message">车辆档案暂无可比对车牌</td></tr>';
        }
        if (detailBody) {
            const rows = result?.details || [];
            detailBody.innerHTML = rows.length
                ? rows.map(item => `<tr><td>${this.escapeHtml(item.plate)}</td><td>${this.escapeHtml(item.sheet)}</td><td>${this.escapeHtml(item.row_no)}</td><td>${this.escapeHtml(item.row_text)}</td></tr>`).join('')
                : '<tr><td colspan="4" class="empty-message">暂无匹配明细</td></tr>';
        }
        this.renderFleetTextDailyList(result);
        const daily = result?.daily || [];
        const firstDay = daily[0];
        if (firstDay?.date) {
            const textDateInput = document.getElementById('fleet-text-record-date');
            if (textDateInput) textDateInput.value = firstDay.date;
            const dateInput = document.getElementById('fleet-trip-entry-date');
            if (dateInput) dateInput.value = firstDay.date;
            this.renderFleetDailyTripEntry((firstDay.summary || []).map(item => ({
                plate_number: item.plate,
                count: item.count || 0
            })));
        } else {
            this.renderFleetDailyTripEntry((result?.summary || []).map(item => ({
                plate_number: item.plate,
                count: item.count || 0
            })));
        }
    },

    renderFleetTextDailyList: function(result) {
        const container = document.getElementById('fleet-text-daily-list');
        if (!container) return;
        const daily = result?.daily || [];
        if (!daily.length) {
            container.innerHTML = '<p class="empty-message">未识别到日期：可手动选择日期后保存当前汇总。</p>';
            return;
        }
        container.innerHTML = `
            <div class="fleet-day-summary">
                <strong>识别到 ${daily.length} 天</strong>
                <span>点击日期可预览当天趟数；“保存识别多日”会逐日保存，不会覆盖整个月。</span>
            </div>
            <div class="fleet-day-chips">
                ${daily.map((day, index) => `<button type="button" class="fleet-day-chip ${index === 0 ? 'active' : ''}" data-date="${this.escapeAttr(day.date)}">${this.escapeHtml(day.label || day.date)} · ${day.total_trips || 0} 趟</button>`).join('')}
            </div>
        `;
        container.querySelectorAll('.fleet-day-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.fleet-day-chip').forEach(item => item.classList.remove('active'));
                btn.classList.add('active');
                const day = daily.find(item => item.date === btn.getAttribute('data-date'));
                if (!day) return;
                const dateInput = document.getElementById('fleet-trip-entry-date');
                if (dateInput) dateInput.value = day.date;
                this.renderFleetDailyTripEntry((day.summary || []).map(item => ({
                    plate_number: item.plate,
                    count: item.count || 0
                })));
            });
        });
    },

    // ═══════════════════════════════════════
    // PLATE COUNTER
    // ═══════════════════════════════════════

    setupPlateCounter: function() {
        const analyzeBtn = document.getElementById('pc-analyze-btn');
        const saveBtn = document.getElementById('pc-save-btn');
        const clearBtn = document.getElementById('pc-clear-btn');
        const fileInput = document.getElementById('pc-file-input');
        const monthBtn = document.getElementById('pc-load-month-btn');
        const exportMonthBtn = document.getElementById('pc-export-month-btn');
        const saveTargetsBtn = document.getElementById('pc-save-targets-btn');
        const reloadTargetsBtn = document.getElementById('pc-reload-targets-btn');
        if (analyzeBtn) analyzeBtn.onclick = () => this.analyzePlateCounterText();
        if (saveBtn) saveBtn.onclick = () => this.savePlateCounterRecord();
        if (clearBtn) clearBtn.onclick = () => {
            document.getElementById('pc-input').value = '';
            this._plateCounterResult = null;
            this.renderPlateCounterResult(null);
        };
        if (fileInput) fileInput.onchange = () => this.analyzePlateCounterFile(fileInput);
        if (monthBtn) monthBtn.onclick = () => this.loadPlateCounterMonth();
        if (exportMonthBtn) exportMonthBtn.onclick = () => {
            const yearMonth = document.getElementById('pc-month')?.value;
            if (!yearMonth) { this.showError('请选择月份'); return; }
            API.plateCounter.exportMonthly({ year_month: yearMonth }).catch(e => this.showError('导出失败: ' + e.message));
        };
        if (saveTargetsBtn) saveTargetsBtn.onclick = () => this.savePlateCounterTargets();
        if (reloadTargetsBtn) reloadTargetsBtn.onclick = () => this.loadPlateCounterTargets();
    },

    loadPlateCounterTargets: function() {
        const textarea = document.getElementById('pc-targets-text');
        API.plateCounter.getTargets().then(data => {
            if (textarea) textarea.value = (data.plates || []).join('\n');
            const count = document.getElementById('pc-target-count');
            if (count) count.textContent = (data.plates || []).length;
        }).catch(e => this.showError('加载目标车牌失败: ' + e.message));
    },

    savePlateCounterTargets: function() {
        const textarea = document.getElementById('pc-targets-text');
        const plates = (textarea?.value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
        API.plateCounter.saveTargets({ plates }).then(data => {
            this.showSuccess(`已保存 ${data.plates.length} 个目标车牌`);
            this.loadPlateCounterTargets();
        }).catch(e => this.showError('保存车牌清单失败: ' + e.message));
    },

    analyzePlateCounterText: function() {
        const text = document.getElementById('pc-input')?.value || '';
        if (!text.trim()) { this.showError('请先粘贴装车列表'); return; }
        API.plateCounter.analyze({
            text,
            source: document.getElementById('pc-source')?.value || '手工录入'
        }).then(result => {
            this._plateCounterResult = result;
            this.renderPlateCounterResult(result);
        }).catch(e => this.showError('比对失败: ' + e.message));
    },

    analyzePlateCounterFile: function(input) {
        const file = input.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        API.plateCounter.analyzeFile(formData).then(result => {
            this._plateCounterResult = result;
            document.getElementById('pc-source').value = result.source || file.name;
            if (result.raw_text) document.getElementById('pc-input').value = result.raw_text;
            this.renderPlateCounterResult(result);
            input.value = '';
        }).catch(e => this.showError('文件比对失败: ' + e.message));
    },

    savePlateCounterRecord: function() {
        const rawText = document.getElementById('pc-input')?.value || '';
        const recordDate = document.getElementById('pc-record-date')?.value;
        if (!recordDate) { this.showError('请选择统计日期'); return; }
        if (!rawText.trim()) { this.showError('请先录入装车列表'); return; }
        API.plateCounter.saveRecord({
            record_date: recordDate,
            source: document.getElementById('pc-source')?.value || '手工录入',
            raw_text: rawText
        }).then(record => {
            this.showSuccess('当天车牌统计已保存');
            this._plateCounterResult = record;
            this.renderPlateCounterResult(record);
            this.loadPlateCounterHistory();
            this.loadPlateCounterMonth();
        }).catch(e => this.showError('保存失败: ' + e.message));
    },

    renderPlateCounterResult: function(result) {
        const summaryBody = document.querySelector('#pc-summary-table tbody');
        const detailBody = document.querySelector('#pc-detail-table tbody');
        const total = document.getElementById('pc-total-trips');
        const active = document.getElementById('pc-active-plates');
        const days = document.getElementById('pc-day-count');
        const targets = document.getElementById('pc-target-count');
        if (total) total.textContent = result?.total_trips || 0;
        if (active) active.textContent = result?.active_plate_count || 0;
        if (days) days.textContent = result?.recognized_day_count || result?.day_count || 0;
        if (targets) targets.textContent = result?.target_plate_count || 0;
        if (summaryBody) {
            const rows = result?.summary || [];
            summaryBody.innerHTML = rows.length
                ? rows.map(item => `<tr><td>${this.escapeHtml(item.plate)}</td><td>${item.count}</td></tr>`).join('')
                : '<tr><td colspan="2" class="empty-message">请先开始比对</td></tr>';
        }
        if (detailBody) {
            const rows = result?.details || [];
            detailBody.innerHTML = rows.length
                ? rows.map(item => `<tr><td>${this.escapeHtml(item.record_date || '')}</td><td>${this.escapeHtml(item.plate)}</td><td>${this.escapeHtml(item.sheet)}</td><td>${this.escapeHtml(item.row_no)}</td><td>${this.escapeHtml(item.row_text)}</td></tr>`).join('')
                : '<tr><td colspan="5" class="empty-message">暂无匹配明细</td></tr>';
        }
    },

    loadPlateCounterHistory: function() {
        const tbody = document.querySelector('#pc-history-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-message">加载中...</td></tr>';
        API.plateCounter.listRecords().then(data => {
            const rows = data.items || [];
            if (!tbody) return;
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-message">暂无历史记录</td></tr>';
                return;
            }
            tbody.innerHTML = rows.map(row => `<tr>
                <td>${row.record_date}</td>
                <td>${this.escapeHtml(row.source || '')}</td>
                <td>${row.total_trips || 0}</td>
                <td>${new Date(row.saved_at).toLocaleString()}</td>
                <td class="actions">
                    <button class="action-btn pc-load-record" data-date="${row.record_date}" title="载入"><i class="fas fa-folder-open"></i></button>
                    <button class="action-btn delete pc-delete-record" data-date="${row.record_date}" title="删除"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
            tbody.querySelectorAll('.pc-load-record').forEach(btn => btn.onclick = () => this.loadPlateCounterRecord(btn.getAttribute('data-date')));
            tbody.querySelectorAll('.pc-delete-record').forEach(btn => btn.onclick = () => this.deletePlateCounterRecord(btn.getAttribute('data-date')));
        }).catch(e => this.showError('加载历史记录失败: ' + e.message));
    },

    loadPlateCounterRecord: function(recordDate) {
        API.plateCounter.getRecord(recordDate).then(record => {
            document.getElementById('pc-record-date').value = record.record_date;
            document.getElementById('pc-source').value = record.source || '手工录入';
            document.getElementById('pc-input').value = record.raw_text || '';
            this._plateCounterResult = record;
            this.renderPlateCounterResult(record);
            document.querySelector('[data-sub="pc-daily"]')?.click();
        }).catch(e => this.showError('载入记录失败: ' + e.message));
    },

    deletePlateCounterRecord: function(recordDate) {
        if (!confirm(`确定删除 ${recordDate} 的车牌统计记录吗？`)) return;
        API.plateCounter.deleteRecord(recordDate).then(() => {
            this.showSuccess('记录已删除');
            this.loadPlateCounterHistory();
            this.loadPlateCounterMonth();
        }).catch(e => this.showError('删除失败: ' + e.message));
    },

    loadPlateCounterMonth: function() {
        const yearMonth = document.getElementById('pc-month')?.value;
        if (!yearMonth) return;
        API.plateCounter.monthly({ year_month: yearMonth }).then(data => this.renderPlateCounterMonth(data))
            .catch(e => this.showError('加载月报失败: ' + e.message));
    },

    renderPlateCounterMonth: function(data) {
        const total = document.getElementById('pc-month-total');
        const days = document.getElementById('pc-month-days');
        const active = document.getElementById('pc-month-active');
        if (total) total.textContent = data.total_trips || 0;
        if (days) days.textContent = data.saved_days || 0;
        if (active) active.textContent = data.active_plate_count || 0;
        const tbody = document.querySelector('#pc-month-summary-table tbody');
        if (tbody) {
            const rows = data.summary || [];
            tbody.innerHTML = rows.length
                ? rows.map(row => `<tr><td>${this.escapeHtml(row.plate)}</td><td>${row.count}</td></tr>`).join('')
                : '<tr><td colspan="2" class="empty-message">暂无月度数据</td></tr>';
        }
        const daily = document.getElementById('pc-month-daily');
        if (daily) {
            const rows = data.daily || [];
            daily.innerHTML = rows.length
                ? '<table class="ranking-table"><thead><tr><th>日期</th><th>来源</th><th>总趟数</th></tr></thead><tbody>' +
                  rows.map(row => `<tr><td>${row.date}</td><td>${this.escapeHtml(row.source || '')}</td><td>${row.total_trips}</td></tr>`).join('') +
                  '</tbody></table>'
                : '<p class="empty-message">暂无保存日期</p>';
        }
        const chart = document.getElementById('pc-month-chart');
        if (chart) {
            if (this.charts.plateCounterMonth) this.charts.plateCounterMonth.destroy();
            chart.height = 280;
            const chartContainer = chart.closest('.chart-container');
            if (chartContainer) chartContainer.style.height = '370px';
            const top = (data.summary || []).filter(row => row.count > 0).slice(0, 15);
            this.charts.plateCounterMonth = new Chart(chart, {
                type: 'bar',
                data: {
                    labels: top.map(row => row.plate),
                    datasets: [{ label: '月度趟数', data: top.map(row => row.count), backgroundColor: '#2563eb', borderRadius: 6 }]
                },
                options: this.getDarkChartOptions()
            });
        }
    },

    // ═══════════════════════════════════════
    // EQUIPMENT HOURS
    // ═══════════════════════════════════════

    setupEquipmentHours: function() {
        const fuelDate = document.getElementById('fuel-entry-date');
        if (fuelDate && !fuelDate.value) fuelDate.value = new Date().toISOString().split('T')[0];
        const startBtn = document.getElementById('eh-start-btn');
        const manualBtn = document.getElementById('eh-manual-btn');
        const exportBtn = document.getElementById('eh-export-btn');
        const filterBtn = document.getElementById('eh-filter-btn');
        const manualRefreshBtn = document.getElementById('eh-manual-refresh-btn');
        const fuelSaveBtn = document.getElementById('fuel-save-btn');
        const fuelSelectAll = document.getElementById('fuel-select-all');
        if (startBtn) startBtn.onclick = () => this.showEquipmentHourStartModal();
        if (manualBtn) manualBtn.onclick = () => this.showEquipmentHourManualModal();
        if (exportBtn) exportBtn.onclick = () => API.equipmentHours.exportExcel(this.getEquipmentHourParams()).catch(e => this.showError('导出失败: ' + e.message));
        if (filterBtn) filterBtn.onclick = () => {
            this.refreshEquipmentHours();
            this.refreshManualEquipmentHours();
            this.loadEquipmentHoursDailyChart();
        };
        if (manualRefreshBtn) manualRefreshBtn.onclick = () => this.refreshManualEquipmentHours();
        if (fuelSaveBtn) fuelSaveBtn.onclick = () => this.saveFuelEntry();
        if (fuelSelectAll) {
            fuelSelectAll.onchange = () => {
                document.querySelectorAll('.fuel-equipment-check').forEach(cb => { cb.checked = fuelSelectAll.checked; });
            };
        }
    },

    populateEquipmentHoursFilters: function() {
        const select = document.getElementById('eh-equipment-filter');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">全部设备</option>' + this.cache.equipment.map(eq =>
            `<option value="${eq.id}">${this.escapeHtml(eq.code || '')} - ${this.escapeHtml(eq.name || '')}</option>`
        ).join('');
        select.value = current;
        this.populateFuelEquipmentPicker();
    },

    populateFuelEquipmentPicker: function() {
        const tbody = document.querySelector('#fuel-equipment-table tbody');
        if (!tbody) return;
        if (!this.cache.equipment.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">暂无设备</td></tr>';
            return;
        }
        tbody.innerHTML = this.cache.equipment.map(eq => `
            <tr>
                <td><input type="checkbox" class="fuel-equipment-check" value="${eq.id}" data-mine-id="${eq.mine_id || ''}"></td>
                <td>${this.escapeHtml(eq.code || '')}</td>
                <td>${this.escapeHtml(eq.name || '')}</td>
                <td>${this.escapeHtml(eq.category || eq.type || '')}</td>
                <td>${this.getMineName(eq.mine_id)}</td>
            </tr>
        `).join('');
    },

    saveFuelEntry: function() {
        const date = document.getElementById('fuel-entry-date')?.value;
        const fuel = Number(document.getElementById('fuel-entry-liters')?.value || 0);
        const memo = document.getElementById('fuel-entry-memo')?.value || '';
        const selected = Array.from(document.querySelectorAll('.fuel-equipment-check:checked'));
        if (!date) { this.showError('请选择加油日期'); return; }
        if (!fuel || fuel <= 0) { this.showError('请输入有效加油量'); return; }
        if (!selected.length) { this.showError('请至少选择一台设备'); return; }

        const firstMineId = selected.find(item => item.dataset.mineId)?.dataset.mineId || '';
        const payload = {
            mine_id: firstMineId || (Auth.getUserMineId ? Auth.getUserMineId() : ''),
            date,
            fuel,
            equipment_ids: selected.map(item => item.value),
            memo
        };
        API.equipment.batchFuel(payload).then(data => {
            this.showSuccess(data.message || `已保存 ${selected.length} 台设备加油记录`);
            document.getElementById('fuel-entry-liters').value = '';
            this.loadTodayWorklogs();
            this.loadEquipmentHoursDashboard();
        }).catch(e => this.showError('保存加油记录失败: ' + e.message));
    },

    getEquipmentHourParams: function() {
        const params = { page: 1, page_size: 200 };
        const start = document.getElementById('eh-start-date')?.value;
        const end = document.getElementById('eh-end-date')?.value;
        const equipmentId = document.getElementById('eh-equipment-filter')?.value;
        const status = document.getElementById('eh-status-filter')?.value;
        if (start) params.start_date = start;
        if (end) params.end_date = end;
        if (equipmentId) params.equipment_id = equipmentId;
        if (status) params.status = status;
        return params;
    },

    getManualEquipmentHourParams: function() {
        const params = this.getEquipmentHourParams();
        params.status = 'manual';
        params.page_size = 100;
        return params;
    },

    refreshEquipmentHours: function() {
        const tbody = document.querySelector('#equipment-hours-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-message">加载中...</td></tr>';
        API.equipmentHours.list(this.getEquipmentHourParams()).then(data => {
            this.renderEquipmentHoursTable(data.items || []);
            const count = document.getElementById('eh-record-count');
            if (count) count.textContent = data.total || 0;
        }).catch(e => this.showError('加载工时记录失败: ' + e.message));
    },

    refreshManualEquipmentHours: function() {
        const tbody = document.querySelector('#equipment-manual-hours-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">加载中...</td></tr>';
        API.equipmentHours.list(this.getManualEquipmentHourParams()).then(data => {
            this.renderManualEquipmentHoursTable(data.items || []);
        }).catch(e => {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-message">加载补录数据失败: ${this.escapeHtml(e.message)}</td></tr>`;
        });
    },

    renderManualEquipmentHoursTable: function(records) {
        const tbody = document.querySelector('#equipment-manual-hours-table tbody');
        if (!tbody) return;
        if (!records.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-message">暂无补录数据</td></tr>';
            return;
        }
        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${this.escapeHtml(r.operator_name || '')}</td>
                <td>${this.escapeHtml(r.equipment_code || '')}</td>
                <td>${this.escapeHtml(r.equipment_name || '')}</td>
                <td>${new Date(r.start_time).toLocaleString()}</td>
                <td>${r.end_time ? new Date(r.end_time).toLocaleString() : '-'}</td>
                <td><strong>${Number(r.duration_hours || 0).toFixed(2)}</strong></td>
                <td>${this.escapeHtml(r.remark || '')}</td>
                <td class="actions"><button class="action-btn edit eh-edit" data-id="${r.id}" title="编辑"><i class="fas fa-edit"></i></button><button class="action-btn delete eh-delete" data-id="${r.id}" title="删除"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
        tbody.querySelectorAll('.eh-edit').forEach(btn => btn.onclick = () => this.showEquipmentHourEditModal(btn.getAttribute('data-id')));
        tbody.querySelectorAll('.eh-delete').forEach(btn => btn.onclick = () => this.deleteEquipmentHour(btn.getAttribute('data-id')));
    },

    loadEquipmentHoursDashboard: function() {
        API.equipmentHours.dashboard().then(data => {
            const today = document.getElementById('eh-today-hours');
            const month = document.getElementById('eh-month-hours');
            const active = document.getElementById('eh-active-count');
            if (today) today.textContent = (data.today?.hours || 0).toFixed(1);
            if (month) month.textContent = (data.month?.hours || 0).toFixed(1);
            if (active) active.textContent = data.active?.records || 0;
        }).catch(() => {});
    },

    loadEquipmentHoursActive: function() {
        const container = document.getElementById('eh-active-list');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
        API.equipmentHours.active().then(records => {
            if (!records?.length) {
                container.innerHTML = '<p class="empty-message">当前没有进行中的设备工时</p>';
                return;
            }
            container.innerHTML = records.map(r => `
                <div class="today-wl-item">
                    <span class="wl-eq">${this.escapeHtml(r.equipment_code || '')} ${this.escapeHtml(r.equipment_name || '')}</span>
                    <span>${new Date(r.start_time).toLocaleString()}</span>
                    <button class="btn btn-danger btn-sm eh-end-active" data-id="${r.id}"><i class="fas fa-stop"></i> 结束</button>
                </div>
            `).join('');
            container.querySelectorAll('.eh-end-active').forEach(btn => {
                btn.onclick = () => this.endEquipmentHour(btn.getAttribute('data-id'));
            });
        }).catch(e => { container.innerHTML = `<p class="empty-message">加载失败: ${this.escapeHtml(e.message)}</p>`; });
    },

    loadEquipmentHoursDailyChart: function() {
        API.equipmentHours.daily({ days: 7, equipment_id: document.getElementById('eh-equipment-filter')?.value || '' }).then(data => {
            const canvas = document.getElementById('eh-daily-chart');
            if (!canvas) return;
            if (this.charts.equipmentHoursDaily) this.charts.equipmentHoursDaily.destroy();
            canvas.height = 280;
            const chartContainer = canvas.closest('.chart-container');
            if (chartContainer) chartContainer.style.height = '370px';
            this.charts.equipmentHoursDaily = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: data.map(d => d.date),
                    datasets: [{
                        label: '工时 (h)',
                        data: data.map(d => d.hours),
                        backgroundColor: '#2563eb',
                        borderRadius: 6
                    }]
                },
                options: this.getDarkChartOptions()
            });
        }).catch(() => {});
    },

    renderEquipmentHoursTable: function(records) {
        const tbody = document.querySelector('#equipment-hours-table tbody');
        if (!tbody) return;
        if (!records.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-message">暂无工时记录</td></tr>';
            return;
        }
        tbody.innerHTML = records.map(r => {
            const endBtn = r.status === 'in_progress'
                ? `<button class="action-btn eh-end" data-id="${r.id}" title="结束"><i class="fas fa-stop"></i></button>`
                : '';
            return `<tr>
                <td><input type="checkbox" class="eh-row-check" data-id="${r.id}"></td>
                <td>${this.escapeHtml(r.operator_name || '')}</td>
                <td>${this.escapeHtml(r.equipment_code || '')}</td>
                <td>${this.escapeHtml(r.equipment_name || '')}</td>
                <td>${new Date(r.start_time).toLocaleString()}</td>
                <td>${r.end_time ? new Date(r.end_time).toLocaleString() : '—'}</td>
                <td><strong>${Number(r.duration_hours || 0).toFixed(2)}</strong></td>
                <td>${this.getEquipmentHourStatusBadge(r.status)}</td>
                <td>${this.escapeHtml(r.remark || '')}</td>
                <td class="actions">${endBtn}<button class="action-btn edit eh-edit" data-id="${r.id}" title="编辑"><i class="fas fa-edit"></i></button><button class="action-btn delete eh-delete" data-id="${r.id}" title="删除"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('');
        tbody.querySelectorAll('.eh-end').forEach(btn => btn.onclick = () => this.endEquipmentHour(btn.getAttribute('data-id')));
        tbody.querySelectorAll('.eh-edit').forEach(btn => btn.onclick = () => this.showEquipmentHourEditModal(btn.getAttribute('data-id')));
        tbody.querySelectorAll('.eh-delete').forEach(btn => btn.onclick = () => this.deleteEquipmentHour(btn.getAttribute('data-id')));
        this.wireEquipmentHoursBatchDelete();
    },

    wireEquipmentHoursBatchDelete: function() {
        const selectAll = document.getElementById('eh-select-all');
        const batchBar = document.getElementById('eh-batch-actions');
        const batchCount = document.getElementById('eh-batch-count');
        const batchDeleteBtn = document.getElementById('eh-batch-delete-btn');
        const batchClearBtn = document.getElementById('eh-batch-clear-btn');
        const rowChecks = () => document.querySelectorAll('#equipment-hours-table .eh-row-check');
        const updateUI = () => {
            const checked = document.querySelectorAll('#equipment-hours-table .eh-row-check:checked');
            const count = checked.length;
            if (batchBar) batchBar.style.display = count > 0 ? '' : 'none';
            if (batchCount) batchCount.textContent = '已选 ' + count + ' 条';
            if (batchDeleteBtn) batchDeleteBtn.disabled = !count;
            if (selectAll) {
                selectAll.checked = count > 0 && count === rowChecks().length;
                selectAll.indeterminate = count > 0 && count < rowChecks().length;
            }
        };
        if (selectAll) selectAll.onchange = () => { rowChecks().forEach(c => { c.checked = selectAll.checked; }); updateUI(); };
        rowChecks().forEach(c => { c.addEventListener('change', updateUI); });
        if (batchClearBtn) batchClearBtn.onclick = () => { rowChecks().forEach(c => { c.checked = false; }); if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; } updateUI(); };
        if (batchDeleteBtn) {
            batchDeleteBtn.onclick = () => {
                const ids = Array.from(document.querySelectorAll('#equipment-hours-table .eh-row-check:checked')).map(c => c.getAttribute('data-id'));
                if (!ids.length) return;
                if (!confirm('确定要删除选中的 ' + ids.length + ' 条工时记录吗？此操作不可撤销。')) return;
                batchDeleteBtn.disabled = true;
                batchDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
                API.equipmentHours.batchDelete(ids).then(result => {
                    this.showSuccess(result.message || '已删除 ' + ids.length + ' 条记录');
                    this.loadEquipmentHours();
                }).catch(e => {
                    this.showError('批量删除失败: ' + e.message);
                    batchDeleteBtn.disabled = false;
                    batchDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> 批量删除';
                });
            };
        }
        updateUI();
    },

    getEquipmentHourStatusBadge: function(status) {
        if (status === 'in_progress') return '<span class="status-badge maintenance">工作中</span>';
        if (status === 'completed') return '<span class="status-badge active">已完成</span>';
        if (status === 'manual') return '<span class="status-badge inactive">手动补录</span>';
        return this.escapeHtml(status || '');
    },

    showEquipmentHourStartModal: function() {
        if (!this.cache.equipment.length) {
            API.equipment.getAll({ limit: 2000 }).then(eq => {
                this.cache.equipment = eq;
                this.showEquipmentHourStartModal();
            }).catch(e => this.showError('加载设备失败: ' + e.message));
            return;
        }
        const eqList = this.cache.equipment;
        const categories = [...new Set(eqList.map(e => e.category || '其他'))];
        const eqCards = eqList.map(e => {
            const cat = e.category || '其他';
            const mineName = this.getMineName(e.mine_id);
            return `
            <label class="agave-eq-card" data-category="${this.escapeAttr(cat)}" data-code="${this.escapeAttr(e.code||'')}" data-name="${this.escapeAttr(e.name||'')}">
                <input type="checkbox" class="agave-eq-check" value="${this.escapeAttr(e.id)}">
                <span class="agave-eq-dot" style="background:${cat==='挖掘机'?'#e54545':cat==='矿卡'?'#e59700':cat==='铲车'?'#0ea87a':cat==='破碎锤'?'#4f46e5':cat==='短车'?'#0a9eb8':'#96a0ad'}"></span>
                <span class="agave-eq-info">
                    <strong>${this.escapeHtml(e.code||'--')}</strong>
                    <span>${this.escapeHtml(e.name||'--')}</span>
                </span>
                <span class="agave-eq-meta">
                    <span class="agave-eq-cat">${this.escapeHtml(cat)}</span>
                    ${mineName ? `<span class="agave-eq-mine">${this.escapeHtml(mineName)}</span>` : ''}
                </span>
            </label>`;
        }).join('');
        const catFilters = categories.map(c => `<button type="button" class="agave-cat-chip" data-cat="${this.escapeAttr(c)}">${this.escapeHtml(c)}</button>`).join('');
        this.showModal(`
            <div class="modal-header agave-batch-header">
                <div>
                    <h3><i class="fas fa-play-circle"></i> 批量开始设备工时</h3>
                    <p>勾选设备后点击「开始计时」，所选设备将同时开始记录工时</p>
                </div>
                <button class="close modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body agave-batch-body">
                <div class="agave-batch-toolbar">
                    <div class="agave-batch-search">
                        <i class="fas fa-search"></i>
                        <input type="text" id="agave-eq-search" placeholder="搜索设备编号或名称..." autocomplete="off">
                    </div>
                    <div class="agave-batch-cats" id="agave-cat-chips">
                        <button type="button" class="agave-cat-chip active" data-cat="all">全部</button>
                        ${catFilters}
                    </div>
                </div>
                <div class="agave-batch-select-all">
                    <label><input type="checkbox" id="agave-select-all"> 全选 <span id="agave-selected-count" class="agave-count-badge">0</span></label>
                </div>
                <div class="agave-eq-grid" id="agave-eq-grid">${eqCards}</div>
                <div class="form-group" style="margin-top:20px">
                    <label>备注（可选）</label>
                    <textarea name="remark" class="form-control agave-remark" placeholder="例如：早班开始、夜班交接..."></textarea>
                </div>
            </div>
            <div class="modal-footer agave-batch-footer">
                <span class="agave-footer-hint" id="agave-footer-hint">未选择任何设备</span>
                <button class="btn btn-secondary modal-cancel">取消</button>
                <button class="btn btn-primary" id="eh-start-submit" disabled>
                    <i class="fas fa-play"></i> 开始计时
                </button>
            </div>
        `);
        // --- Dynamic logic ---
        const grid = document.getElementById('agave-eq-grid');
        const search = document.getElementById('agave-eq-search');
        const selectAll = document.getElementById('agave-select-all');
        const countBadge = document.getElementById('agave-selected-count');
        const footerHint = document.getElementById('agave-footer-hint');
        const submitBtn = document.getElementById('eh-start-submit');
        const checkboxes = () => grid.querySelectorAll('.agave-eq-check');
        const updateUI = () => {
            const checked = grid.querySelectorAll('.agave-eq-check:checked').length;
            countBadge.textContent = checked;
            footerHint.textContent = checked ? `已选择 ${checked} 台设备` : '未选择任何设备';
            submitBtn.disabled = !checked;
            const all = checkboxes().length;
            selectAll.checked = checked > 0 && checked === all;
            selectAll.indeterminate = checked > 0 && checked < all;
        };
        // Search filter
        if (search) search.addEventListener('input', () => {
            const q = search.value.toLowerCase();
            grid.querySelectorAll('.agave-eq-card').forEach(card => {
                const code = card.dataset.code.toLowerCase();
                const name = card.dataset.name.toLowerCase();
                card.style.display = (!q || code.includes(q) || name.includes(q)) ? '' : 'none';
            });
        });
        // Category filter
        document.getElementById('agave-cat-chips')?.addEventListener('click', e => {
            const chip = e.target.closest('.agave-cat-chip');
            if (!chip) return;
            document.querySelectorAll('#agave-cat-chips .agave-cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const cat = chip.dataset.cat;
            grid.querySelectorAll('.agave-eq-card').forEach(card => {
                card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
            });
        });
        // Select all
        if (selectAll) selectAll.addEventListener('change', () => {
            checkboxes().forEach(cb => { if (cb.closest('.agave-eq-card').style.display !== 'none') cb.checked = selectAll.checked; });
            updateUI();
        });
        // Individual checkboxes
        grid.addEventListener('change', e => {
            if (e.target.classList.contains('agave-eq-check')) {
                e.target.closest('.agave-eq-card').classList.toggle('selected', e.target.checked);
                updateUI();
            }
        });
        // Card click toggles checkbox
        grid.addEventListener('click', e => {
            const card = e.target.closest('.agave-eq-card');
            if (!card || e.target.tagName === 'INPUT') return;
            const cb = card.querySelector('.agave-eq-check');
            cb.checked = !cb.checked;
            card.classList.toggle('selected', cb.checked);
            updateUI();
        });
        // Submit
        submitBtn?.addEventListener('click', () => {
            const equipmentIds = Array.from(grid.querySelectorAll('.agave-eq-check:checked')).map(input => input.value);
            if (!equipmentIds.length) { this.showError('请至少选择一台设备'); return; }
            const remark = grid.closest('.modal-body')?.querySelector('textarea[name="remark"]')?.value || '';
            API.equipmentHours.batchStart({ equipment_ids: equipmentIds, remark }).then(result => {
                const failed = result.failed_count || 0;
                this.showSuccess(failed ? `${result.message}，${failed} 台未开始` : result.message);
                this.hideModal();
                this.loadEquipmentHours();
            }).catch(e => this.showError('开始失败: ' + e.message));
        });
        updateUI();
    },

    showEquipmentHourManualModal: function() {
        if (!this.cache.equipment.length) {
            API.equipment.getAll({ limit: 2000 }).then(eq => {
                this.cache.equipment = eq;
                this.showEquipmentHourManualModal();
            }).catch(e => this.showError('加载设备失败: ' + e.message));
            return;
        }
        this.showModal(`
            <div class="modal-header"><h3>手动补录工时</h3><button class="close modal-close"><i class="fas fa-times"></i></button></div>
            <div class="modal-body">
                <form id="eh-manual-form">
                    <div class="form-group"><label>设备</label><select name="equipment_id" class="form-control" required>${this.cache.equipment.map(e => `<option value="${e.id}">${this.escapeHtml(e.code || '')} - ${this.escapeHtml(e.name || '')}</option>`).join('')}</select></div>
                    <div class="form-group"><label>开始时间</label><input type="datetime-local" name="start_time" class="form-control" required></div>
                    <div class="form-group"><label>结束时间</label><input type="datetime-local" name="end_time" class="form-control" required></div>
                    <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                </form>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary modal-cancel">取消</button><button class="btn btn-primary" id="eh-manual-submit">保存</button></div>
        `);
        document.getElementById('eh-manual-submit')?.addEventListener('click', () => {
            const form = document.getElementById('eh-manual-form');
            const data = Object.fromEntries(new FormData(form).entries());
            if (!data.start_time || !data.end_time) {
                this.showError('请选择开始和结束时间');
                return;
            }
            API.equipmentHours.manual(data).then(() => {
                this.showSuccess('补录成功');
                this.hideModal();
                this.loadEquipmentHours();
            }).catch(e => this.showError('补录失败: ' + e.message));
        });
    },

    formatDateTimeLocal: function(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    showEquipmentHourEditModal: function(id) {
        if (!id) return;
        Promise.all([
            API.equipmentHours.getById(id),
            this.cache.equipment.length ? Promise.resolve(this.cache.equipment) : API.equipment.getAll({ limit: 2000 })
        ]).then(([record, equipment]) => {
            this.cache.equipment = equipment;
            const options = this.cache.equipment.map(e => `<option value="${e.id}" ${e.id === record.equipment_id ? 'selected' : ''}>${this.escapeHtml(e.code || '')} - ${this.escapeHtml(e.name || '')}</option>`).join('');
            this.showModal(`
                <div class="modal-header"><h3>编辑设备工时</h3><button class="close modal-close"><i class="fas fa-times"></i></button></div>
                <div class="modal-body">
                    <form id="eh-edit-form">
                        <div class="form-group"><label>设备</label><select name="equipment_id" class="form-control" required>${options}</select></div>
                        <div class="form-group"><label>开始时间</label><input type="datetime-local" name="start_time" class="form-control" value="${this.formatDateTimeLocal(record.start_time)}" required></div>
                        <div class="form-group"><label>结束时间</label><input type="datetime-local" name="end_time" class="form-control" value="${this.formatDateTimeLocal(record.end_time)}"></div>
                        <div class="form-group"><label>状态</label><select name="status" class="form-control">
                            <option value="in_progress" ${record.status === 'in_progress' ? 'selected' : ''}>工作中</option>
                            <option value="completed" ${record.status === 'completed' ? 'selected' : ''}>已完成</option>
                            <option value="manual" ${record.status === 'manual' ? 'selected' : ''}>手动补录</option>
                        </select></div>
                        <div class="form-group"><label>备注</label><textarea name="remark" class="form-control">${this.escapeHtml(record.remark || '')}</textarea></div>
                    </form>
                </div>
                <div class="modal-footer"><button class="btn btn-secondary modal-cancel">取消</button><button class="btn btn-primary" id="eh-edit-submit">保存</button></div>
            `);
            document.getElementById('eh-edit-submit')?.addEventListener('click', () => {
                const form = document.getElementById('eh-edit-form');
                const data = Object.fromEntries(new FormData(form).entries());
                if (!data.start_time) { this.showError('请选择开始时间'); return; }
                if (!data.end_time) delete data.end_time;
                API.equipmentHours.update(id, data).then(() => {
                    this.showSuccess('设备工时已更新');
                    this.hideModal();
                    this.loadEquipmentHours();
                }).catch(e => this.showError('更新失败: ' + e.message));
            });
        }).catch(e => this.showError('加载工时记录失败: ' + e.message));
    },

    endEquipmentHour: function(id) {
        if (!id || !confirm('确定结束这条设备工时记录吗？')) return;
        API.equipmentHours.end(id, {}).then(() => {
            this.showSuccess('工时记录已结束');
            this.loadEquipmentHours();
        }).catch(e => this.showError('结束失败: ' + e.message));
    },

    deleteEquipmentHour: function(id) {
        if (!id || !confirm('确定删除这条设备工时记录吗？')) return;
        API.equipmentHours.delete(id).then(() => {
            this.showSuccess('已删除');
            this.loadEquipmentHours();
        }).catch(e => this.showError('删除失败: ' + e.message));
    },

    // ═══════════════════════════════════════
    // SMART ENTRY (智能录入 — 工作日志页 & 设备页共用)
    // ═══════════════════════════════════════

    _parsedResults: [],
    _parseErrors: [],

    setupSmartEntry: function() {
        const parseBtn = document.getElementById('smart-parse-btn');
        const loadToday = document.getElementById('load-today-worklogs-btn');
        const dateInput = document.getElementById('today-worklog-date');

        if (parseBtn) parseBtn.onclick = () => this.doSmartParse();
        if (loadToday) loadToday.onclick = () => this.loadTodayWorklogs();
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];

        const checkAll = document.getElementById('parse-check-all');
        const uncheckAll = document.getElementById('parse-uncheck-all');
        const batchSave = document.getElementById('parse-batch-save');
        if (checkAll) checkAll.onclick = () => this.toggleParseChecks(true);
        if (uncheckAll) uncheckAll.onclick = () => this.toggleParseChecks(false);
        if (batchSave) batchSave.onclick = () => this.batchSaveWorklogs();
    },

    doSmartParse: async function() {
        const text = document.getElementById('smart-parse-text')?.value?.trim();
        if (!text) { this.showError('请输入设备工作日志文本'); return; }
        const preview = document.getElementById('parse-preview');
        const actions = document.getElementById('parse-batch-actions');
        if (preview) preview.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 解析中...</div>';
        if (actions) {
            actions.classList.add('hidden');
            actions.style.display = 'none';
        }

        try {
            const result = await API.equipment.smartParse({ text, parse_type: document.getElementById('smart-parse-type')?.value || 'auto' });
            this._parseErrors = result.errors || [];
            this._parsedResults = (result.records || result.results || result.items || []).map(item => {
                const validationErrors = item.validation_errors || [];
                const isValid = item.is_valid !== undefined
                    ? !!item.is_valid
                    : !!item.equipment_id && validationErrors.length === 0;
                return {
                    mine_id: item.mine_id || '',
                    equipment_id: item.equipment_id || null,
                    equipment_name: item.equipment_name || '',
                    equipment_code: item.equipment_code || item.code || '',
                    match_status: isValid ? 'matched' : (item.equipment_id ? 'invalid' : 'unmatched'),
                    method: item.method || '严格匹配',
                    confidence: item.confidence || 0,
                    work_hours: item.work_hours ?? item.duration ?? 0,
                    fuel_liters: item.fuel || 0,
                    time_detail: item.time_detail || '',
                    time_segments: item.time_segments || [],
                    work_date: item.date || item.work_date || '',
                    shift: item.shift || '',
                    line_number: item.line_number || '',
                    raw_text: item.raw_text || '',
                    memo: item.memo || '',
                    strict: !!item.strict,
                    validation_errors: validationErrors,
                    is_valid: isValid,
                    selected: isValid
                };
            });
            if (this._parsedResults.length === 0) {
                if (preview) preview.innerHTML = '<p class="empty-message">未能解析出任何设备日志</p>';
                if (actions) {
                    actions.classList.add('hidden');
                    actions.style.display = 'none';
                }
                return;
            }
            this.renderParsePreview();
        } catch (error) {
            if (preview) preview.innerHTML = `<p class="empty-message" style="color:var(--err)">解析失败: ${error.message}</p>`;
        }
    },

    renderParsePreview: function() {
        const preview = document.getElementById('parse-preview');
        const actions = document.getElementById('parse-batch-actions');
        if (!preview) return;
        const invalidRows = this._parsedResults.filter(item => !item.is_valid);
        const hasErrors = invalidRows.length > 0 || this._parseErrors.length > 0;
        if (actions) {
            actions.classList.remove('hidden');
            actions.style.display = 'flex';
        }
        const saveButton = document.getElementById('parse-batch-save');
        if (saveButton) {
            saveButton.disabled = hasErrors;
            saveButton.title = hasErrors ? '请先修正所有解析错误' : '';
        }

        const validCount = this._parsedResults.length - invalidRows.length;
        let html = `<div class="parse-validation-summary ${hasErrors ? 'has-errors' : 'is-valid'}">
            <strong>${hasErrors ? '解析未通过，已阻止保存' : '严格校验通过，可以保存'}</strong>
            <span>共 ${this._parsedResults.length} 行，准确识别 ${validCount} 行，待修正 ${invalidRows.length} 行</span>
        </div>`;
        if (this._parseErrors.length) {
            html += `<div class="parse-error-list">${this._parseErrors.map(error =>
                `<div>第 ${error.line_number || '—'} 行：${this.escapeHtml(error.error || error.message || '')}</div>`
            ).join('')}</div>`;
        }
        html += '<div class="parse-table-wrap"><table class="parse-table"><thead><tr><th><input type="checkbox" id="parse-select-all" checked></th><th>行</th><th>日期</th><th>班次</th><th>匹配设备</th><th>时间段</th><th>工时</th><th>备注</th><th>状态</th></tr></thead><tbody>';
        this._parsedResults.forEach((item, idx) => {
            const cls = item.match_status === 'matched' ? 'match-ok' : 'match-fail';
            const txt = item.is_valid ? '校验通过' : (item.validation_errors.join('；') || '设备未匹配');
            html += `<tr class="${cls}"><td><input type="checkbox" class="parse-item-check" data-idx="${idx}" ${item.selected?'checked':''} ${item.is_valid?'':'disabled'}></td>
                  <td>${item.line_number || '—'}</td><td>${this.escapeHtml(item.work_date) || '—'}</td>
                  <td>${this.escapeHtml(item.shift) || '—'}</td><td><strong>${this.escapeHtml(item.equipment_name) || '—'}</strong><small>${this.escapeHtml(item.raw_text)}</small></td>
                  <td class="parse-time-detail">${this.escapeHtml(item.time_detail) || '无工时'}</td><td>${item.work_hours || 0}</td>
                  <td class="parse-remark">${this.escapeHtml(item.memo) || '—'}</td>
                  <td><span class="parse-status">${this.escapeHtml(txt)}</span></td></tr>`;
        });
        html += '</tbody></table></div>';
        preview.innerHTML = html;

        document.getElementById('parse-select-all')?.addEventListener('change', e => {
            document.querySelectorAll('.parse-item-check:not(:disabled)').forEach(cb => { cb.checked = e.target.checked; });
            this._parsedResults.forEach(r => { if (r.is_valid) r.selected = e.target.checked; });
        });
        document.querySelectorAll('.parse-item-check').forEach(cb => cb.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            if (!isNaN(idx) && this._parsedResults[idx]) this._parsedResults[idx].selected = e.target.checked;
        });
    },

    toggleParseChecks: function(checked) {
        document.querySelectorAll('.parse-item-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
        document.getElementById('parse-select-all') && (document.getElementById('parse-select-all').checked = checked);
        this._parsedResults.forEach(r => { if (r.is_valid) r.selected = checked; });
    },

    batchSaveWorklogs: async function() {
        const invalid = this._parsedResults.filter(r => !r.is_valid);
        if (invalid.length || this._parseErrors.length) {
            this.showError('存在未通过严格校验的记录，已阻止保存');
            return;
        }
        const selected = this._parsedResults.filter(r => r.selected && r.equipment_id);
        if (selected.length === 0) { this.showError('请至少选择一条已匹配设备的解析数据'); return; }
        const payload = selected.map(s => ({
            mine_id: s.mine_id || '',
            equipment_id: s.equipment_id,
            work_date: s.work_date, work_hours: s.work_hours || 0,
            fuel_liters: s.fuel_liters || 0,
            remark: s.memo || '',
            time_detail: s.time_detail || '',
            raw_text: s.raw_text || '',
            shift: s.shift || '',
            strict_time: !!s.strict
        }));
        try {
            const result = await API.equipment.batchWorklogs(payload);
            this.showSuccess(`保存 ${result.length || selected.length} 条，已同步到设备工时`);
            this._parsedResults = [];
            this._parseErrors = [];
            document.getElementById('parse-preview') && (document.getElementById('parse-preview').innerHTML = '');
            const actions = document.getElementById('parse-batch-actions');
            if (actions) {
                actions.classList.add('hidden');
                actions.style.display = 'none';
            }
            document.getElementById('smart-parse-text') && (document.getElementById('smart-parse-text').value = '');
            this.loadTodayWorklogs();
            // 如果当前在工作日志页面，也刷新历史记录表
            if (this.currentPage === 'worklogs') {
                this.refreshWorklogTable();
            }
            if (this.currentPage === 'equipment-hours') {
                this.loadEquipmentHours();
            }
        } catch (e) { this.showError('保存失败: ' + e.message); }
    },

    loadTodayWorklogs: function() {
        const date = document.getElementById('today-worklog-date')?.value || new Date().toISOString().split('T')[0];
        const container = document.getElementById('today-worklog-list');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';

        const eqPromise = this.cache.equipment.length > 0 ? Promise.resolve() : API.equipment.getAll({ limit: 2000 }).then(eq => { this.cache.equipment = eq; });
        eqPromise.then(() => API.equipment.worklogs.getAll({ work_date: date, limit: 200 })).then(wl => {
            const countEl = document.getElementById('dashboard-today-count');
            if (countEl) countEl.textContent = wl?.length || 0;
            if (!wl?.length) { container.innerHTML = '<p class="empty-message">今日暂无日志</p>'; return; }
            container.innerHTML = wl.map(w => `
                <div class="today-wl-item">
                    <span class="wl-eq">${this.getEquipmentName(w.equipment_id)}</span>
                    <span class="wl-hours">${w.work_hours||0}h</span>
                    <span class="wl-fuel">${w.fuel_liters||0}L</span>
                    <span class="wl-remark">${this.escapeHtml(w.remark||'')}</span>
                </div>`).join('');
        }).catch(e => { container.innerHTML = '<p class="empty-message">加载失败</p>'; });
    },

    // ═══════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════

    showSuccess: function(msg) { this.showNotification(msg, 'success'); },
    showError: function(msg) { this.showNotification(msg, 'error'); },

    showNotification: function(message, type) {
        const old = document.querySelector('.toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};
