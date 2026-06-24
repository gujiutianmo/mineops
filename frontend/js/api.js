/**
 * MineOps API Module
 * Centralized API client with CRUD factory pattern
 */
const API_CONFIG = {
    baseUrl: window.MINEOPS_API_BASE || (
        window.location.port && window.location.port !== '80'
            ? `${window.location.protocol}//${window.location.hostname}:8008`
            : `${window.location.origin}/api`
    )
};

const API = {
    baseUrl: API_CONFIG.baseUrl,

    /* ─── Core HTTP methods ─── */
    request: async function(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const authHeaders = Auth.getAuthHeaders();

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...authHeaders, ...options.headers }
            });

            if (response.status === 401) {
                Auth.logout();
                throw new Error('会话已过期，请重新登录。');
            }
            if (response.status === 403) {
                throw new Error('您没有执行此操作的权限。');
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (!response.ok) throw new Error(data.detail || `API 错误: ${response.status}`);
                return data;
            }

            if (!response.ok) throw new Error(`API 错误: ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error('API 请求失败:', error);
            throw error;
        }
    },

    get: function(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(qs ? `${endpoint}?${qs}` : endpoint, { method: 'GET' });
    },

    post: function(endpoint, data = {}) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
    },

    put: function(endpoint, data = {}) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
    },

    delete: function(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    /* ─── File operations ─── */
    uploadFile: async function(endpoint, formData) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = localStorage.getItem('mineops_token') || '';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (response.status === 401) { Auth.logout(); throw new Error('会话已过期，请重新登录。'); }
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || `API 错误: ${response.status}`);
            return data;
        } catch (error) {
            console.error('文件上传失败:', error);
            throw error;
        }
    },

    downloadFile: async function(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const url = qs ? `${this.baseUrl}${endpoint}?${qs}` : `${this.baseUrl}${endpoint}`;
        try {
            const response = await fetch(url, { method: 'GET', headers: Auth.getAuthHeaders() });
            if (response.status === 401) { Auth.logout(); throw new Error('会话已过期，请重新登录。'); }
            if (!response.ok) throw new Error(`下载失败: ${response.status}`);

            const blob = await response.blob();
            let filename = 'download.xlsx';
            const cd = response.headers.get('content-disposition');
            if (cd) {
                // Handle filename*=UTF-8''encoded format (RFC 5987)
                const starMatch = cd.match(/filename\*=UTF-8''([^;]*)/);
                if (starMatch) {
                    filename = decodeURIComponent(starMatch[1]);
                } else {
                    // Handle regular filename= format
                    const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
                }
            }
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl; a.download = filename;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            return { success: true };
        } catch (error) {
            console.error('文件下载失败:', error);
            throw error;
        }
    }
};

/* ─── CRUD factory: auto-generates standard CRUD endpoint methods ─── */
function createCrudApi(resourcePath) {
    return {
        getAll: (params) => API.get(`/${resourcePath}/`, params),
        getById: (id) => API.get(`/${resourcePath}/${id}`),
        create: (data) => API.post(`/${resourcePath}/`, data),
        update: (id, data) => API.put(`/${resourcePath}/${id}`, data),
        delete: (id) => API.delete(`/${resourcePath}/${id}`)
    };
}

function createImportExportApi(resourcePath) {
    return {
        importExcel: (formData, params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return API.uploadFile(`/${resourcePath}/import/excel${qs ? `?${qs}` : ''}`, formData);
        },
        exportExcel: (params = {}) => API.downloadFile(`/${resourcePath}/export/excel`, params),
        downloadTemplate: () => API.downloadFile(`/${resourcePath}/import/template`)
    };
}

/* ─── Entity API modules ─── */
API.mines = createCrudApi('mines');
API.equipment = createCrudApi('equipment');
API.employees = createCrudApi('employees');
API.finance = createCrudApi('finance');
API.finance.analysis = (params) => API.get('/finance/analysis', params);
API.finance.summaryByCurrency = (params) => API.get('/finance/summary/by-currency', params);
API.finance.expenseByCategory = (params) => API.get('/finance/summary/expense-by-category', params);
API.plates = createCrudApi('plates');
API.factories = createCrudApi('factories');
API.shipping = createCrudApi('shipping');
API.worklogs = createCrudApi('worklogs');
API.fleet = {
    vehicles: {
        getAll: (params) => API.get('/fleet/vehicles', params),
        getById: (id) => API.get(`/fleet/vehicles/${id}`),
        create: (data) => API.post('/fleet/vehicles', data),
        update: (id, data) => API.put(`/fleet/vehicles/${id}`, data),
        delete: (id) => API.delete(`/fleet/vehicles/${id}`)
    },
    maintenance: {
        getAll: (params) => API.get('/fleet/maintenance', params),
        getById: (id) => API.get(`/fleet/maintenance/${id}`),
        create: (data) => API.post('/fleet/maintenance', data),
        update: (id, data) => API.put(`/fleet/maintenance/${id}`, data),
        delete: (id) => API.delete(`/fleet/maintenance/${id}`)
    },
    fuelTrips: {
        getAll: (params) => API.get('/fleet/fuel-trips', params),
        getById: (id) => API.get(`/fleet/fuel-trips/${id}`),
        create: (data) => API.post('/fleet/fuel-trips', data),
        update: (id, data) => API.put(`/fleet/fuel-trips/${id}`, data),
        delete: (id) => API.delete(`/fleet/fuel-trips/${id}`),
        sync: (params) => API.post(`/fleet/fuel-trips/sync?${new URLSearchParams(params).toString()}`, {})
    },
    dashboard: (params) => API.get('/fleet/dashboard', params),
    plateComparison: (params) => API.get('/fleet/plate-comparison', params),
    analyzeText: (data) => API.post('/fleet/analyze-text', data),
    savePlateRecord: (data) => API.post('/fleet/plate-records', data),
    importWorkbook: (formData, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return API.uploadFile(`/fleet/import/workbook${qs ? `?${qs}` : ''}`, formData);
    },
    downloadTemplate: () => API.downloadFile('/fleet/import/template'),
    exportWorkbook: (params) => API.downloadFile('/fleet/export/workbook', params)
};
API.users = {
    getAll: (params) => API.get('/auth/users', params),
    getById: (id) => API.get(`/auth/users/${id}`),
    create: (data) => API.post('/auth/users', data),
    update: (id, data) => API.put(`/auth/users/${id}`, data),
    delete: (id) => API.delete(`/auth/users/${id}`)
};
API.emailSettings = {
    get: () => API.get('/auth/email-settings'),
    update: (data) => API.put('/auth/email-settings', data),
    test: (data) => API.post('/auth/email-settings/test', data)
};
API.accountSettings = {
    updateProfile: (data) => API.put('/auth/me/account', data),
    changePassword: (data) => API.post('/auth/change-password', data)
};
API.adminTools = {
    getSecurity: () => API.get('/admin-tools/security'),
    updateSecurity: (data) => API.put('/admin-tools/security', data),
    reminders: (params) => API.get('/admin-tools/reminders', params),
    locks: (params) => API.get('/admin-tools/locks', params),
    createLock: (data) => API.post('/admin-tools/locks', data),
    deleteLock: (id) => API.delete(`/admin-tools/locks/${id}`),
    recycleBin: () => API.get('/admin-tools/recycle-bin'),
    restore: (id) => API.post(`/admin-tools/recycle-bin/${id}/restore`, {}),
    reportOverview: (params) => API.get('/admin-tools/reports/overview', params)
};
API.audit = {
    list: (params) => API.get('/audit/', params),
    stats: () => API.get('/audit/stats')
};
API.equipmentHours = {
    list: (params) => API.get('/equipment-hours/records', params),
    getById: (id) => API.get(`/equipment-hours/records/${id}`),
    update: (id, data) => API.put(`/equipment-hours/records/${id}`, data),
    delete: (id) => API.delete(`/equipment-hours/records/${id}`),
    active: () => API.get('/equipment-hours/active'),
    start: (data) => API.post('/equipment-hours/start', data),
    batchStart: (data) => API.post('/equipment-hours/batch-start', data),
    end: (id, data = {}) => API.post(`/equipment-hours/${id}/end`, data),
    manual: (data) => API.post('/equipment-hours/manual', data),
    myStats: (params) => API.get('/equipment-hours/my-stats', params),
    dashboard: (params) => API.get('/equipment-hours/dashboard', params),
    daily: (params) => API.get('/equipment-hours/daily', params),
    operatorRanking: (params) => API.get('/equipment-hours/operator-ranking', params),
    batchDelete: (ids) => API.post('/equipment-hours/batch-delete', { record_ids: ids }),
    batchEnd: (ids) => API.post('/equipment-hours/batch-end', { record_ids: ids }),
    exportExcel: (params) => API.downloadFile('/equipment-hours/export/excel', params)
};
API.employeeAttendance = {
    records: (params) => API.get('/employee-attendance/records', params),
    active: (params) => API.get('/employee-attendance/active', params),
    today: (params) => API.get('/employee-attendance/today', params),
    stats: (params) => API.get('/employee-attendance/stats', params),
    checkOut: (id, data = {}) => API.post(`/employee-attendance/${id}/check-out`, data)
};
API.plateCounter = {
    getTargets: (params) => API.get('/plate-counter/targets', params),
    saveTargets: (data) => API.put('/plate-counter/targets', data),
    analyze: (data) => API.post('/plate-counter/analyze', data),
    analyzeFile: (formData) => API.uploadFile('/plate-counter/analyze-file', formData),
    saveRecord: (data) => API.post('/plate-counter/records', data),
    listRecords: (params) => API.get('/plate-counter/records', params),
    getRecord: (date, params) => API.get(`/plate-counter/records/${date}`, params),
    deleteRecord: (date, params) => API.delete(`/plate-counter/records/${date}${params ? '?' + new URLSearchParams(params).toString() : ''}`),
    monthly: (params) => API.get('/plate-counter/monthly', params),
    exportMonthly: (params) => API.downloadFile('/plate-counter/monthly/export', params)
};

API.opsIntelligence = {
    overview: (params) => API.get('/ops-intelligence/overview', params)
};

API.equipmentImport = {
    ...createImportExportApi('equipment'),
    getMonthlyDetail: (params) => API.get('/equipment/reports/monthly-detail', params),
    exportMonthlyDetail: (params) => API.downloadFile('/equipment/reports/monthly-detail/export', params),
    getMonthlySummary: (params) => API.get('/equipment/reports/monthly-summary', params),
    exportMonthlySummary: (params) => API.downloadFile('/equipment/reports/monthly-summary/export', params)
};

API.financeImport = createImportExportApi('finance');

API.employeeImport = createImportExportApi('employees');
API.plateImport = createImportExportApi('plates');

/* ─── Worklog Import/Export (NEW) ─── */
API.worklogImport = {
    downloadTemplate: () => API.downloadFile('/equipment/worklogs/template'),
    exportExcel: (params) => API.downloadFile('/equipment/worklogs/export-by-range', params)
};

/* ─── Smart Parse & WorkLog Batch APIs ─── */
API.equipment.smartParse = (data) => API.post('/equipment/smart-parse', data);
API.equipment.parse = (data) => API.post('/equipment/parse', data);
API.equipment.match = (data) => API.post('/equipment/match', data);
API.equipment.batchWorklogs = (data) => API.post('/equipment/worklogs/batch', data);
API.equipment.batchFuel = (data) => API.post('/equipment/worklogs/batch-fuel', data);
API.equipment.quickToggleStatus = (id) => API.post(`/equipment/${id}/quick-status`);
API.equipment.worklogs = {
    getAll: (params) => API.get('/equipment/worklogs', params),
    getById: (id) => API.get(`/equipment/worklogs/${id}`),
    create: (data) => API.post('/equipment/worklogs', data),
    update: (id, data) => API.put(`/equipment/worklogs/${id}`, data),
    delete: (id) => API.delete(`/equipment/worklogs/${id}`)
};
API.shippingReports = {
    plateComparison: (params) => API.get('/shipping/reports/plate-comparison', params),
    plateRanking: (params) => API.get('/shipping/reports/plate-ranking', params),
    factoryStats: (params) => API.get('/shipping/reports/factory-stats', params)
};

/* ─── Dashboard (aggregation) ─── */
API.dashboard = {
    getStats: async function() {
        const [mines, equip, emp, fin] = await Promise.all([
            API.mines.getAll({ limit: 1000 }),
            API.equipment.getAll({ limit: 1000 }),
            API.employees.getAll({ limit: 1000 }),
            API.finance.getAll({ limit: 1000 })
        ]);
        const financeByCurrency = {};
        fin.forEach(r => {
            const currency = r.currency || 'UNKNOWN';
            if (!financeByCurrency[currency]) financeByCurrency[currency] = 0;
            financeByCurrency[currency] += r.trans_type === 'income' ? Number(r.amount || 0) : -Number(r.amount || 0);
        });
        return {
            mineCount: mines.length,
            equipmentCount: equip.length,
            employeeCount: emp.length,
            financeByCurrency
        };
    },

    getRecentActivity: async function() {
        const [finance, shipping, worklogs] = await Promise.all([
            API.finance.getAll({ limit: 5 }),
            API.shipping.getAll({ limit: 5 }),
            API.worklogs.getAll({ limit: 5 })
        ]);
        const activities = [];
        finance.forEach(r => activities.push({
            type: 'finance', icon: 'fa-chart-line',
            title: `${r.trans_type === 'income' ? '收入' : '支出'}: ${r.amount} ${r.currency}`,
            description: r.description || '无描述',
            time: new Date(r.trans_date).toLocaleDateString()
        }));
        shipping.forEach(r => activities.push({
            type: 'shipping', icon: 'fa-truck-loading',
            title: `运输: ${r.plate_number}`,
            description: `工厂ID: ${r.factory_id}`,
            time: new Date(r.load_time).toLocaleDateString()
        }));
        worklogs.forEach(r => activities.push({
            type: 'worklog', icon: 'fa-clipboard-list',
            title: `工作日志: ${r.work_hours} 小时`,
            description: `设备 ${r.equipment_id}`,
            time: new Date(r.work_date).toLocaleDateString()
        }));
        return activities.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
    },

    getEquipmentMonthlyStats: () => {
        const now = new Date();
        return API.get('/worklogs/monthly-stats', { year: now.getFullYear(), month: now.getMonth() + 1 });
    },
    getFuelTrend: () => {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return API.get('/worklogs/fuel-trend', { start_date: startDate, end_date: endDate });
    },
    getFinanceSummary: () => API.get('/finance/summary/by-currency'),
    getExpenseByCategory: () => API.get('/finance/summary/expense-by-category'),

    /* ─── NEW: Enhanced Dashboard APIs ─── */
    getQuickSummary: () => API.get('/equipment/dashboard/quick-summary'),
    getStatusOverview: () => API.get('/equipment/dashboard/status-overview'),
    getHoursRanking: (params) => API.get('/equipment/dashboard/hours-ranking', params),
    getDailyTrend: (params) => API.get('/equipment/dashboard/daily-trend', params),
    getUtilization: (params) => API.get('/equipment/dashboard/utilization', params),
    getCategorySummary: (params) => API.get('/equipment/dashboard/category-summary', params)
};

/* ─── API mapping tables for UI module ─── */
const API_MAP = {
    mines: API.mines, equipment: API.equipment, employees: API.employees,
    finance: API.finance, shipping: API.shipping, worklogs: API.worklogs,
    plates: API.plates, factories: API.factories, users: API.users,
    'fleet-vehicles': API.fleet.vehicles,
    'fleet-maintenance': API.fleet.maintenance,
    'fleet-fuel-trips': API.fleet.fuelTrips
};

const IMPORT_EXPORT_MAP = {
    equipment: API.equipmentImport,
    employees: API.employeeImport,
    finance: API.financeImport,
    plate: API.plateImport,
    worklogs: API.worklogImport
};
