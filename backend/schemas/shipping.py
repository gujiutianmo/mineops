from pydantic import BaseModel
from typing import Optional
from datetime import datetime
class ShippingBase(BaseModel):
    mine_id: str
    plate_number: str
    load_time: datetime
    factory_id: str
    cargo_type: Optional[str] = ""
class ShippingCreate(ShippingBase):
    pass
class ShippingUpdate(BaseModel):
    plate_number: Optional[str] = None
    load_time: Optional[datetime] = None
    factory_id: Optional[str] = None
    cargo_type: Optional[str] = None
class ShippingOut(ShippingBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True
