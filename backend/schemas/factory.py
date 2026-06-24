from pydantic import BaseModel
from typing import Optional
from datetime import datetime
class FactoryBase(BaseModel):
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None
    name: str
class FactoryCreate(FactoryBase):
    pass
class FactoryUpdate(BaseModel):
    name: Optional[str] = None
    fleet_id: Optional[str] = None
class FactoryOut(FactoryBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True
