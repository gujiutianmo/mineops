from pydantic import BaseModel
from typing import Optional
from datetime import datetime
class MineBase(BaseModel):
    name: str
class MineCreate(MineBase):
    # Optional sub-account fields
    create_account: Optional[bool] = False
    account_username: Optional[str] = None
    account_password: Optional[str] = None
    account_display_name: Optional[str] = None
class MineUpdate(BaseModel):
    name: Optional[str] = None
class MineOut(MineBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True
