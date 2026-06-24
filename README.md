<<<<<<< Updated upstream
# MineOps — 矿山综合管理系统

## 项目概述

MineOps 是一套面向**刚果（金）矿区**的矿山综合运营管理系统，覆盖设备、人员、财务、运输、运维等全链路业务场景。系统采用 **Python FastAPI 后端 + Web 管理后台 + 微信小程序移动端** 三端架构，支持中/英/法三语国际化，专为矿区多语言管理环境设计。

- **访问地址**: 
- **后端框架**: Python FastAPI + SQLAlchemy + SQLite
- **前端技术**: 原生 HTML/CSS/JS + Chart.js 图表
- **移动端**: 微信小程序（lib 3.16.1）
- **部署方式**: Ubuntu + Nginx 反向代理 + Uvicorn

---

## 核心功能模块

### 1. 🏭 矿山管理
- 多矿山并行管理（矿山A·卢本巴希矿区 / 矿山B·科卢韦齐矿区）
- 超级管理员可跨矿山查看，矿山子管理员仅查看归属矿山
- 支持矿山创建、编辑、级联删除（关联设备/人员/财务一并清理）

### 2. 🚜 设备管理
- **47台重型设备**全生命周期管理：挖掘机、破碎锤、铲车、矿卡、短车、压路机
- 设备品牌涵盖：三一(SANY)、徐工(XCMG)、柳工(LiuGong)、临工(Lingong)
- 设备工时记录：启动/结束计时，自动计算工时
- 油耗登记：每次加油量记录，关联设备
- 手动补录：历史工时和油耗数据补录
- 维修保养：维修记录追踪、保养提醒

### 3. 👷 人员管理
- 刚果本地员工信息管理（中法双语姓名）
- 员工签到/签退：出勤打卡，自动计算工时
- 薪资管理：支持 USD / CDF 双币种
- 工种分类：挖掘机司机、卡车司机、装载机司机、修理工、普工等

### 4. 💰 财务管理
- 收入与支出记录
- 多币种支持（美元 USD / 刚果法郎 CDF）
- 财务报表与统计分析
- 按矿山独立核算

### 5. 🚛 运输管理（Shipping）
- 矿卡运输记录：车牌号、运输车次、出发/到达时间
- 授权车牌管理：白名单机制
- 短车与矿卡分类统计
- 运输量追踪与趋势分析

### 6. 🏗️ 工厂管理
- 采矿点、堆浸场、选矿厂等生产节点管理
- 各工厂关联设备与人员
- 产量统计与效率分析

### 7. 📊 智能运营看板（Ops Intelligence）
- **KPI 仪表盘**：总工时、总油耗、出勤人数、运输车次
- **异常告警**：设备闲置超时、油耗异常、出勤异常
- **智能建议**：基于历史数据的运营优化推荐
- 30天趋势图（Chart.js 可视化）

### 8. 🔢 车牌计数器（Plate Counter）
- 矿山出入口车牌自动识别记录
- 每日过车统计
- 白名单/黑名单车牌管理
- 与运输模块联动

### 9. 👤 用户与权限
- **三级角色体系**：
  - `super` 超级管理员 — 全局管理，跨矿山
  - `mine` 矿山管理员 — 管理本矿山数据，可创建子用户
  - `user` 矿山用户 — 纯查看权限
- JWT Token 鉴权（8小时过期）
- 密码修改、账户启停

---

## 技术架构

```
┌──────────────────────────────────────────┐
│              微信小程序                    │
│   (miniapp/) pages: index/hours/        │
│                people/profile             │
└──────────────┬───────────────────────────┘
               │ HTTP/SSE
┌──────────────▼───────────────────────────┐
│         Nginx (Port 80)                   │
│   /api/* → proxy_pass → localhost:8008   │
│   /*     → 静态文件 → frontend/           │
└──────────────┬───────────────────────────┘
               │
┌──────────────▼───────────────────────────┐
│      FastAPI Backend (Port 8008)          │
│   routers/: 17个路由模块                   │
│   ├── auth         ├── equipment         │
│   ├── mine         ├── fleet             │
│   ├── employee     ├── finance           │
│   ├── shipping     ├── ops_intelligence   │
│   ├── plate        ├── maintenance       │
│   ├── analytics    └── ...               │
│                                            │
│   SQLAlchemy + SQLite (mineops.db)        │
└──────────────────────────────────────────┘
```

### 数据库实体（17张表）

