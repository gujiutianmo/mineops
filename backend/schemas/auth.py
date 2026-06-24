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
    email: Optional[str] = None
    role: str
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None
    active: Optional[int] = None


class UserProfileUpdate(BaseModel):
    display_name: str


class AccountSettingsUpdate(BaseModel):
    username: str
    display_name: str
    email: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    email: str
    code: str
    new_password: str


class EmailSettingsUpdate(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: Optional[str] = ""
    smtp_password: Optional[str] = ""
    sender_email: str
    sender_name: Optional[str] = "MineOps"
    use_tls: bool = True
    use_ssl: bool = False
    enabled: bool = True


class EmailTestRequest(BaseModel):
    recipient: str


class UserOut(UserBase):
    id: str
    active: int
    must_change_password: int = 0
    password_changed_at: Optional[datetime] = None
    created_at: datetime
    mine_name: Optional[str] = None
    fleet_name: Optional[str] = None

    class Config:
        from_attributes = True
