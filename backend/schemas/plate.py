from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PlateBase(BaseModel):
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None
    plate_number: str
    vehicle_type: Optional[str] = ""
    brand: Optional[str] = ""
    color: Optional[str] = ""
    remark: Optional[str] = ""

class PlateCreate(PlateBase):
    pass

class PlateUpdate(BaseModel):
    plate_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    remark: Optional[str] = None
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None

class PlateOut(PlateBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
