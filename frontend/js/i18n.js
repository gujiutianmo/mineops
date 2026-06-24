/**
 * MineOps 多语言模块 (i18n)
 * 支持中文(zh-CN)、英语(en-US)、法语(fr-FR) 三种语言
 * 翻译数据内嵌，无需网络请求即可切换
 */
const I18n = {
    _lang: 'zh-CN',
    _catalog: {},
    supported: ['zh-CN', 'en-US', 'fr-FR'],
    labels: { 'zh-CN': '中文', 'en-US': 'English', 'fr-FR': 'Français' },

    // ── 内嵌语言包（无需 fetch，file:// 协议也能用）──
    _bundled: {
        'zh-CN': {
            "app": {
                "title": "MineOps - 仪表板",
                "welcome": "欢迎使用 MineOps",
                "login": "登录", "logout": "退出登录",
                "dashboard": "仪表板", "mines": "矿山", "equipment": "设备",
                "employees": "员工", "finance": "财务", "shipping": "运输",
                "worklogs": "工作日志", "plates": "授权车牌", "factories": "工厂",
                "addNew": "新增", "edit": "编辑", "delete": "删除",
                "save": "保存", "cancel": "取消", "confirm": "确认",
                "loading": "加载中...", "error": "错误", "success": "成功",
                "noData": "暂无数据", "recentActivity": "最近活动", "stats": "统计"
            },
            "dashboard": {
                "mineCount": "矿山数量", "equipmentCount": "设备数量",
                "employeeCount": "员工数量", "financeTotal": "财务总额",
                "noRecentActivity": "暂无最近活动", "monthlyHours": "月度工时",
                "monthlyFuel": "月度油耗 (L)", "fuelTrend30d": "近30天油耗趋势",
                "expenseByCategory": "支出模块", "todayLogs": "今日快捷录入",
                "financeOverview": "财务概览"
            },
            "mines": { "title": "矿山管理", "name": "名称", "createdAt": "创建时间", "actions": "操作", "addMine": "添加矿山", "editMine": "编辑矿山" },
            "equipment": {
                "title": "设备管理", "code": "代码", "name": "名称", "brand": "品牌",
                "type": "类型", "category": "类别", "shortNum": "短号", "mine": "所属矿山",
                "status": "状态", "actions": "操作", "addEquipment": "添加设备",
                "editEquipment": "编辑设备", "allTypes": "全部类型", "allStatus": "全部状态",
                "active": "运行中", "inactive": "闲置", "maintenance": "维修中",
                "searchPlaceholder": "搜索代码/名称/品牌...", "eqList": "设备列表",
                "eqSmart": "快捷录入", "eqDetail": "月度明细", "eqSummary": "月度汇总",
                "import": "导入", "export": "导出", "template": "模板"
            },
            "employees": {
                "nameFr": "法文名", "nameCn": "中文名", "staffType": "人员类型",
                "staffTypeChinese": "中方人员", "staffTypeCongolese": "刚方人员",
                "job": "职位", "salary": "薪资", "currency": "货币",
                "currencyUSD": "美元 (USD)", "currencyCDF": "刚果法郎 (CDF)",
                "actions": "操作", "addEmployee": "添加员工", "editEmployee": "编辑员工",
                "title": "员工管理", "import": "导入", "export": "导出", "template": "模板"
            },
            "finance": {
                "type": "类型", "amount": "金额", "currency": "货币",
                "category": "支出明细", "description": "描述", "date": "日期",
                "actions": "操作", "income": "收入", "expense": "支出",
                "addFinance": "添加财务", "editFinance": "编辑财务", "title": "财务管理"
            },
            "shipping": {
                "plateNumber": "车牌号", "loadTime": "装载时间", "factory": "工厂",
                "cargoType": "货物类型", "actions": "操作", "title": "运输管理",
                "addShipping": "添加运输记录", "shippingList": "运输记录",
                "shippingPlates": "授权车牌", "shippingFactories": "工厂管理",
                "shippingReports": "报表", "addPlate": "添加车牌", "addFactory": "添加工厂",
                "plateComparison": "车牌对比", "plateRanking": "车牌排行",
                "factoryStats": "工厂统计", "startDate": "开始", "endDate": "结束",
                "year": "年份", "month": "月份", "query": "查询"
            },
            "worklogs": {
                "equipment": "设备", "workDate": "工作日期", "workHours": "工作小时",
                "fuelLiters": "燃油升数", "remark": "备注", "actions": "操作",
                "addWorklog": "添加工作日志", "editWorklog": "编辑工作日志", "title": "工作日志"
            },
            "plates": {
                "plateNumber": "车牌号", "vehicleType": "车辆类型", "brand": "品牌",
                "color": "颜色", "remark": "备注", "mine": "所属矿山",
                "createdAt": "创建时间", "actions": "操作",
                "addPlate": "添加车牌", "editPlate": "编辑车牌"
            },
            "factories": {
                "name": "名称", "mine": "所属矿山", "createdAt": "创建时间",
                "actions": "操作", "addFactory": "添加工厂", "editFactory": "编辑工厂"
            },
            "login": {
                "title": "登录到 MineOps", "subtitle": "矿山综合管理系统 · 刚果矿区",
                "username": "用户名", "password": "密码", "submit": "登录",
                "demoCredentials": "测试账户",
                "superAdmin": "超级管理员：admin / admin123",
                "mineManager": "矿山管理员：mineops / mineops123",
                "loginFailed": "登录失败，请重试",
                "sessionExpired": "会话已过期，请重新登录"
            },
            "modal": {
                "add": "新增 {item}", "edit": "编辑 {item}",
                "deleteConfirm": "确定要删除此项吗？此操作无法撤销。", "close": "关闭"
            },
            "language": { "chinese": "中文", "english": "English", "french": "Français" },
            "smartEntry": {
                "title": "文本解析", "parse": "智能解析",
                "parsePlaceholder": "粘贴设备工作日志...\n\n示例：\n机器400 9h 200L\n挖机3号 8h 180L\nC23 10.5h 250L",
                "parseType": "解析方式", "auto": "自动识别", "whatsapp": "WhatsApp 消息",
                "natural": "中文自然语言", "hint": "支持中文、英文、混合格式",
                "selectAll": "全选", "deselectAll": "取消全选",
                "batchSave": "批量保存", "todayLogs": "今日日志", "refresh": "刷新"
            },
            "notifications": {
                "createSuccess": "创建成功！", "updateSuccess": "更新成功！",
                "deleteSuccess": "删除成功！", "importSuccess": "导入成功！",
                "exportSuccess": "导出成功！", "operationFailed": "操作失败：{error}",
                "parseFailed": "解析失败：{error}", "batchSaveSuccess": "已保存 {count} 条记录",
                "noLogsToday": "今日暂无日志", "unknownPage": "未知页面",
                "unknownApi": "未知 API 模块"
            }
        },
        'en-US': {
            "app": {
                "title": "MineOps - Dashboard",
                "welcome": "Welcome to MineOps",
                "login": "Login", "logout": "Log Out",
                "dashboard": "Dashboard", "mines": "Mines", "equipment": "Equipment",
                "employees": "Employees", "finance": "Finance", "shipping": "Shipping",
                "worklogs": "Work Logs", "plates": "Authorized Plates", "factories": "Factories",
                "addNew": "Add New", "edit": "Edit", "delete": "Delete",
                "save": "Save", "cancel": "Cancel", "confirm": "Confirm",
                "loading": "Loading...", "error": "Error", "success": "Success",
                "noData": "No Data", "recentActivity": "Recent Activity", "stats": "Statistics"
            },
            "dashboard": {
                "mineCount": "Mine Count", "equipmentCount": "Equipment Count",
                "employeeCount": "Employee Count", "financeTotal": "Finance Total",
                "noRecentActivity": "No recent activity", "monthlyHours": "Monthly Hours",
                "monthlyFuel": "Monthly Fuel (L)", "fuelTrend30d": "Fuel Trend (30 Days)",
                "expenseByCategory": "Expense by Module", "todayLogs": "Smart Entry · Today",
                "financeOverview": "Finance Overview"
            },
            "mines": { "title": "Mine Management", "name": "Name", "createdAt": "Created At", "actions": "Actions", "addMine": "Add Mine", "editMine": "Edit Mine" },
            "equipment": {
                "title": "Equipment Management", "code": "Code", "name": "Name", "brand": "Brand",
                "type": "Type", "category": "Category", "shortNum": "Short #", "mine": "Mine",
                "status": "Status", "actions": "Actions", "addEquipment": "Add Equipment",
                "editEquipment": "Edit Equipment", "allTypes": "All Types", "allStatus": "All Status",
                "active": "Running", "inactive": "Idle", "maintenance": "Maintenance",
                "searchPlaceholder": "Search code/name/brand...", "eqList": "Equipment List",
                "eqSmart": "Smart Entry", "eqDetail": "Monthly Detail", "eqSummary": "Monthly Summary",
                "import": "Import", "export": "Export", "template": "Template"
            },
            "employees": {
                "nameFr": "French Name", "nameCn": "Chinese Name", "staffType": "Staff Type",
                "staffTypeChinese": "Chinese Staff", "staffTypeCongolese": "Congolese Staff",
                "job": "Position", "salary": "Salary", "currency": "Currency",
                "currencyUSD": "USD", "currencyCDF": "CDF",
                "actions": "Actions", "addEmployee": "Add Employee", "editEmployee": "Edit Employee",
                "title": "Employee Management", "import": "Import", "export": "Export", "template": "Template"
            },
            "finance": {
                "type": "Type", "amount": "Amount", "currency": "Currency",
                "category": "Expense Detail", "description": "Description", "date": "Date",
                "actions": "Actions", "income": "Income", "expense": "Expense",
                "addFinance": "Add Finance", "editFinance": "Edit Finance", "title": "Finance Management"
            },
            "shipping": {
                "plateNumber": "Plate #", "loadTime": "Load Time", "factory": "Factory",
                "cargoType": "Cargo Type", "actions": "Actions", "title": "Shipping Management",
                "addShipping": "Add Shipping Record", "shippingList": "Shipping Records",
                "shippingPlates": "Authorized Plates", "shippingFactories": "Factory Mgmt",
                "shippingReports": "Reports", "addPlate": "Add Plate", "addFactory": "Add Factory",
                "plateComparison": "Plate Comparison", "plateRanking": "Plate Ranking",
                "factoryStats": "Factory Statistics", "startDate": "Start", "endDate": "End",
                "year": "Year", "month": "Month", "query": "Query"
            },
            "worklogs": {
                "equipment": "Equipment", "workDate": "Work Date", "workHours": "Work Hours",
                "fuelLiters": "Fuel Liters", "remark": "Remark", "actions": "Actions",
                "addWorklog": "Add Worklog", "editWorklog": "Edit Worklog", "title": "Work Logs"
            },
            "plates": {
                "plateNumber": "Plate #", "vehicleType": "Vehicle Type", "brand": "Brand",
                "color": "Color", "remark": "Remark", "mine": "Mine", "createdAt": "Created At",
                "actions": "Actions", "addPlate": "Add Plate", "editPlate": "Edit Plate"
            },
            "factories": {
                "name": "Name", "mine": "Mine", "createdAt": "Created At",
                "actions": "Actions", "addFactory": "Add Factory", "editFactory": "Edit Factory"
            },
            "login": {
                "title": "Login to MineOps", "subtitle": "Mine Management System · Congo",
                "username": "Username", "password": "Password", "submit": "Login",
                "demoCredentials": "Test Accounts",
                "superAdmin": "Super Admin: admin / admin123",
                "mineManager": "Mine Manager: mineops / mineops123",
                "loginFailed": "Login failed, please try again",
                "sessionExpired": "Session expired, please login again"
            },
            "modal": {
                "add": "Add {item}", "edit": "Edit {item}",
                "deleteConfirm": "Are you sure you want to delete this item?", "close": "Close"
            },
            "language": { "chinese": "中文", "english": "English", "french": "Français" },
            "smartEntry": {
                "title": "Text Parsing", "parse": "Smart Parse",
                "parsePlaceholder": "Paste equipment work logs...\n\nExample:\nMachine 400 9h 200L\nExcavator #3 8h 180L\nC23 10.5h 250L",
                "parseType": "Parse Type", "auto": "Auto Detect",
                "whatsapp": "WhatsApp Message", "natural": "Chinese Natural Language",
                "hint": "Supports Chinese, English, mixed format",
                "selectAll": "Select All", "deselectAll": "Deselect All",
                "batchSave": "Batch Save", "todayLogs": "Today's Logs", "refresh": "Refresh"
            },
            "notifications": {
                "createSuccess": "Created successfully!",
                "updateSuccess": "Updated successfully!",
                "deleteSuccess": "Deleted successfully!",
                "importSuccess": "Import successful!",
                "exportSuccess": "Export successful!",
                "operationFailed": "Operation failed: {error}",
                "parseFailed": "Parse failed: {error}",
                "batchSaveSuccess": "Saved {count} records",
                "noLogsToday": "No logs today",
                "unknownPage": "Unknown page",
                "unknownApi": "Unknown API module"
            }
        },
        'fr-FR': {
            "app": {
                "title": "MineOps - Tableau de Bord",
                "welcome": "Bienvenue sur MineOps",
                "login": "Connexion", "logout": "Déconnexion",
                "dashboard": "Tableau de Bord", "mines": "Mines", "equipment": "Équipement",
                "employees": "Employés", "finance": "Finances", "shipping": "Transport",
                "worklogs": "Journaux", "plates": "Plaques Autorisées", "factories": "Usines",
                "addNew": "Ajouter", "edit": "Modifier", "delete": "Supprimer",
                "save": "Enregistrer", "cancel": "Annuler", "confirm": "Confirmer",
                "loading": "Chargement...", "error": "Erreur", "success": "Succès",
                "noData": "Aucune donnée", "recentActivity": "Activité Récente", "stats": "Statistiques"
            },
            "dashboard": {
                "mineCount": "Nombre de Mines", "equipmentCount": "Nombre d'Équipements",
                "employeeCount": "Nombre d'Employés", "financeTotal": "Total Financier",
                "noRecentActivity": "Aucune activité récente", "monthlyHours": "Heures Mensuelles",
                "monthlyFuel": "Carburant Mensuel (L)", "fuelTrend30d": "Tendance Carburant (30j)",
                "expenseByCategory": "Dépenses par module", "todayLogs": "Saisie Rapide · Jour",
                "financeOverview": "Aperçu Financier"
            },
            "mines": { "title": "Gestion des Mines", "name": "Nom", "createdAt": "Créé le", "actions": "Actions", "addMine": "Ajouter une Mine", "editMine": "Modifier la Mine" },
            "equipment": {
                "title": "Gestion des Équipements", "code": "Code", "name": "Nom", "brand": "Marque",
                "type": "Type", "category": "Catégorie", "shortNum": "No Court", "mine": "Mine",
                "status": "Statut", "actions": "Actions", "addEquipment": "Ajouter Équipement",
                "editEquipment": "Modifier Équipement", "allTypes": "Tous Types", "allStatus": "Tous Statuts",
                "active": "En Marche", "inactive": "Arrêté", "maintenance": "Maintenance",
                "searchPlaceholder": "Rechercher code/nom/marque...", "eqList": "Liste Équipements",
                "eqSmart": "Saisie Rapide", "eqDetail": "Détail Mensuel", "eqSummary": "Résumé Mensuel",
                "import": "Importer", "export": "Exporter", "template": "Modèle"
            },
            "employees": {
                "nameFr": "Nom Français", "nameCn": "Nom Chinois", "staffType": "Type Personnel",
                "staffTypeChinese": "Personnel Chinois", "staffTypeCongolese": "Personnel Congolais",
                "job": "Poste", "salary": "Salaire", "currency": "Devise",
                "currencyUSD": "USD", "currencyCDF": "CDF",
                "actions": "Actions", "addEmployee": "Ajouter Employé", "editEmployee": "Modifier Employé",
                "title": "Gestion des Employés", "import": "Importer", "export": "Exporter", "template": "Modèle"
            },
            "finance": {
                "type": "Type", "amount": "Montant", "currency": "Devise",
                "category": "Détail dépense", "description": "Description", "date": "Date",
                "actions": "Actions", "income": "Revenu", "expense": "Dépense",
                "addFinance": "Ajouter Transaction", "editFinance": "Modifier Transaction", "title": "Gestion Financière"
            },
            "shipping": {
                "plateNumber": "Plaque No", "loadTime": "Heure Chargement", "factory": "Usine",
                "cargoType": "Type Cargaison", "actions": "Actions", "title": "Gestion Transport",
                "addShipping": "Ajouter Transport", "shippingList": "Registres Transport",
                "shippingPlates": "Plaques Autorisées", "shippingFactories": "Gestion Usines",
                "shippingReports": "Rapports", "addPlate": "Ajouter Plaque", "addFactory": "Ajouter Usine",
                "plateComparison": "Comparaison Plaques", "plateRanking": "Classement Plaques",
                "factoryStats": "Statistiques Usines", "startDate": "Début", "endDate": "Fin",
                "year": "Année", "month": "Mois", "query": "Rechercher"
            },
            "worklogs": {
                "equipment": "Équipement", "workDate": "Date Travail", "workHours": "Heures Travail",
                "fuelLiters": "Litres Carburant", "remark": "Remarque", "actions": "Actions",
                "addWorklog": "Ajouter Journal", "editWorklog": "Modifier Journal", "title": "Journaux de Travail"
            },
            "plates": {
                "plateNumber": "Plaque No", "vehicleType": "Type Véhicule", "brand": "Marque",
                "color": "Couleur", "remark": "Remarque", "mine": "Mine", "createdAt": "Créé le",
                "actions": "Actions", "addPlate": "Ajouter Plaque", "editPlate": "Modifier Plaque"
            },
            "factories": {
                "name": "Nom", "mine": "Mine", "createdAt": "Créé le",
                "actions": "Actions", "addFactory": "Ajouter Usine", "editFactory": "Modifier Usine"
            },
            "login": {
                "title": "Connexion à MineOps", "subtitle": "Système Gestion Minière · Congo",
                "username": "Nom d'utilisateur", "password": "Mot de passe",
                "submit": "Connexion", "demoCredentials": "Comptes Test",
                "superAdmin": "Super Admin: admin / admin123",
                "mineManager": "Chef Mine: mineops / mineops123",
                "loginFailed": "Échec de connexion, veuillez réessayer",
                "sessionExpired": "Session expirée, veuillez vous reconnecter"
            },
            "modal": {
                "add": "Ajouter {item}", "edit": "Modifier {item}",
                "deleteConfirm": "Êtes-vous sûr de vouloir supprimer cet élément ?", "close": "Fermer"
            },
            "language": { "chinese": "中文", "english": "English", "french": "Français" },
            "smartEntry": {
                "title": "Analyse de Texte", "parse": "Analyse Intelligente",
                "parsePlaceholder": "Collez les journaux d'équipement...\n\nExemple:\nMachine 400 9h 200L\nExcavateur #3 8h 180L\nC23 10.5h 250L",
                "parseType": "Type Analyse", "auto": "Détection Auto",
                "whatsapp": "Message WhatsApp", "natural": "Langage Naturel",
                "hint": "Prend en charge le chinois, l'anglais, format mixte",
                "selectAll": "Tout Sélectionner", "deselectAll": "Tout Désélectionner",
                "batchSave": "Sauvegarde Groupée", "todayLogs": "Journaux du Jour", "refresh": "Actualiser"
            },
            "notifications": {
                "createSuccess": "Créé avec succès !",
                "updateSuccess": "Mis à jour avec succès !",
                "deleteSuccess": "Supprimé avec succès !",
                "importSuccess": "Importation réussie !",
                "exportSuccess": "Exportation réussie !",
                "operationFailed": "Opération échouée : {error}",
                "parseFailed": "Analyse échouée : {error}",
                "batchSaveSuccess": "{count} enregistrements sauvegardés",
                "noLogsToday": "Aucun journal aujourd'hui",
                "unknownPage": "Page inconnue",
                "unknownApi": "Module API inconnu"
            }
        }
    },

    // ── 预加载内嵌语言包到 _catalog ──
    _preloadBundled: function () {
        for (const lang of this.supported) {
            if (this._bundled[lang]) {
                this._catalog[lang] = this._bundled[lang];
            }
        }
    },

    // ── 初始化（同步，无需 fetch）──
    init: function () {
        const saved = localStorage.getItem('mineops_lang');
        if (saved && this.supported.includes(saved)) {
            this._lang = saved;
        }
        // 预加载内嵌语言包
        this._preloadBundled();
        // 绑定语言切换按钮
        this._bindSwitcher();
        // 应用翻译
        this.applyAll();
    },

    // ── 绑定语言切换按钮 ──
    _bindSwitcher: function () {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.getAttribute('data-i18n-bound') === '1') return;
            btn.setAttribute('data-i18n-bound', '1');
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                if (lang) this.switchLang(lang);
            });
        });
    },

    // ── 同步切换语言 ──
    switchLang: function (lang) {
        if (!this.supported.includes(lang)) return;
        if (!this._catalog[lang]) {
            console.error('[I18n] 语言包未加载:', lang);
            return;
        }
        this._lang = lang;
        localStorage.setItem('mineops_lang', this._lang);
        this.applyAll();
    },

    // ── 翻译函数 ──
    t: function (key, params) {
        params = params || {};
        const keys = key.split('.');
        let catalog = this._catalog[this._lang] || this._catalog['en-US'];

        let value = catalog;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn('[I18n] 翻译键缺失:', key, '语言:', this._lang);
                return key;
            }
        }

        if (typeof value === 'string') {
            return value.replace(/\{(\w+)\}/g, function (_, k) {
                return params[k] !== undefined ? String(params[k]) : '{' + k + '}';
            });
        }
        return value;
    },

    // ── 全局应用翻译 ──
    applyAll: function () {
        document.title = this.t('app.title');
        document.documentElement.lang = this._lang;
        this._updateSwitcherActive();
        this._updateLoginForm();
        this._updateNavigation();
        this._updatePageTitles();
        this._updateUIElements();
        this._updateTableHeaders();
    },

    // ── 更新语言切换按钮高亮 ──
    _updateSwitcherActive: function () {
        document.querySelectorAll('.lang-btn').forEach(function (btn) {
            var lang = btn.getAttribute('data-lang');
            if (lang === I18n._lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    // ── 更新登录表单 ──
    _updateLoginForm: function () {
        var overlay = document.getElementById('login-overlay');
        if (!overlay) return;
        var subtitle = overlay.querySelector('p');
        if (subtitle) subtitle.textContent = this.t('login.subtitle');
        var usernameLabel = overlay.querySelector('label[for="login-username"]');
        if (usernameLabel) usernameLabel.textContent = this.t('login.username');
        var passwordLabel = overlay.querySelector('label[for="login-password"]');
        if (passwordLabel) passwordLabel.textContent = this.t('login.password');
        var submitBtn = overlay.querySelector('#login-submit');
        if (submitBtn) submitBtn.textContent = this.t('login.submit');
        var hint = overlay.querySelector('.login-hint');
        if (hint) {
            var ps = hint.querySelectorAll('p');
            if (ps.length >= 3) {
                ps[0].textContent = this.t('login.demoCredentials');
                ps[1].textContent = this.t('login.superAdmin');
                ps[2].textContent = this.t('login.mineManager');
            }
        }
    },

    // ── 更新侧边栏导航 ──
    _updateNavigation: function () {
        var navMap = {
            dashboard: this.t('app.dashboard'),
            mines: this.t('app.mines'),
            equipment: this.t('app.equipment'),
            employees: this.t('app.employees'),
            finance: this.t('app.finance'),
            shipping: this.t('app.shipping'),
            worklogs: this.t('app.worklogs'),
            plates: this.t('app.plates'),
            factories: this.t('app.factories')
        };
        document.querySelectorAll('.nav-link').forEach(function (link) {
            var page = link.getAttribute('data-page');
            if (page && navMap[page]) {
                var icon = link.querySelector('i');
                var iconClone = icon ? icon.cloneNode(true) : null;
                link.innerHTML = '';
                if (iconClone) link.appendChild(iconClone);
                link.appendChild(document.createTextNode(' ' + navMap[page]));
            }
        });
    },

    // ── 更新页面标题 ──
    _updatePageTitles: function () {
        var title = document.getElementById('page-title');
        if (title && UI.currentPage) {
            title.textContent = this.t('app.' + UI.currentPage);
        }
    },

    // ── 更新通用 UI 元素 ──
    _updateUIElements: function () {
        var statLabels = document.querySelectorAll('.stat-info p');
        if (statLabels.length >= 4) {
            statLabels[0].textContent = this.t('dashboard.mineCount');
            statLabels[1].textContent = this.t('dashboard.equipmentCount');
            statLabels[2].textContent = this.t('dashboard.employeeCount');
            statLabels[3].textContent = this.t('dashboard.financeTotal');
        }
        var recentTitle = document.querySelector('.recent-activity h3');
        if (recentTitle) recentTitle.textContent = this.t('app.recentActivity');
    },

    // ── 更新表格表头 ──
    _updateTableHeaders: function () {
        var headersMap = {
            'mines-table': ['mines.name', 'mines.createdAt', 'mines.actions'],
            'equipment-table': ['equipment.code', 'equipment.name', 'equipment.brand', 'equipment.type', 'equipment.mine', 'equipment.actions'],
            'employees-table': ['employees.nameFr', 'employees.nameCn', 'employees.job', 'employees.salary', 'employees.currency', 'employees.actions'],
            'finance-table': ['finance.type', 'finance.amount', 'finance.currency', 'finance.category', 'finance.date', 'finance.actions'],
            'shipping-table': ['shipping.plateNumber', 'shipping.loadTime', 'shipping.factory', 'shipping.cargoType', 'shipping.actions'],
            'worklogs-table': ['worklogs.equipment', 'worklogs.workDate', 'worklogs.workHours', 'worklogs.fuelLiters', 'worklogs.remark', 'worklogs.actions'],
            'plates-table': ['plates.plateNumber', 'plates.mine', 'plates.createdAt', 'plates.actions'],
            'factories-table': ['factories.name', 'factories.mine', 'factories.createdAt', 'factories.actions']
        };
        for (var tableId in headersMap) {
            var table = document.getElementById(tableId);
            if (!table) continue;
            var ths = table.querySelectorAll('thead th');
            var keys = headersMap[tableId];
            keys.forEach(function (key, i) {
                if (ths[i]) ths[i].textContent = I18n.t(key);
            });
        }
    }
};

I18n._phraseMaps = {
    'en-US': {
        '仪表板': 'Dashboard', '智能运营': 'Smart Ops', '智能运营中心': 'Smart Operations',
        '矿山管理': 'Mine Management', '用户管理': 'User Management', '设备管理': 'Equipment Management',
        '设备工时': 'Equipment Hours', '员工管理': 'Employee Management', '财务管理': 'Finance Management',
        '运输管理': 'Shipping Management', '车队管理': 'Fleet Management', '软件下载': 'App Downloads',
        '版本下载': 'Version Download', '工作日志': 'Work Logs', '矿山综合管理系统 · 刚果矿区': 'Mine management system · Congo site',
        '用户名': 'Username', '密码': 'Password', '请输入用户名': 'Enter username', '请输入密码': 'Enter password',
        '登 录': 'Login', '登录': 'Login', '退出登录': 'Log out', '测试账户：': 'Test accounts:',
        '超级管理员：admin / admin': 'Super admin: admin / admin', '矿山A管理员：mine_a / mine123': 'Mine A admin: mine_a / mine123',
        '矿山B管理员：mine_b / mine123': 'Mine B admin: mine_b / mine123',
        '新增': 'Add', '编辑': 'Edit', '删除': 'Delete', '保存': 'Save', '取消': 'Cancel', '确认': 'Confirm',
        '操作': 'Actions', '查询': 'Search', '刷新': 'Refresh', '导入': 'Import', '导出': 'Export', '模板': 'Template',
        '下载': 'Download', '加载中...': 'Loading...', '暂无数据': 'No data', '暂无记录': 'No records',
        '收入': 'Income', '支出': 'Expense', '净额': 'Net', '金额': 'Amount', '货币': 'Currency', '日期': 'Date',
        '描述': 'Description', '说明': 'Description', '支出明细': 'Expense Details', '收支分析': 'Income & Expense Analysis',
        '财务概览': 'Finance Overview', '收入记录': 'Income Records', '支出记录': 'Expense Records',
        'Excel导入': 'Excel Import', '下载模板': 'Download Template', '选择Excel导入': 'Choose Excel to Import',
        '设备': 'Equipment', '名称': 'Name', '代码': 'Code', '品牌': 'Brand', '类型': 'Type', '类别': 'Category',
        '状态': 'Status', '所属矿山': 'Mine', '运行中': 'Running', '闲置': 'Idle', '维修中': 'Maintenance',
        '选择设备': 'Select Equipment', '选择设备（可多选）': 'Select Equipment (multiple)',
        '工时记录': 'Hour Records', '补录工时与油耗': 'Manual Hours & Fuel', '加油登记': 'Fuel Entry',
        '最近工时记录': 'Recent Hour Records', '进行中的工时': 'Active Hours', '最近加油记录': 'Recent Fuel Records',
        '员工': 'Employees', '员工签到': 'Employee Check-in', '签到': 'Check in', '签退': 'Check out',
        '今日出勤': 'Today Attendance', '正在上班': 'On Duty', '今日工时': 'Today Hours', '本月工时': 'Monthly Hours',
        '运输记录': 'Shipping Records', '车牌号': 'Plate No.', '工厂': 'Factory', '货物类型': 'Cargo Type',
        '车牌比对': 'Plate Comparison', '授权车牌': 'Authorized Plates', '工厂管理': 'Factory Management',
        '车队车辆': 'Fleet Vehicles', '应用版本': 'App Version', '接口地址': 'API URL', '构建时间': 'Build Time'
    },
    'fr-FR': {
        '仪表板': 'Tableau de bord', '智能运营': 'Opérations intelligentes', '智能运营中心': 'Centre des opérations',
        '矿山管理': 'Gestion des mines', '用户管理': 'Gestion des utilisateurs', '设备管理': 'Gestion des équipements',
        '设备工时': 'Heures des équipements', '员工管理': 'Gestion des employés', '财务管理': 'Gestion financière',
        '运输管理': 'Gestion du transport', '车队管理': 'Gestion de flotte', '软件下载': 'Téléchargements',
        '版本下载': 'Téléchargement de version', '工作日志': 'Journaux de travail', '矿山综合管理系统 · 刚果矿区': 'Système de gestion minière · Site Congo',
        '用户名': 'Nom d’utilisateur', '密码': 'Mot de passe', '请输入用户名': 'Entrez le nom d’utilisateur', '请输入密码': 'Entrez le mot de passe',
        '登 录': 'Connexion', '登录': 'Connexion', '退出登录': 'Déconnexion', '测试账户：': 'Comptes de test :',
        '超级管理员：admin / admin': 'Super administrateur : admin / admin', '矿山A管理员：mine_a / mine123': 'Admin mine A : mine_a / mine123',
        '矿山B管理员：mine_b / mine123': 'Admin mine B : mine_b / mine123',
        '新增': 'Ajouter', '编辑': 'Modifier', '删除': 'Supprimer', '保存': 'Enregistrer', '取消': 'Annuler', '确认': 'Confirmer',
        '操作': 'Actions', '查询': 'Rechercher', '刷新': 'Actualiser', '导入': 'Importer', '导出': 'Exporter', '模板': 'Modèle',
        '下载': 'Télécharger', '加载中...': 'Chargement...', '暂无数据': 'Aucune donnée', '暂无记录': 'Aucun enregistrement',
        '收入': 'Revenus', '支出': 'Dépenses', '净额': 'Solde', '金额': 'Montant', '货币': 'Devise', '日期': 'Date',
        '描述': 'Description', '说明': 'Description', '支出明细': 'Détails des dépenses', '收支分析': 'Analyse revenus/dépenses',
        '财务概览': 'Aperçu financier', '收入记录': 'Revenus', '支出记录': 'Dépenses',
        'Excel导入': 'Import Excel', '下载模板': 'Télécharger le modèle', '选择Excel导入': 'Choisir un Excel',
        '设备': 'Équipement', '名称': 'Nom', '代码': 'Code', '品牌': 'Marque', '类型': 'Type', '类别': 'Catégorie',
        '状态': 'Statut', '所属矿山': 'Mine', '运行中': 'En marche', '闲置': 'Inactif', '维修中': 'Maintenance',
        '选择设备': 'Choisir équipement', '选择设备（可多选）': 'Choisir équipements (multiple)',
        '工时记录': 'Heures de travail', '补录工时与油耗': 'Saisie heures/carburant', '加油登记': 'Saisie carburant',
        '最近工时记录': 'Heures récentes', '进行中的工时': 'Heures en cours', '最近加油记录': 'Carburant récent',
        '员工': 'Employés', '员工签到': 'Pointage employé', '签到': 'Entrée', '签退': 'Sortie',
        '今日出勤': 'Présence du jour', '正在上班': 'Au travail', '今日工时': 'Heures du jour', '本月工时': 'Heures du mois',
        '运输记录': 'Transport', '车牌号': 'Plaque', '工厂': 'Usine', '货物类型': 'Type de cargaison',
        '车牌比对': 'Comparaison plaques', '授权车牌': 'Plaques autorisées', '工厂管理': 'Gestion usines',
        '车队车辆': 'Véhicules flotte', '应用版本': 'Version app', '接口地址': 'Adresse API', '构建时间': 'Date de build'
    }
};

I18n._translatePhrase = function (text) {
    if (!text || this._lang === 'zh-CN') return text;
    var map = this._phraseMaps[this._lang] || {};
    return map[text] || text;
};

I18n._applyPhraseMap = function (root) {
    root = root || document.body;
    if (!root) return;
    var map = this._phraseMaps[this._lang] || {};
    if (this._lang === 'zh-CN' || !Object.keys(map).length) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
            var value = node.nodeValue.trim();
            if (!value || value.length > 80) return NodeFilter.FILTER_REJECT;
            if (node.parentElement && ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
        var raw = node.nodeValue;
        var leading = raw.match(/^\s*/)[0];
        var trailing = raw.match(/\s*$/)[0];
        var key = raw.trim();
        if (map[key]) node.nodeValue = leading + map[key] + trailing;
    });

    root.querySelectorAll('input[placeholder], textarea[placeholder], [title], [aria-label]').forEach(function (el) {
        ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
            var value = el.getAttribute(attr);
            if (value && map[value]) el.setAttribute(attr, map[value]);
        });
    });
};

I18n._observeDom = function () {
    if (this._observer || !document.body) return;
    this._observer = new MutationObserver((mutations) => {
        if (this._lang === 'zh-CN') return;
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) this._applyPhraseMap(node);
            });
        });
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
};

I18n._baseApplyAll = I18n.applyAll.bind(I18n);
I18n.applyAll = function () {
    this._baseApplyAll();
    this._applyPhraseMap(document.body);
    this._observeDom();
};

I18n._baseSwitchLang = I18n.switchLang.bind(I18n);
I18n.switchLang = function (lang) {
    if (!this.supported.includes(lang)) return;
    localStorage.setItem('mineops_lang', lang);
    window.location.reload();
};

// 全局导出
window.I18n = I18n;
