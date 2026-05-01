// ============================================================
// MineOps UI Module — New Sidebar Layout + Responsive Design
// ============================================================

const UI = {
    currentPage: 'dashboard',
    currentSubPage: null,
    currentEditId: null,

    cache: {
        mines: [],
        equipment: [],
        employees: [],
        factories: [],
        plates: []
    },

    charts: {},

    // ── Sidebar Navigation ──
    sidebarItems: [
        { page: 'dashboard',    icon: 'fas fa-gauge-high',         label: '仪表板' },
        { page: 'mines',        icon: 'fas fa-mountain',           label: '矿山管理' },
        { page: 'equipment',    icon: 'fas fa-truck-monster',      label: '设备管理' },
        { page: 'employees',    icon: 'fas fa-users',              label: '员工管理' },
        { page: 'finance',      icon: 'fas fa-coins',              label: '财务管理' },
        { page: 'shipping',     icon: 'fas fa-ship',               label: '运输管理' },
        { page: 'worklogs',     icon: 'fas fa-clipboard-list',     label: '工作日志' }
    ],

    // ── Init ──
    init: function() {
        this.buildSidebar();
        this.setupEventListeners();
        this.setupModal();
        // 等 Auth 完成认证后由 main.js 调用 onAuthReady
    },

    /** Auth 认证成功后调用 */
    onAuthReady: function() {
        this.loadPage('dashboard');
    },

    // ── Build Sidebar ──
    buildSidebar: function() {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        const userRole = Auth.getUserRole ? Auth.getUserRole() : 'mine';
        // super admin sees all; mine sub-user hides 矿山管理 and 员工管理
        const hiddenForMine = ['mines', 'employees'];

        let html = '';
        this.sidebarItems.forEach(item => {
            if (userRole !== 'super' && hiddenForMine.includes(item.page)) return;
            html += `<a class="sidebar-item" data-page="${item.page}">
                <i class="${item.icon}"></i>
                <span>${item.label}</span>
            </a>`;
        });
        nav.innerHTML = html;

        // Update user badge
        const userBadge = document.getElementById('user-role-badge');
        if (userBadge) {
            userBadge.textContent = userRole === 'super' ? '超级管理员' : '矿山用户';
            userBadge.className = userRole === 'super' ? 'badge badge-super' : 'badge badge-mine';
        }

        // delegate click
        nav.addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-item');
            if (!item) return;
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
            employees: '员工管理', finance: '财务管理', shipping: '运输管理',
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
        const api = API_MAP[apiType];
        if (!api) { this.showError('未知API模块'); return; }

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
        // fill form
        this.getEditData(tableType, id).then(data => {
            if (data) this.fillForm(data);
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
            this.loadPageData(tableType === 'plates' ? 'shipping' : tableType === 'factories' ? 'shipping' : tableType);
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
            case 'mines': return this.getCrudPageHTML('mines', '矿山');
            case 'equipment': return this.getEquipmentHTML();
            case 'employees': return this.getCrudPageHTML('employees', '员工');
            case 'finance': return this.getCrudPageHTML('finance', '财务');
            case 'shipping': return this.getShippingHTML();
            case 'worklogs': return this.getWorklogsHTML();
            default: return '<p class="empty-message">未知页面</p>';
        }
    },

    // ── Dashboard ──
    getDashboardHTML: function() {
        return `
        <!-- 统计卡片 -->
        <div class="stats-grid">
            <div class="stat-card amber">
                <div class="stat-icon stat-icon-amber"><i class="fas fa-mountain"></i></div>
                <div class="stat-info"><h3 id="mine-count">--</h3><p>矿山数量</p></div>
            </div>
            <div class="stat-card cyan">
                <div class="stat-icon stat-icon-cyan"><i class="fas fa-truck-monster"></i></div>
                <div class="stat-info"><h3 id="equipment-count">--</h3><p>设备总数</p></div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon stat-icon-green"><i class="fas fa-users"></i></div>
                <div class="stat-info"><h3 id="employee-count">--</h3><p>员工总数</p></div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon stat-icon-purple"><i class="fas fa-coins"></i></div>
                <div class="stat-info"><h3 id="finance-total">--</h3><p>财务记录</p></div>
            </div>
            <div class="stat-card blue">
                <div class="stat-icon stat-icon-blue"><i class="fas fa-clock"></i></div>
                <div class="stat-info"><h3 id="equipment-total-hours">--</h3><p>月度总工时 (h)</p></div>
            </div>
            <div class="stat-card orange">
                <div class="stat-icon stat-icon-orange"><i class="fas fa-gas-pump"></i></div>
                <div class="stat-info"><h3 id="equipment-total-fuel">--</h3><p>月度总油耗 (L)</p></div>
            </div>
        </div>
        <!-- 图表 -->
        <div class="chart-row">
            <div class="chart-container"><h3>近30天油耗趋势</h3><canvas id="fuel-trend-chart"></canvas></div>
            <div class="chart-container"><h3>财务概览</h3><div id="currency-summary"><p class="empty-message">加载中...</p></div></div>
        </div>
        <div class="chart-row mt-20">
            <div class="chart-container"><h3>支出类别分布</h3><canvas id="expense-pie-chart"></canvas></div>
            <div class="chart-container"><h3>智能录入 · 今日日志</h3>
                <div>
                    <input type="date" id="today-worklog-date" class="form-control w-150" style="display:inline;margin-bottom:12px;">
                    <div id="today-worklog-list" style="max-height:300px;overflow-y:auto;"></div>
                </div>
            </div>
        </div>
        <!-- 最近活动 -->
        <div class="recent-activity">
            <h3>最近活动</h3>
            <div id="activity-list"><p class="empty-message">暂无最近活动</p></div>
        </div>
        `;
    },

    // ── CRUD Page (mines / employees / finance) ──
    getCrudPageHTML: function(type, label) {
        const tableId = `${type}-table`;
        let cols = '';
        if (type === 'mines') cols = '<th>名称</th><th>创建时间</th><th style="width:120px">操作</th>';
        else if (type === 'employees') cols = '<th>法文名</th><th>中文名</th><th>职位</th><th>薪资</th><th>货币</th><th style="width:120px">操作</th>';
        else if (type === 'finance') cols = '<th>类型</th><th>金额</th><th>货币</th><th>类别</th><th>描述</th><th>日期</th><th style="width:120px">操作</th>';

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
            <input type="file" id="${type}-file-input" class="hidden" accept=".xlsx,.xls">
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
            <select id="equipment-type-filter" class="form-control w-150"><option value="">全部类型</option><option>挖掘机</option><option>装载机</option><option>推土机</option><option>卡车</option><option>钻机</option><option>破碎机</option><option>其他</option></select>
            <select id="equipment-status-filter" class="form-control w-130"><option value="">全部状态</option><option value="active">运行中</option><option value="inactive">闲置中</option><option value="maintenance">维修中</option></select>
        </div>
        <!-- Sub Tabs -->
        <div class="sub-tabs">
            <button class="sub-tab active" data-sub="eq-list">设备列表</button>
            <button class="sub-tab" data-sub="eq-detail">月度明细</button>
            <button class="sub-tab" data-sub="eq-summary">月度汇总</button>
        </div>
        <!-- Sub Pages -->
        <div id="eq-list" class="sub-page active">
            <div class="table-responsive table-container">
                <table class="data-table" id="equipment-table">
                    <thead><tr><th>设备代码</th><th>名称</th><th>品牌</th><th>类型</th><th>类别</th><th>短号</th><th>矿山</th><th>状态</th><th style="width:120px">操作</th></tr></thead>
                    <tbody><tr><td colspan="10" class="empty-message">加载中...</td></tr></tbody>
                </table>
            </div>
        </div>
        <div id="eq-detail" class="sub-page">
            <div class="filter-bar">
                <label>年份 <input type="number" id="detail-year" class="w-130" placeholder="2026"></label>
                <label>月份 <input type="number" id="detail-month" class="w-130" placeholder="4" min="1" max="12"></label>
                <button class="btn btn-primary btn-sm" id="load-detail-btn">查询</button>
                <button class="btn btn-secondary btn-sm" id="export-detail-btn">导出</button>
            </div>
            <div class="table-responsive table-container"><div id="monthly-detail-content" class="empty-message">请选择年月查询</div></div>
        </div>
        <div id="eq-summary" class="sub-page">
            <div class="filter-bar">
                <label>年份 <input type="number" id="summary-year" class="w-130" placeholder="2026"></label>
                <label>月份 <input type="number" id="summary-month" class="w-130" placeholder="4" min="1" max="12"></label>
                <button class="btn btn-primary btn-sm" id="load-summary-btn">查询</button>
                <button class="btn btn-secondary btn-sm" id="export-summary-btn">导出</button>
            </div>
            <div class="table-responsive table-container"><div id="monthly-summary-content" class="empty-message">请选择年月查询</div></div>
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

    // ── Worklogs Page (重构：集成智能录入) ──
    getWorklogsHTML: function() {
        return `
        <!-- 智能录入区域 -->
        <div class="smart-entry-container">
            <div class="smart-entry-left">
                <h3>📝 智能录入 · 设备工时油耗</h3>
                <textarea id="smart-parse-text" class="smart-parse-textarea" placeholder="粘贴设备工作日志...&#10;&#10;支持格式:&#10;2026-04-30&#10;400机 9小时 200L&#10;3号挖机 8h 180升&#10;C23 10.5h 250L&#10;【挖掘机】&#10;1号三一 全天 300L&#10;2号徐工 7:00-18:00 280L"></textarea>
                <div class="smart-entry-actions">
                    <select id="smart-parse-type" class="form-control w-150">
                        <option value="auto">自动识别</option>
                        <option value="whatsapp">WhatsApp消息</option>
                        <option value="natural">中文自然语言</option>
                    </select>
                    <button class="btn btn-primary" id="smart-parse-btn"><i class="fas fa-magic"></i> 智能解析</button>
                    <span class="parse-hint">支持日期头、分类头、车号、别名、中英文混合格式</span>
                </div>
                <div id="parse-preview" class="parse-preview"></div>
                <div id="parse-batch-actions" class="hidden" style="margin-top:12px;display:flex;gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="parse-check-all">全选</button>
                    <button class="btn btn-secondary btn-sm" id="parse-uncheck-all">取消全选</button>
                    <button class="btn btn-primary btn-sm" id="parse-batch-save"><i class="fas fa-save"></i> 批量保存</button>
                </div>
            </div>
            <div class="smart-entry-right">
                <h3>📋 今日日志</h3>
                <input type="date" id="today-worklog-date" class="form-control" style="margin-bottom:12px;">
                <button class="btn btn-secondary btn-sm btn-block" id="load-today-worklogs-btn">刷新</button>
                <div id="today-worklog-list" class="today-worklog-list mt-20" style="max-height:360px;overflow-y:auto;"></div>
            </div>
        </div>

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

    // ═══════════════════════════════════════
    // PAGE DATA LOADING
    // ═══════════════════════════════════════

    loadPageData: function(pageName) {
        // Reset sub-page
        this.currentSubPage = null;

        switch (pageName) {
            case 'dashboard': this.loadDashboard(); break;
            case 'mines': this.loadMines(); break;
            case 'equipment': this.loadEquipment(); break;
            case 'employees': this.loadEmployees(); break;
            case 'finance': this.loadFinance(); break;
            case 'shipping': this.loadShipping(); break;
            case 'worklogs': this.loadWorklogs(); break;
        }

        // Re-setup dynamic listeners after HTML rendered
        setTimeout(() => this.setupDynamicListeners(), 100);
    },

    setupDynamicListeners: function() {
        // 设备搜索/筛选
        this.setupEquipmentFilters();
        // 设备导入导出
        this.setupImportExport('equipment');
        this.setupImportExport('employees');
        this.setupImportExport('finance');
        this.setupImportExport('plate');
        // 设备月度统计
        this.setupEquipmentMonthly();
        // 运输报表
        this.setupShippingReports();
        // 智能录入（设备页面 + 工作日志页面共用）
        this.setupSmartEntry();
        // 工作日志
        this.setupWorklogs();
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
                const parent = tab.closest('.content-area') || document;
                parent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                parent.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
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
                } else {
                    this.currentSubPage = null;
                }
            };
        });
    },

    // ── Dashboard Data ──
    loadDashboard: function() {
        // Enhanced Quick Summary (replaces basic stats)
        API.dashboard.getQuickSummary().then(data => {
            if (data && data.equipment) {
                document.getElementById('mine-count').textContent = '—';
                document.getElementById('equipment-count').textContent = data.equipment.total || '—';
                document.getElementById('employee-count').textContent = '—';
                document.getElementById('finance-total').textContent = `活跃: ${data.equipment.active || 0}`;
            }
            if (data && data.today) {
                document.getElementById('equipment-total-hours').textContent = (data.today.total_hours || 0).toFixed(1);
                document.getElementById('equipment-total-fuel').textContent = (data.today.total_fuel || 0).toFixed(1);
            }
        }).catch(() => {
            // Fallback to original stats
            API.dashboard.getStats().then(stats => {
                document.getElementById('mine-count').textContent = stats.mineCount || '--';
                document.getElementById('equipment-count').textContent = stats.equipmentCount || '--';
                document.getElementById('employee-count').textContent = stats.employeeCount || '--';
                document.getElementById('finance-total').textContent = `$${stats.financeTotal ? stats.financeTotal.toFixed(2) : '--'}`;
            }).catch(e => console.error('仪表板统计加载失败:', e));
            API.dashboard.getEquipmentMonthlyStats().then(data => {
                document.getElementById('equipment-total-hours').textContent = (data.total_hours || 0).toFixed(1);
                document.getElementById('equipment-total-fuel').textContent = (data.total_fuel || 0).toFixed(1);
            }).catch(e => console.error('设备月度统计加载失败:', e));
        });

        // Status overview card
        API.dashboard.getStatusOverview().then(data => {
            if (data && data.status_counts) {
                const statCard = document.getElementById('employee-count');
                if (statCard) {
                    const s = data.status_counts;
                    statCard.parentElement.querySelector('p').textContent = `运行${s.working||0} 闲置${s.idle||0} 维修${s.maintenance||0}`;
                }
            }
        }).catch(() => {});

        this.loadFuelTrendChart();
        this.loadFinanceCharts();
        this.loadDashboardActivities();
        this.loadDashboardTodayWorklogs();
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

            const labels = data.map(d => d.date);
            const fuelData = data.map(d => d.total_fuel);

            this.charts.fuelTrend = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: '油耗 (升)',
                        data: fuelData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.08)',
                        fill: true,
                        tension: 0.3,
                        pointBackgroundColor: '#f59e0b',
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
            const cats = data.categories || [];
            if (cats.length === 0) return;
            const colors = ['#f59e0b','#d97706','#fbbf24','#ef4444','#f97316','#10b981','#06b6d4','#8b5cf6','#3b82f6','#ec4899'];
            this.charts.expensePie = new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: cats.map(c => c.category),
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
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#7c819a', font: { size: 12 }, padding: 16 }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#7c819a', font: { size: 10 } },
                    grid: { color: 'rgba(42,47,66,0.5)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#7c819a', font: { size: 10 } },
                    grid: { color: 'rgba(42,47,66,0.5)' }
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
        API.employees.getAll().then(employees => {
            this.cache.employees = employees;
            this.renderTable('employees', employees);
        }).catch(e => this.showError('加载员工失败: ' + e.message));
    },

    // ── Finance ──
    loadFinance: function() {
        API.finance.getAll().then(finance => {
            this.renderTable('finance', finance);
        }).catch(e => this.showError('加载财务失败: ' + e.message));
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

    renderTable: function(type, data) {
        const tableId = `${type}-table`;
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-message">暂无数据</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(item => this.getTableRow(type, item)).join('');
        this.attachTableActions(type);
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

        switch (type) {
            case 'mines':
                return `<tr><td>${this.escapeHtml(item.name)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            case 'equipment':
                return `<tr><td>${this.escapeHtml(item.code)}</td><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(item.brand)}</td><td>${this.escapeHtml(item.type)}</td><td>${this.escapeHtml(item.category)}</td><td>${this.escapeHtml(item.short_num)}</td><td>${this.getMineName(item.mine_id)}</td><td>${this.getStatusBadge(item.status)}</td>${actions}</tr>`;
            case 'employees':
                return `<tr><td>${this.escapeHtml(item.name_fr)}</td><td>${this.escapeHtml(item.name_cn)}</td><td>${this.escapeHtml(item.job)}</td><td>${item.salary || ''}</td><td>${item.currency || ''}</td>${actions}</tr>`;
            case 'finance':
                return `<tr><td>${item.trans_type === 'income' ? '收入' : '支出'}</td><td>${item.amount || ''}</td><td>${item.currency || ''}</td><td>${this.escapeHtml(item.category)}</td><td>${this.escapeHtml(item.description)}</td><td>${new Date(item.trans_date).toLocaleDateString()}</td>${actions}</tr>`;
            case 'shipping':
                return `<tr><td>${this.escapeHtml(item.plate_number)}</td><td>${new Date(item.load_time).toLocaleDateString()}</td><td>${this.getFactoryName(item.factory_id)}</td><td>${this.escapeHtml(item.cargo_type)}</td>${actions}</tr>`;
            case 'worklogs':
                return `<tr><td>${this.getEquipmentName(item.equipment_id)}</td><td>${new Date(item.work_date).toLocaleDateString()}</td><td>${item.work_hours || ''}</td><td>${item.fuel_liters || ''}</td><td>${this.escapeHtml(item.remark)}</td>${actions}</tr>`;
            case 'plates':
                return `<tr><td>${this.escapeHtml(item.plate_number)}</td><td>${this.getMineName(item.mine_id)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            case 'factories':
                return `<tr><td>${this.escapeHtml(item.name)}</td><td>${this.getMineName(item.mine_id)}</td><td>${new Date(item.created_at).toLocaleDateString()}</td>${actions}</tr>`;
            default: return '';
        }
    },

    attachTableActions: function(type) {
        const tableId = `${type}-table`;
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

    escapeHtml: function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ═══════════════════════════════════════
    // FORM FIELDS (unchanged, from original)
    // ═══════════════════════════════════════

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
                <div class="form-group"><label>类型</label><select name="type" class="form-control"><option value="挖掘机">挖掘机</option><option value="装载机">装载机</option><option value="推土机">推土机</option><option value="卡车">卡车</option><option value="钻机">钻机</option><option value="破碎机">破碎机</option><option value="其他">其他</option></select></div>
                <div class="form-group"><label>类别</label><select name="category" class="form-control"><option value="">未分类</option><option value="大车">大车</option><option value="修路">修路</option></select></div>
                <div class="form-group"><label>短号</label><input type="text" name="short_num" class="form-control" placeholder="例如：400、210"></div>
                <div class="form-group"><label>别名</label><input type="text" name="aliases" class="form-control" placeholder="逗号分隔"></div>
                <div class="form-group"><label>车号</label><input type="text" name="vehicle_num" class="form-control" placeholder="例如：C23"></div>
                ${mineField}
                <div class="form-group"><label>状态</label><select name="status" class="form-control"><option value="active">运行中</option><option value="inactive">闲置中</option><option value="maintenance">维修中</option></select></div>`; }
            case 'employees':
                return `<div class="form-group"><label>法文名</label><input type="text" name="name_fr" class="form-control" required></div>
                <div class="form-group"><label>中文名</label><input type="text" name="name_cn" class="form-control"></div>
                <div class="form-group"><label>职位</label><input type="text" name="job" class="form-control"></div>
                <div class="form-group"><label>薪资</label><input type="number" step="0.01" name="salary" class="form-control"></div>
                <div class="form-group"><label>货币</label><select name="currency" class="form-control"><option value="XOF">XOF</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>`;
            case 'finance':
                return `<div class="form-group"><label>类型</label><select name="trans_type" class="form-control"><option value="income">收入</option><option value="expense">支出</option></select></div>
                <div class="form-group"><label>金额</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
                <div class="form-group"><label>货币</label><select name="currency" class="form-control"><option value="XOF">XOF</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
                <div class="form-group"><label>类别</label><input type="text" name="category" class="form-control"></div>
                <div class="form-group"><label>描述</label><textarea name="description" class="form-control"></textarea></div>
                <div class="form-group"><label>日期</label><input type="date" name="trans_date" class="form-control" required></div>`;
            case 'shipping':
                return `<div class="form-group"><label>车牌号</label><input type="text" name="plate_number" class="form-control" required></div>
                <div class="form-group"><label>装载时间</label><input type="datetime-local" name="load_time" class="form-control" required></div>
                <div class="form-group"><label>工厂</label><select name="factory_id" class="form-control">${this.cache.factories.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>货物类型</label><input type="text" name="cargo_type" class="form-control"></div>`;
            case 'worklogs':
                return `<div class="form-group"><label>设备</label><select name="equipment_id" class="form-control">${this.cache.equipment.map(e => `<option value="${e.id}">${e.name || e.code}</option>`).join('')}</select></div>
                <div class="form-group"><label>工作日期</label><input type="date" name="work_date" class="form-control" required></div>
                <div class="form-group"><label>工作小时</label><input type="number" step="0.1" name="work_hours" class="form-control" required></div>
                <div class="form-group"><label>燃油升数</label><input type="number" step="0.1" name="fuel_liters" class="form-control"></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>`;
            case 'plates':
                return `<div class="form-group"><label>车牌号</label><input type="text" name="plate_number" class="form-control" required></div>
                <div class="form-group"><label>车辆类型</label><input type="text" name="vehicle_type" class="form-control"></div>
                <div class="form-group"><label>品牌</label><input type="text" name="brand" class="form-control"></div>
                <div class="form-group"><label>颜色</label><input type="text" name="color" class="form-control"></div>
                <div class="form-group"><label>备注</label><textarea name="remark" class="form-control"></textarea></div>
                <div class="form-group"><label>所属矿山</label><select name="mine_id" class="form-control">${this.cache.mines.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>`;
            case 'factories':
                return `<div class="form-group"><label>名称</label><input type="text" name="name" class="form-control" required></div>
                <div class="form-group"><label>所属矿山</label><select name="mine_id" class="form-control">${this.cache.mines.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>`;
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

    setupImportExport: function(type) {
        const importBtn = document.getElementById(`import-${type}-btn`);
        const exportBtn = document.getElementById(`export-${type}-btn`);
        const templateBtn = document.getElementById(`download-${type}-template-btn`);
        const fileInput = document.getElementById(`${type}-file-input`);

        if (importBtn && fileInput) {
            importBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                IMPORT_EXPORT_MAP[type].importExcel(formData).then(result => {
                    this.showSuccess(result.message || '导入成功！');
                    fileInput.value = '';
                if (type === 'employees') this.loadEmployees();
                else if (type === 'finance') this.loadFinance();
                else if (type === 'plate') this.loadPlates();
                else this.loadEquipment();
                }).catch(error => {
                    this.showError('导入失败: ' + error.message);
                    fileInput.value = '';
                });
            };
        }
        if (exportBtn) exportBtn.onclick = () => IMPORT_EXPORT_MAP[type].exportExcel().catch(e => this.showError('导出失败: ' + e.message));
        if (templateBtn) templateBtn.onclick = () => IMPORT_EXPORT_MAP[type].downloadTemplate().catch(e => this.showError('下载模板失败: ' + e.message));
    },

    // ═══════════════════════════════════════
    // EQUIPMENT MONTHLY
    // ═══════════════════════════════════════

    setupEquipmentMonthly: function() {
        const now = new Date();
        ['detail-year','detail-month','summary-year','summary-month'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = id.includes('month') ? now.getMonth() + 1 : now.getFullYear();
        });

        const loadBtn1 = document.getElementById('load-detail-btn');
        const loadBtn2 = document.getElementById('load-summary-btn');
        const exp1 = document.getElementById('export-detail-btn');
        const exp2 = document.getElementById('export-summary-btn');

        if (loadBtn1) loadBtn1.onclick = () => {
            const y = document.getElementById('detail-year').value;
            const m = document.getElementById('detail-month').value;
            const ct = document.getElementById('monthly-detail-content');
            if (ct) ct.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.equipmentImport.getMonthlyDetail({ year: y, month: m }).then(data => this.renderMonthlyTable(ct, data, true)).catch(e => { if (ct) ct.innerHTML = '<p class="empty-message">加载失败</p>'; });
        };
        if (loadBtn2) loadBtn2.onclick = () => {
            const y = document.getElementById('summary-year').value;
            const m = document.getElementById('summary-month').value;
            const ct = document.getElementById('monthly-summary-content');
            if (ct) ct.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> 加载中...</div>';
            API.equipmentImport.getMonthlySummary({ year: y, month: m }).then(data => this.renderMonthlyTable(ct, data, false)).catch(e => { if (ct) ct.innerHTML = '<p class="empty-message">加载失败</p>'; });
        };
        if (exp1) exp1.onclick = () => API.equipmentImport.exportMonthlyDetail({ year: document.getElementById('detail-year').value, month: document.getElementById('detail-month').value }).catch(e => this.showError('导出失败'));
        if (exp2) exp2.onclick = () => API.equipmentImport.exportMonthlySummary({ year: document.getElementById('summary-year').value, month: document.getElementById('summary-month').value }).catch(e => this.showError('导出失败'));
    },

    renderMonthlyTable: function(container, data, isDetail) {
        if (!container) return;
        if (!data || data.length === 0) { container.innerHTML = '<p class="empty-message">暂无数据</p>'; return; }
        const head = isDetail
            ? '<tr><th>设备代码</th><th>名称</th><th>日期</th><th>工时</th><th>油耗</th></tr>'
            : '<tr><th>设备代码</th><th>名称</th><th>总工时</th><th>总油耗</th></tr>';
        const rows = isDetail
            ? data.map(d => `<tr><td>${d.equipment_code||''}</td><td>${d.equipment_name||''}</td><td>${d.work_date||''}</td><td>${d.work_hours||0}</td><td>${d.fuel_liters||0}</td></tr>`).join('')
            : data.map(d => `<tr><td>${d.equipment_code||''}</td><td>${d.equipment_name||''}</td><td>${d.total_hours||0}</td><td>${d.total_fuel||0}</td></tr>`).join('');
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
    // SMART ENTRY (智能录入 — 工作日志页 & 设备页共用)
    // ═══════════════════════════════════════

    _parsedResults: [],

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

        try {
            const result = await API.equipment.smartParse({ text, parse_type: document.getElementById('smart-parse-type')?.value || 'auto' });
            this._parsedResults = (result.records || result.results || result.items || []).map(item => ({
                mine_id: item.mine_id || '',
                equipment_id: item.equipment_id || null,
                equipment_name: item.equipment_name || '',
                equipment_code: item.equipment_code || item.code || '',
                match_status: item.equipment_id ? 'matched' : 'unmatched',
                method: item.method || '智能匹配',
                confidence: item.confidence || 0,
                work_hours: item.work_hours || item.duration || 0,
                fuel_liters: item.fuel || 0,
                work_date: item.date || item.work_date || new Date().toISOString().split('T')[0],
                raw_text: item.raw_text || '',
                memo: item.memo || '',
                selected: !!item.equipment_id
            }));
            if (this._parsedResults.length === 0) {
                if (preview) preview.innerHTML = '<p class="empty-message">未能解析出任何设备日志</p>';
                if (actions) actions.style.display = 'none';
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
        if (actions) actions.style.display = 'flex';

        let html = '<table class="parse-table"><thead><tr><th><input type="checkbox" id="parse-select-all" checked></th><th>原始文本</th><th>匹配设备</th><th>工时</th><th>油耗</th><th>日期</th><th>状态</th></tr></thead><tbody>';
        this._parsedResults.forEach((item, idx) => {
            const cls = item.match_status === 'matched' ? 'match-ok' : 'match-fail';
            const txt = item.match_status === 'matched' ? '已匹配' : '未匹配';
            html += `<tr class="${cls}"><td><input type="checkbox" class="parse-item-check" data-idx="${idx}" ${item.selected?'checked':''}></td>
                <td>${this.escapeHtml(item.raw_text)}</td><td>${this.escapeHtml(item.equipment_name) || '—'}</td>
                <td>${item.work_hours||0}</td><td>${item.fuel_liters||0}</td>
                <td><input type="date" class="parse-item-date" data-idx="${idx}" value="${item.work_date}"></td>
                <td><span class="parse-status">${txt}</span></td></tr>`;
        });
        html += '</tbody></table>';
        preview.innerHTML = html;

        document.getElementById('parse-select-all')?.addEventListener('change', e => {
            document.querySelectorAll('.parse-item-check').forEach(cb => { cb.checked = e.target.checked; });
            this._parsedResults.forEach(r => r.selected = e.target.checked);
        });
        document.querySelectorAll('.parse-item-check').forEach(cb => cb.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            if (!isNaN(idx) && this._parsedResults[idx]) this._parsedResults[idx].selected = e.target.checked;
        });
        document.querySelectorAll('.parse-item-date').forEach(di => di.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            if (!isNaN(idx) && this._parsedResults[idx]) this._parsedResults[idx].work_date = e.target.value;
        });
    },

    toggleParseChecks: function(checked) {
        document.querySelectorAll('.parse-item-check').forEach(cb => { cb.checked = checked; });
        document.getElementById('parse-select-all') && (document.getElementById('parse-select-all').checked = checked);
        this._parsedResults.forEach(r => r.selected = checked);
    },

    batchSaveWorklogs: async function() {
        const selected = this._parsedResults.filter(r => r.selected);
        if (selected.length === 0) { this.showError('请至少选择一条'); return; }
        document.querySelectorAll('.parse-item-date').forEach(d => {
            const i = parseInt(d.getAttribute('data-idx'));
            if (!isNaN(i) && this._parsedResults[i]) this._parsedResults[i].work_date = d.value;
        });
        const payload = selected.map(s => ({
            mine_id: s.mine_id || '',
            equipment_id: s.equipment_id,
            work_date: s.work_date, work_hours: s.work_hours || 0,
            fuel_liters: s.fuel_liters || 0, remark: s.raw_text || ''
        }));
        try {
            const result = await API.equipment.batchWorklogs(payload);
            this.showSuccess(`保存 ${result.length || selected.length} 条`);
            this._parsedResults = [];
            document.getElementById('parse-preview') && (document.getElementById('parse-preview').innerHTML = '');
            document.getElementById('parse-batch-actions') && (document.getElementById('parse-batch-actions').style.display = 'none');
            document.getElementById('smart-parse-text') && (document.getElementById('smart-parse-text').value = '');
            this.loadTodayWorklogs();
            // 如果当前在工作日志页面，也刷新历史记录表
            if (this.currentPage === 'worklogs') {
                this.refreshWorklogTable();
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
