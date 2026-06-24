from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class EquipmentBase(BaseModel):
    mine_id: Optional[str] = None
    code: str
    name: str
    brand: Optional[str] = ""
    type: Optional[str] = ""
    category: Optional[str] = ""
    vehicle_num: Optional[str] = ""
    short_num: Optional[str] = ""
    aliases: Optional[str] = ""

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    vehicle_num: Optional[str] = None
    short_num: Optional[str] = None
    aliases: Optional[str] = None
    status: Optional[str] = None

class EquipmentOut(EquipmentBase):
    id: str
    status: Optional[str] = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# ========== Smart Parse Schemas ==========

class ParseRequest(BaseModel):
    text: str
    parse_type: str = "work"  # "work" or "fuel"
    mine_id: Optional[str] = None

class ParsedRecord(BaseModel):
    date: str
    dev_id: Optional[str] = ""
    dev_name: Optional[str] = ""
    duration: float = 0
    fuel: float = 0
    time_detail: str = ""
    memo: str = ""
    raw_text: str = ""
    confidence: Optional[str] = ""

class ParseResponse(BaseModel):
    records: list
    parse_type: str
    total: int

class BatchFuelRequest(BaseModel):
    mine_id: str
    date: str
    fuel: float
    equipment_ids: list
    memo: Optional[str] = ""

class WorkLogOut(BaseModel):
    id: str
    equipment_id: str
    equipment_code: Optional[str] = ""
    equipment_name: Optional[str] = ""
    work_date: str
    work_hours: float = 0
    fuel_liters: float = 0
    remark: str = ""
    time_detail: str = ""
    raw_text: str = ""
    created_by: str = ""
    created_at: datetime
    class Config:
        from_attributes = True

class WorkLogCreate(BaseModel):
    mine_id: Optional[str] = None
    equipment_id: str
    work_date: date
    work_hours: float = 0
    fuel_liters: float = 0
    remark: Optional[str] = ""
    time_detail: Optional[str] = ""
    raw_text: Optional[str] = ""
    shift: Optional[str] = ""
    strict_time: bool = False

class WorkLogUpdate(BaseModel):
    work_hours: Optional[float] = None
    fuel_liters: Optional[float] = None
    remark: Optional[str] = None
    time_detail: Optional[str] = None