| 表名 | 说明 |
|------|------|
| `mine` | 矿山 |
| `mine_account` | 用户账户 |
| `equipment` | 设备台账 |
| `equipment_work_log` | 设备工作日志 |
| `equipment_work_session` | 设备工时会话 |
| `employee` | 员工信息 |
| `employee_attendance` | 员工出勤记录 |
| `finance_record` | 财务记录 |
| `fleet_vehicle` | 车队车辆 |
| `fleet_fuel_trip_record` | 加油记录 |
| `fleet_maintenance_record` | 维修记录 |
| `shipping_record` | 运输记录 |
| `authorized_plate` | 授权车牌 |
| `plate` | 车牌数据 |
| `plate_counter_target` | 计数器目标 |
| `plate_counter_daily_record` | 每日计数 |
| `factory` | 工厂/生产节点 |

---

## 部署信息

```bash
# 服务器

# 服务端口
80   → Nginx（前端 + API 代理）
8008 → Uvicorn（FastAPI 后端）
8088 → Python http.server（前端静态文件）

# 应用路径
/home/ubuntu/mineops/
├── backend/    # FastAPI 后端代码
├── frontend/   # Web 管理后台
└── ...
```

### 快速部署（从本地 Windows）

```powershell
cd D:\mineops
python deploy.py          # 完整部署
python deploy_backend.py  # 仅部署后端
python quick_deploy.py    # 快速部署前端文件
```

### 测试账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | admin |
| 矿山A管理员 | mine_a | mine123 |
| 矿山B管理员 | mine_b | mine123 |

---

## 项目特色

1. **三语国际化**：中文 / English / Français，适配刚果多语言环境
2. **二维码车牌识别**：微信小程序扫码自动识别车牌
3. **智能别名匹配**：设备支持多别名搜索（如"2号""三一""钩机"均可匹配同一设备）
4. **响应式设计**：PC管理后台 + 微信小程序双端覆盖
5. **离线可用**：移动端核心功能在弱网环境下可离线操作
6. **实时看板**：30天运营数据趋势可视化

---

*MineOps v2.0 · 刚果矿区数字化运营平台*
=======
# MineOps — 矿山智能运营管理系统

智慧矿山运营管理平台，支持多矿山、多车队、多币种的设备、人员、财务、运输、油耗一体化管理。

## 项目概览

| 项目 | 说明 |
|------|------|
| **名称** | MineOps + FleetOps 双系统 |
| **版本** | v2.0 |
| **后端** | Python 3.10+ / FastAPI + SQLAlchemy + SQLite |
| **前端** | React 19 + TypeScript + TailwindCSS + shadcn/ui |
| **移动端** | 微信小程序 |
| **部署** | Ubuntu 22.04 + Nginx + Uvicorn |
| **访问** | http://1.12.231.11 (MineOps) |
| | http://1.12.231.11/fleetops/ (FleetOps) |

## 系统架构

```
┌─────────────────────────────────────────────┐
│                  Nginx :80                   │
│  / → MineOps React  /fleetops/ → FleetOps   │
├─────────────────────────────────────────────┤
│  /api/ → MineOps Backend :8008              │
│  /fleetops-api/ → FleetOps Backend :8010    │
├─────────────────────────────────────────────┤
│  SQLite: mineops.db  │  fleetops.db         │
└─────────────────────────────────────────────┘
```

## 功能模块

### MineOps（矿山运营管理）
| 模块 | 功能 |
|------|------|
| 📊 仪表板 | 运营总览、油耗/财务/运输/工时趋势 |
| ⚙️ 设备管理 | 设备档案、月度汇总、工作明细、Excel批量导入 |
| ⏱️ 设备工时 | 计时/补录/批量开始、工时统计、文本识别补录 |
| 👷 员工管理 | 中法双语档案、签到/签退、考勤补录、薪资管理 |
| 💰 财务管理 | 收入/支出、多币种（USD/CDF）、汇率转换、月度趋势图 |
| 🚛 运输管理 | 装车记录、授权车牌、工厂管理、车牌运输排名 |
| 🔍 车牌比对 | 每日识别录入、月度统计、目标车牌从车辆档案自动同步 |
| 📋 Excel 批量导入 | 统一模板下载、按模块批量导入 |
| 📈 运营中心 | KPI看板、异常预警、多维度分析 |
| 🔐 系统设置 | 账户管理、到期提醒、报表导出、数据治理、安全策略 |

