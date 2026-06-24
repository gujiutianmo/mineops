from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from enum import Enum
class TransTypeEnum(str, Enum):
    income = "income"
    expense = "expense"
class CurrencyEnum(str, Enum):
    USD = "USD"
    CDF = "CDF"
class FinanceBase(BaseModel):
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None
    trans_type: TransTypeEnum
    amount: float
    currency: CurrencyEnum
    category: Optional[str] = ""
    description: Optional[str] = ""
    recorder: Optional[str] = ""
    trans_date: date
class FinanceCreate(FinanceBase):
    pass
class FinanceUpdate(BaseModel):
    trans_type: Optional[TransTypeEnum] = None
    amount: Optional[float] = None
    currency: Optional[CurrencyEnum] = None
    category: Optional[str] = None
    description: Optional[str] = None
    recorder: Optional[str] = None
    trans_date: Optional[date] = None
class FinanceOut(FinanceBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True
