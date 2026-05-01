from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum
class CurrencyEnum(str, Enum):
    USD = "USD"
    CDF = "CDF"

class StaffTypeEnum(str, Enum):
    chinese = "中方"
    congolese = "刚方"

class EmployeeBase(BaseModel):
    mine_id: str
    name_fr: str
    name_cn: Optional[str] = ""
    staff_type: Optional[StaffTypeEnum] = None
    job: Optional[str] = ""
    salary: Optional[float] = 0
    currency: Optional[CurrencyEnum] = CurrencyEnum.USD

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name_fr: Optional[str] = None
    name_cn: Optional[str] = None
    staff_type: Optional[StaffTypeEnum] = None
    job: Optional[str] = None
    salary: Optional[float] = None
    currency: Optional[CurrencyEnum] = None
    deleted: Optional[int] = None
class EmployeeOut(EmployeeBase):
    id: str
    deleted: int
    created_at: datetime
    class Config:
        from_attributes = True
