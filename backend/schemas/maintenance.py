from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class MaintenanceCreate(BaseModel):
    equipment_id: str
    maintenance_date: date
    maintenance_type: str  # 保养/维修/检查/更换
    description: Optional[str] = ""
    cost: Optional[float] = 0
    currency: Optional[str] = "USD"
    status: Optional[str] = "pending"  # pending/in_progress/completed
    next_date: Optional[date] = None
    mine_id: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    next_date: Optional[date] = None


class MaintenanceOut(BaseModel):
    id: str
    equipment_id: str
    equipment_code: Optional[str] = ""
    equipment_name: Optional[str] = ""
    mine_id: str
    maintenance_date: str
    maintenance_type: str
    description: Optional[str] = ""
    cost: Optional[float] = 0
    currency: Optional[str] = "USD"
    status: Optional[str] = "pending"
    next_date: Optional[str] = None
    created_by: Optional[str] = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaintenanceStats(BaseModel):
    total_count: int
    completed_count: int
    pending_count: int
    total_cost: float
    by_type: dict = {}
    next_due: list = []