### FleetOps（车队运营管理系统）
独立部署的车队管理子系统，拥有独立数据库：
| 模块 | 功能 |
|------|------|
| 📊 车队概览 | 核心运营数据面板 |
| 🚗 车辆与养护 | 车辆档案、维修配件、加油趟数、车辆类型筛选 |
| 🚛 运输管理 | 装车记录、车牌识别、运输统计 |
| 🔍 车牌比对 | 车牌识别录入与月度汇总 |
| 💰 车队财务 | 收支管理、汇率分析、Excel导入导出 |
| ✅ 签到打卡 | 司机/修理工签到签退、Excel批量导入人员花名册 |
| 📋 Excel 导入 | 统一批量导入中心 |

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端框架** | FastAPI (Python) |
| **ORM** | SQLAlchemy |
| **数据库** | SQLite (mineops.db / fleetops.db) |
| **认证** | JWT Bearer Token |
| **前端框架** | React 19 + TypeScript |
| **UI 库** | shadcn/ui + Radix UI + TailwindCSS v4 |
| **图表** | Recharts |
| **构建工具** | Vite 6 |
| **路由** | React Router v7 (HashRouter) |
| **Web 服务器** | Nginx |
| **ASGI** | Uvicorn |

## 项目结构

```
mineops/
├── backend/                  # FastAPI 后端（MineOps + FleetOps 共享代码）
│   ├── main.py               # MineOps 入口 (port 8008)
│   ├── fleetops_main.py      # FleetOps 入口 (port 8010)
│   ├── models.py             # 数据模型 (20+ 张表)
│   ├── routers/              # 路由模块 (18 个)
│   │   ├── fleet.py          # 车队管理
│   │   ├── fleet_attendance.py  # 车队签到打卡
│   │   ├── finance.py        # 财务管理
│   │   ├── plate_counter.py  # 车牌比对
│   │   └── ...
│   ├── schemas/              # Pydantic 验证
│   ├── services/             # 业务逻辑
│   └── utils/                # 工具函数
├── frontend-react/           # React 前端（MineOps）
│   └── src/pages/            # 页面组件（FleetOps 共享）
├── fleetops-frontend/        # React 前端（FleetOps 独立入口）
│   ├── src/                  # FleetOps 专属组件
│   └── vite.config.mjs       # base: "/fleetops/"
├── frontend/                 # 旧版 HTML/JS 前端（Legacy）
├── miniapp/                  # 微信小程序
└── deploy*.py                # 部署脚本
```

## 角色权限

| 角色 | 权限 |
|------|------|
| **super** | 全局管理员，可跨矿山/车队 |
| **mine** | 矿山管理员，仅管理所属矿山 |
| **fleet** | 车队账户，仅管理所属车队 |
| **user** | 矿山用户，基础查看权限 |

## 快速部署

### 后端
```bash
cd /home/ubuntu/mineops/backend
pip install -r requirements.txt

# MineOps
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8008 > /tmp/mineops-backend.log 2>&1 &

# FleetOps（独立数据库）
DB_PATH=/home/ubuntu/fleetops/backend/fleetops.db nohup python -m uvicorn fleetops_main:app --host 127.0.0.1 --port 8010 > /tmp/fleetops-backend.log 2>&1 &
```

### 前端
```bash
# MineOps React
cd frontend-react && npm run build    # dist → frontend-react/dist/

# FleetOps React
cd fleetops-frontend && npm run build  # dist → fleetops-frontend/dist/
```

### Nginx
```nginx
server {
    listen 80;
    root /home/ubuntu/mineops/frontend;
    
    location /api/ { proxy_pass http://127.0.0.1:8008/; }
    location /fleetops-api/ { proxy_pass http://127.0.0.1:8010/; }
    location /fleetops/ {
        alias /home/ubuntu/mineops/fleetops-frontend/dist/;
        try_files $uri /fleetops/index.html;
    }
}
```

## 数据表概览（20+ 张）

| 表名 | 说明 |
|------|------|
| mine | 矿山组织 |
| mine_account | 用户账户 |
| equipment | 设备档案 |
| equipment_work_session | 设备工时会话 |
| employee | 员工档案 |
| employee_attendance | 员工考勤 |
| finance_record | 财务记录 |
| fleet_organization | 车队组织 |
| fleet_vehicle | 车辆档案 |
| fleet_maintenance_record | 维修记录 |
| fleet_fuel_trip_record | 加油趟数 |
| fleet_attendance | 车队签到打卡 |
| fleet_staff | 车队人员花名册 |
| shipping_record | 运输记录 |
| factory | 工厂 |
| plate_counter_daily_record | 车牌比对记录 |
| plate_counter_target | 车牌比对目标 |
| audit_log | 审计日志 |

## License

Private — All rights reserved.
>>>>>>> Stashed changes
