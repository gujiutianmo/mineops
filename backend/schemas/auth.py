from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserBase(BaseModel):
    username: str
    display_name: str
    role: str
    mine_id: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: str
    active: int
    created_at: datetime

    class Config:
        from_attributes = True
