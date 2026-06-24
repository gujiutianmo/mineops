import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Numeric, Integer, DateTime, Date, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from database import Base
def gen_id():
    return str(uuid.uuid4())
class Mine(Base):
    __tablename__ = "mine"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    accounts = relationship("MineAccount", back_populates="mine")
    equipments = relationship("Equipment", back_populates="mine")
    employees = relationship("Employee", back_populates="mine")
    employee_attendance = relationship("EmployeeAttendance", back_populates="mine")
    finance_records = relationship("FinanceRecord", back_populates="mine")
    authorized_plates = relationship("AuthorizedPlate", back_populates="mine")
    plate_counter_targets = relationship("PlateCounterTarget", back_populates="mine")
    plate_counter_records = relationship("PlateCounterDailyRecord", back_populates="mine")
    plates = relationship("Plate", back_populates="mine")
    fleet_vehicles = relationship("FleetVehicle", back_populates="mine")
    fleet_maintenance_records = relationship("FleetMaintenanceRecord", back_populates="mine")
    fleet_fuel_trip_records = relationship("FleetFuelTripRecord", back_populates="mine")
    factories = relationship("Factory", back_populates="mine")
    shipping_records = relationship("ShippingRecord", back_populates="mine")
    fleet_attendance_records = relationship("FleetAttendanceRecord", back_populates="mine")
    work_logs = relationship("EquipmentWorkLog", back_populates="mine")
    work_hour_sessions = relationship("EquipmentWorkSession", back_populates="mine")


class FleetOrganization(Base):
    __tablename__ = "fleet_organization"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    manager_name = Column(String(200), default="")
    phone = Column(String(100), default="")
    remark = Column(String(500), default="")
    mine_id = Column(String(36), ForeignKey("mine.id", ondelete="SET NULL"), nullable=True)
    active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
    accounts = relationship("MineAccount", back_populates="fleet")
    mine = relationship("Mine")


class MineAccount(Base):
    __tablename__ = "mine_account"
    id = Column(String(36), primary_key=True, default=gen_id)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    role = Column(String(10), nullable=False, default="mine")  # "super", "mine", "user" or "fleet"
    mine_id = Column(String(36), ForeignKey("mine.id", ondelete="SET NULL"), nullable=True)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    active = Column(Integer, default=1)
    must_change_password = Column(Integer, default=0)
    password_changed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="accounts")
    fleet = relationship("FleetOrganization", back_populates="accounts")


class EmailSettings(Base):
    __tablename__ = "email_settings"
    id = Column(String(36), primary_key=True, default="default")
    smtp_host = Column(String(255), default="")
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String(255), default="")
    smtp_password_encrypted = Column(Text, default="")
    sender_email = Column(String(255), default="")
    sender_name = Column(String(200), default="MineOps")
    use_tls = Column(Integer, default=1)
    use_ssl = Column(Integer, default=0)
    enabled = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_code"
    id = Column(String(36), primary_key=True, default=gen_id)
    account_id = Column(String(36), ForeignKey("mine_account.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    __table_args__ = (Index("idx_password_reset_email_created", "email", "created_at"),)


class SecuritySettings(Base):
    __tablename__ = "security_settings"
    id = Column(String(36), primary_key=True, default="default")
    max_login_attempts = Column(Integer, default=5)
    lock_minutes = Column(Integer, default=15)
    password_min_length = Column(Integer, default=8)
    require_mixed_case = Column(Integer, default=0)
    require_number = Column(Integer, default=1)
    session_minutes = Column(Integer, default=480)
    confirm_sensitive_actions = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class LoginAttempt(Base):
    __tablename__ = "login_attempt"
    id = Column(String(36), primary_key=True, default=gen_id)
    username = Column(String(100), default="", index=True)
    ip_address = Column(String(50), default="", index=True)
    success = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now, index=True)


class DataPeriodLock(Base):
    __tablename__ = "data_period_lock"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    module = Column(String(50), nullable=False)
    year_month = Column(String(7), nullable=False)
    locked_by = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.now)
    __table_args__ = (Index("idx_period_lock_unique", "mine_id", "module", "year_month", unique=True),)


