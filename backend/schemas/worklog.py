from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
class WorkLogBase(BaseModel):
    mine_id: str
    equipment_id: str
    work_date: date
    work_hours: Optional[float] = 0
    fuel_liters: Optional[float] = 0
    remark: Optional[str] = ""
class WorkLogCreate(WorkLogBase):
    pass
class WorkLogUpdate(BaseModel):
    work_date: Optional[date] = None
    work_hours: Optional[float] = None
    fuel_liters: Optional[float] = None
    remark: Optional[str] = None
class WorkLogOut(WorkLogBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True
