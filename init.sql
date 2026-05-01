-- ============================================
-- 矿山管理系统 数据库初始化脚本 (MySQL 8.0+)
-- ============================================
CREATE DATABASE IF NOT EXISTS mineops DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mineops;
-- 矿山表
CREATE TABLE IF NOT EXISTS mine (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
-- 账户表
CREATE TABLE IF NOT EXISTS mine_account (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    role ENUM('super','mine') NOT NULL DEFAULT 'mine',
    mine_id CHAR(36) NULL,
    active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id) ON DELETE SET NULL
) ENGINE=InnoDB;
-- 设备表
CREATE TABLE IF NOT EXISTS equipment (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    vehicle_num VARCHAR(50) DEFAULT '' COMMENT '车辆设备编号（V0001等）',
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(200) DEFAULT '',
    type VARCHAR(100) DEFAULT '',
    aliases JSON COMMENT '别名列表，JSON数组格式',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id),
    UNIQUE KEY uk_mine_code (mine_id, code)
) ENGINE=InnoDB;
-- 工时油耗记录表
CREATE TABLE IF NOT EXISTS equipment_work_log (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    equipment_id CHAR(36) NOT NULL,
    work_date DATE NOT NULL,
    work_hours DECIMAL(8,2) DEFAULT 0,
    fuel_liters DECIMAL(10,2) DEFAULT 0,
    remark VARCHAR(500) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
) ENGINE=InnoDB;
-- 人员表
CREATE TABLE IF NOT EXISTS employee (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    name_fr VARCHAR(200) NOT NULL COMMENT '法语姓名',
    name_cn VARCHAR(200) DEFAULT '' COMMENT '中文音译',
    staff_type VARCHAR(10) DEFAULT '' COMMENT '国籍类型: 中方/刚方',
    job VARCHAR(200) DEFAULT '' COMMENT '工种',
    salary DECIMAL(12,2) DEFAULT 0,
    currency ENUM('USD','CDF') DEFAULT 'USD',
    deleted TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id)
) ENGINE=InnoDB;
-- 财务流水表
CREATE TABLE IF NOT EXISTS finance_record (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    trans_type ENUM('income','expense') NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    currency ENUM('USD','CDF') NOT NULL,
    category VARCHAR(200) DEFAULT '',
    description VARCHAR(500) DEFAULT '',
    recorder VARCHAR(200) DEFAULT '',
    trans_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id),
    INDEX idx_mine_date (mine_id, trans_date),
    INDEX idx_mine_currency (mine_id, currency)
) ENGINE=InnoDB;
-- 授权车牌表
CREATE TABLE IF NOT EXISTS authorized_plate (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    plate_number VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id),
    UNIQUE KEY uk_mine_plate (mine_id, plate_number)
) ENGINE=InnoDB;
-- 工厂表
CREATE TABLE IF NOT EXISTS factory (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id)
) ENGINE=InnoDB;
-- 装车记录表
CREATE TABLE IF NOT EXISTS shipping_record (
    id CHAR(36) PRIMARY KEY,
    mine_id CHAR(36) NOT NULL,
    plate_number VARCHAR(100) NOT NULL,
    load_time DATETIME NOT NULL,
    factory_id CHAR(36) NOT NULL,
    cargo_type VARCHAR(200) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mine_id) REFERENCES mine(id),
    FOREIGN KEY (factory_id) REFERENCES factory(id),
    INDEX idx_mine_time (mine_id, load_time)
) ENGINE=InnoDB;
-- ============================================
-- 初始数据
-- ============================================
INSERT INTO mine (id, name) VALUES
('mine_a', '矿山A · 卢本巴希矿区'),
('mine_b', '矿山B · 科卢韦齐矿区');
-- 密码统一为 admin123 / mine123，使用 passlib bcrypt 哈希
-- 下面用占位哈希，首次启动后端会自动检测并替换
INSERT INTO mine_account (id, username, password_hash, display_name, role, mine_id, active) VALUES
('acc_super', 'admin', '$2b$12$PLACEHOLDER_ADMIN', '总管理员', 'super', NULL, 1),
('acc_a', 'mine_a', '$2b$12$PLACEHOLDER_MINEA', '矿山A管理员', 'mine', 'mine_a', 1),
('acc_b', 'mine_b', '$2b$12$PLACEHOLDER_MINEB', '矿山B管理员', 'mine', 'mine_b', 1);
INSERT INTO equipment (id, mine_id, code, name, brand, type) VALUES
('eq_a1', 'mine_a', 'EXC-001', '卡特320D挖掘机', '卡特彼勒', '挖掘机'),
('eq_a2', 'mine_a', 'TRK-001', '豪沃T7H矿卡', '中国重汽', '卡车'),
('eq_a3', 'mine_a', 'LOD-001', '柳工856H装载机', '柳工', '装载机'),
('eq_b1', 'mine_b', 'EXC-002', '小松PC360挖掘机', '小松', '挖掘机'),
('eq_b2', 'mine_b', 'TRK-002', '陕汽德龙矿卡', '陕汽', '卡车');
INSERT INTO factory (id, mine_id, name) VALUES
('fac_a1', 'mine_a', '1号采矿点'),
('fac_a2', 'mine_a', '2号堆浸场'),
('fac_b1', 'mine_b', '3号选矿厂'),
('fac_b2', 'mine_b', '4号采矿点');
INSERT INTO authorized_plate (id, mine_id, plate_number) VALUES
('ap_a1', 'mine_a', 'CD-12345-AB'),
('ap_a2', 'mine_a', 'CD-67890-CD'),
('ap_a3', 'mine_a', 'CD-11111-EF'),
('ap_b1', 'mine_b', 'CD-22222-GH'),
('ap_b2', 'mine_b', 'CD-33333-IJ');
INSERT INTO employee (id, mine_id, name_fr, name_cn, job, salary, currency) VALUES
('emp_a1', 'mine_a', 'Jean Mukendi', '让·穆肯迪', '挖掘机司机', 450.00, 'USD'),
('emp_a2', 'mine_a', 'Pierre Kabongo', '皮埃尔·卡本戈', '卡车司机', 380.00, 'USD'),
('emp_a3', 'mine_a', 'Joseph Mwamba', '约瑟夫·姆万巴', '普工', 180000.00, 'CDF'),
('emp_a4', 'mine_a', 'Antoine Tshimanga', '安托万·奇曼加', '修理工', 500.00, 'USD'),
('emp_b1', 'mine_b', 'Marcel Nsungu', '马塞尔·恩松古', '挖掘机司机', 420.00, 'USD'),
('emp_b2', 'mine_b', 'François Kalala', '弗朗索瓦·卡拉拉', '装载机司机', 400.00, 'USD'),
('emp_b3', 'mine_b', 'Patrick Lubala', '帕特里克·卢巴拉', '普工', 160000.00, 'CDF');