class RecycleBinItem(Base):
    __tablename__ = "recycle_bin_item"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=True)
    resource = Column(String(50), nullable=False)
    resource_id = Column(String(36), nullable=False)
    snapshot_json = Column(Text, nullable=False)
    deleted_by = Column(String(100), default="")
    deleted_at = Column(DateTime, default=datetime.now, index=True)
    restored_at = Column(DateTime, nullable=True)
    restored_by = Column(String(100), default="")
class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=True)  # 设备不分矿山，全局共享
    code = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    brand = Column(String(200), default="")
    type = Column(String(100), default="")
    category = Column(String(50), default="", comment="标准化设备类型: 挖掘机/破碎锤/铲车/矿卡/短车/压路机/鹰嘴勾")
    vehicle_num = Column(String(50), default="", comment="车辆编号如 RX01、KL20等")
    short_num = Column(String(20), default="", comment="设备短编号用于智能匹配")
    aliases = Column(String(500), default="", comment="逗号分隔的别名列表")
    status = Column(String(20), default="active", comment="active/deleted 软删除")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    mine = relationship("Mine", back_populates="equipments")
    work_logs = relationship("EquipmentWorkLog", back_populates="equipment")
    work_hour_sessions = relationship("EquipmentWorkSession", back_populates="equipment")
class EquipmentWorkLog(Base):
    __tablename__ = "equipment_work_log"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    equipment_id = Column(String(36), ForeignKey("equipment.id"), nullable=False)
    work_date = Column(Date, nullable=False)
    work_hours = Column(Numeric(8, 2), default=0)
    fuel_liters = Column(Numeric(10, 2), default=0)
    remark = Column(String(500), default="")
    time_detail = Column(String(200), default="", comment="原始时间段文本, 如 7:00-12:00 13:00-18:00")
    raw_text = Column(String(1000), default="", comment="原始录入文本")
    created_by = Column(String(100), default="", comment="录入人")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="work_logs")
    equipment = relationship("Equipment", back_populates="work_logs")
    __table_args__ = (Index("idx_mine_date", "mine_id", "work_date"),)


class EquipmentWorkSession(Base):
    __tablename__ = "equipment_work_session"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    equipment_id = Column(String(36), ForeignKey("equipment.id"), nullable=False)
    operator_account_id = Column(String(36), ForeignKey("mine_account.id"), nullable=False)
    operator_name = Column(String(200), default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_hours = Column(Numeric(8, 2), default=0)
    status = Column(String(20), default="in_progress")
    start_latitude = Column(Numeric(12, 8), nullable=True)
    start_longitude = Column(Numeric(12, 8), nullable=True)
    end_latitude = Column(Numeric(12, 8), nullable=True)
    end_longitude = Column(Numeric(12, 8), nullable=True)
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    mine = relationship("Mine", back_populates="work_hour_sessions")
    equipment = relationship("Equipment", back_populates="work_hour_sessions")
    operator = relationship("MineAccount")
    __table_args__ = (
        Index("idx_work_session_mine_start", "mine_id", "start_time"),
        Index("idx_work_session_operator_status", "operator_account_id", "status"),
    )


class EquipmentMaintenance(Base):
    __tablename__ = "equipment_maintenance"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    equipment_id = Column(String(36), ForeignKey("equipment.id"), nullable=False)
    maintenance_date = Column(Date, nullable=False)
    maintenance_type = Column(String(50), nullable=False)  # 保养/维修/检查/更换
    description = Column(String(500), default="")
    cost = Column(Numeric(12, 2), default=0)
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="pending")  # pending/in_progress/completed
    next_date = Column(Date, nullable=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    mine = relationship("Mine")
    equipment = relationship("Equipment")
    __table_args__ = (
        Index("idx_maint_equip", "equipment_id", "maintenance_date"),
    )
class Employee(Base):
    __tablename__ = "employee"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    name_fr = Column(String(200), nullable=False)
    name_cn = Column(String(200), default="")
    staff_type = Column(String(10), default="", comment="国籍类型: 中方/刚方")
    job = Column(String(200), default="")
    salary = Column(Numeric(12, 2), default=0)
    currency = Column(String(3), default="USD")  # "USD" or "CDF"
    deleted = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="employees")
    attendance_records = relationship("EmployeeAttendance", back_populates="employee")


