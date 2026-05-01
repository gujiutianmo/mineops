import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Numeric, Integer, DateTime, Date, ForeignKey, Index
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
    finance_records = relationship("FinanceRecord", back_populates="mine")
    authorized_plates = relationship("AuthorizedPlate", back_populates="mine")
    plates = relationship("Plate", back_populates="mine")
    factories = relationship("Factory", back_populates="mine")
    shipping_records = relationship("ShippingRecord", back_populates="mine")
    work_logs = relationship("EquipmentWorkLog", back_populates="mine")
class MineAccount(Base):
    __tablename__ = "mine_account"
    id = Column(String(36), primary_key=True, default=gen_id)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(200), nullable=False)
    role = Column(String(10), nullable=False, default="mine")  # "super" or "mine"
    mine_id = Column(String(36), ForeignKey("mine.id", ondelete="SET NULL"), nullable=True)
    active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="accounts")
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
class FinanceRecord(Base):
    __tablename__ = "finance_record"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    trans_type = Column(String(10), nullable=False)  # "income" or "expense"
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False)  # "USD" or "CDF"
    category = Column(String(200), default="")
    description = Column(String(500), default="")
    recorder = Column(String(200), default="")
    trans_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="finance_records")
class AuthorizedPlate(Base):
    __tablename__ = "authorized_plate"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    plate_number = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="authorized_plates")

class Plate(Base):
    __tablename__ = "plate"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    plate_number = Column(String(100), nullable=False)
    vehicle_type = Column(String(100), default="")
    brand = Column(String(100), default="")
    color = Column(String(50), default="")
    remark = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="plates")
class Factory(Base):
    __tablename__ = "factory"
    id = Column(String(36), primary_key=True, default=gen_id)
    mine_id = Column(String(36), ForeignKey("mine.id"), nullable=False)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="factories")
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
    plate_number = Column(String(100), nullable=False)
    load_time = Column(DateTime, nullable=False)
    factory_id = Column(String(36), ForeignKey("factory.id"), nullable=False)
    cargo_type = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.now)
    mine = relationship("Mine", back_populates="shipping_records")
    factory = relationship("Factory", back_populates="shipping_records")