class EmployeeAttendance(Base):
    __tablename__ = "employee_attendance"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    employee_id = Column(String(36), ForeignKey("employee.id"), nullable=False)
    recorder_account_id = Column(String(36), ForeignKey("mine_account.id"), nullable=False)
    recorder_name = Column(String(200), default="")
    check_in_time = Column(DateTime, nullable=False)
    check_out_time = Column(DateTime, nullable=True)
    duration_hours = Column(Numeric(8, 2), default=0)
    status = Column(String(20), default="checked_in")
    check_in_latitude = Column(Numeric(12, 8), nullable=True)
    check_in_longitude = Column(Numeric(12, 8), nullable=True)
    check_out_latitude = Column(Numeric(12, 8), nullable=True)
    check_out_longitude = Column(Numeric(12, 8), nullable=True)
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    mine = relationship("Mine", back_populates="employee_attendance")
    employee = relationship("Employee", back_populates="attendance_records")
    recorder = relationship("MineAccount")
    __table_args__ = (
        Index("idx_employee_attendance_mine_time", "mine_id", "check_in_time"),
        Index("idx_employee_attendance_employee_status", "employee_id", "status"),
    )
class FinanceRecord(Base):
    __tablename__ = "finance_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    trans_type = Column(String(10), nullable=False)  # "income" or "expense"
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False)  # "USD" or "CDF"
    category = Column(String(200), default="")
    description = Column(String(500), default="")
    recorder = Column(String(200), default="")
    trans_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="finance_records")
    fleet = relationship("FleetOrganization")
class AuthorizedPlate(Base):
    __tablename__ = "authorized_plate"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    plate_number = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="authorized_plates")


class PlateCounterTarget(Base):
    __tablename__ = "plate_counter_target"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    plate_number = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="plate_counter_targets")
    __table_args__ = (Index("idx_plate_counter_target_mine", "mine_id", "plate_number"),)


class PlateCounterDailyRecord(Base):
    __tablename__ = "plate_counter_daily_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    record_date = Column(Date, nullable=False)
    source = Column(String(200), default="")
    counts_json = Column(Text, nullable=False)
    details_json = Column(Text, nullable=False)
    target_plates_json = Column(Text, nullable=False)
    raw_text = Column(Text, default="")
    created_by = Column(String(100), default="")
    saved_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="plate_counter_records")
    fleet = relationship("FleetOrganization")
    __table_args__ = (Index("idx_plate_counter_record_mine_date", "mine_id", "record_date"),)


class Plate(Base):
    __tablename__ = "plate"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    plate_number = Column(String(100), nullable=False)
    vehicle_type = Column(String(100), default="")
    brand = Column(String(100), default="")
    color = Column(String(50), default="")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="plates")
    fleet = relationship("FleetOrganization")


class FleetVehicle(Base):
    __tablename__ = "fleet_vehicle"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    plate_number = Column(String(100), nullable=False)
    driver_name = Column(String(200), default="")
    driver_phone = Column(String(100), default="")
    vehicle_type = Column(String(100), default="")
    brand_model = Column(String(200), default="")
    joined_at = Column(Date, nullable=True)
    insurance_expiry = Column(Date, nullable=True)
    inspection_expiry = Column(Date, nullable=True)
    current_mileage_km = Column(Numeric(12, 2), default=0)
    vehicle_status = Column(String(50), default="在用")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    mine = relationship("Mine", back_populates="fleet_vehicles")
    fleet = relationship("FleetOrganization")
    maintenance_records = relationship("FleetMaintenanceRecord", back_populates="vehicle")
    fuel_trip_records = relationship("FleetFuelTripRecord", back_populates="vehicle")
    __table_args__ = (
        Index("idx_fleet_vehicle_mine_plate", "mine_id", "plate_number"),
        Index("idx_fleet_vehicle_mine_status", "mine_id", "vehicle_status"),
    )


class FleetMaintenanceRecord(Base):
    __tablename__ = "fleet_maintenance_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    vehicle_id = Column(String(36), ForeignKey("fleet_vehicle.id"), nullable=True)
    repair_date = Column(Date, nullable=False)
    plate_number = Column(String(100), nullable=False)
    driver_name = Column(String(200), default="")
    item_name = Column(String(300), default="")
    part_spec = Column(String(200), default="")
    quantity = Column(Numeric(10, 2), default=0)
    unit_price = Column(Numeric(12, 2), default=0)
    amount = Column(Numeric(12, 2), default=0)
    vendor = Column(String(200), default="")
    handler = Column(String(200), default="")
    next_service_mileage_km = Column(Numeric(12, 2), default=0)
    status = Column(String(50), default="")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="fleet_maintenance_records")
    fleet = relationship("FleetOrganization")
    vehicle = relationship("FleetVehicle", back_populates="maintenance_records")
    __table_args__ = (Index("idx_fleet_maintenance_mine_date", "mine_id", "repair_date"),)


class FleetFuelTripRecord(Base):
    __tablename__ = "fleet_fuel_trip_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    vehicle_id = Column(String(36), ForeignKey("fleet_vehicle.id"), nullable=True)
    record_date = Column(Date, nullable=False)
    plate_number = Column(String(100), nullable=False)
    driver_name = Column(String(200), default="")
    start_mileage_km = Column(Numeric(12, 2), default=0)
    end_mileage_km = Column(Numeric(12, 2), default=0)
    distance_km = Column(Numeric(12, 2), default=0)
    fuel_liters = Column(Numeric(12, 2), default=0)
    fuel_unit_price = Column(Numeric(12, 2), default=0)
    fuel_amount = Column(Numeric(12, 2), default=0)
    trip_count = Column(Integer, default=0)
    avg_distance_per_trip = Column(Numeric(12, 2), default=0)
    fuel_consumption_l100km = Column(Numeric(12, 2), default=0)
    station = Column(String(200), default="")
    fuel_card_no = Column(String(200), default="")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="fleet_fuel_trip_records")
    fleet = relationship("FleetOrganization")
    vehicle = relationship("FleetVehicle", back_populates="fuel_trip_records")
    __table_args__ = (Index("idx_fleet_fuel_mine_date", "mine_id", "record_date"),)
class Factory(Base):
    __tablename__ = "factory"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="factories")
    fleet = relationship("FleetOrganization")
    shipping_records = relationship("ShippingRecord", back_populates="factory")
class AuditLog(Base):
    """操作审计日志"""
    __tablename__ = "audit_log"
    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), index=True, nullable=False)
    username = Column(String(100), default="")
    action = Column(String(50), nullable=False)  # CREATE/UPDATE/DELETE/EXPORT/IMPORT/LOGIN
    resource = Column(String(50), nullable=False)  # 模块名: Equipment/Mine/Finance/etc
    resource_id = Column(String(36), default="")
    detail = Column(String(1000), default="")  # 操作详情
    ip_address = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.now, index=True)


class ShippingRecord(Base):
    __tablename__ = "shipping_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    plate_number = Column(String(100), nullable=False)
    load_time = Column(DateTime, nullable=False)
    factory_id = Column(String(36), ForeignKey("factory.id"), nullable=False)
    cargo_type = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="shipping_records")
    fleet = relationship("FleetOrganization")
    factory = relationship("Factory", back_populates="shipping_records")


class FleetAttendanceRecord(Base):
    """车队修理工/司机签到打卡记录"""
    __tablename__ = "fleet_attendance"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    staff_name = Column(String(200), nullable=False)
    staff_role = Column(String(50), default="司机", comment="driver/mechanic 司机/修理工")
    check_in_time = Column(DateTime, nullable=False)
    check_out_time = Column(DateTime, nullable=True)
    duration_hours = Column(Numeric(10, 2), default=0)
    status = Column(String(50), default="checked_in", comment="checked_in/checked_out")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="fleet_attendance_records")
    fleet = relationship("FleetOrganization")
    __table_args__ = (
        Index("idx_fleet_attendance_mine_time", "mine_id", "check_in_time"),
        Index("idx_fleet_attendance_fleet_time", "fleet_id", "check_in_time"),
    )


class FleetStaff(Base):
    """车队人员花名册（司机/修理工，用于签到下拉选择）"""
    __tablename__ = "fleet_staff"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    fleet_id = Column(String(36), ForeignKey("fleet_organization.id", ondelete="SET NULL"), nullable=True)
    staff_name = Column(String(200), nullable=False)
    staff_role = Column(String(50), default="司机")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine")
    fleet = relationship("FleetOrganization")
    __table_args__ = (
        Index("idx_fleet_staff_mine", "mine_id"),
        Index("idx_fleet_staff_fleet", "fleet_id"),
    )
