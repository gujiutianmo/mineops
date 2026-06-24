from datetime import datetime, timedelta
import hashlib
import hmac
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from models import AuditLog, EmailSettings, FleetOrganization, LoginAttempt, Mine, MineAccount, PasswordResetCode, SecuritySettings
from database import get_db
from auth import authenticate_user, create_access_token, get_password_hash, get_current_active_user, verify_password
from config import settings
from schemas.auth import (
    AccountSettingsUpdate, EmailSettingsUpdate, EmailTestRequest, LoginRequest, PasswordChange,
    PasswordResetConfirm, PasswordResetRequest, UserCreate, UserOut,
    UserProfileUpdate, UserUpdate,
)
from services.email_service import encrypt_password, send_email

router = APIRouter()

ACCOUNT_ROLES = {"super", "mine", "user", "fleet"}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
RESET_CODE_TTL_MINUTES = 10
RESET_CODE_MAX_ATTEMPTS = 5


def _account_to_out(account: MineAccount):
    return {
        "id": account.id,
        "username": account.username,
        "display_name": account.display_name,
        "email": account.email,
        "role": account.role,
        "mine_id": account.mine_id,
        "mine_name": account.mine.name if account.mine else None,
        "fleet_id": account.fleet_id,
        "fleet_name": account.fleet.name if account.fleet else None,
        "active": account.active,
        "must_change_password": account.must_change_password or 0,
        "password_changed_at": account.password_changed_at,
        "created_at": account.created_at,
    }


def _clean_required_text(value: str, field_name: str, max_length: int):
    text = (value or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_name}不能为空")
    if len(text) > max_length:
        raise HTTPException(status_code=400, detail=f"{field_name}不能超过 {max_length} 个字符")
    return text


def _normalize_email(value: Optional[str], required: bool = False) -> Optional[str]:
    email = (value or "").strip().lower()
    if not email:
        if required:
            raise HTTPException(status_code=400, detail="请输入邮箱地址")
        return None
    if len(email) > 255 or not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="邮箱地址格式不正确")
    return email


def _ensure_email_available(db: Session, email: Optional[str], account_id: Optional[str] = None):
    if not email:
        return
    query = db.query(MineAccount).filter(func.lower(MineAccount.email) == email)
    if account_id:
        query = query.filter(MineAccount.id != account_id)
    if query.first():
        raise HTTPException(status_code=400, detail="该邮箱已绑定其他账户")


def _require_super(current_user: MineAccount):
    if current_user.role != "super":
        raise HTTPException(status_code=403, detail="只有超级管理员可以配置系统邮箱")


def _get_email_settings(db: Session) -> EmailSettings:
    config = db.query(EmailSettings).filter(EmailSettings.id == "default").first()
    if not config:
        config = EmailSettings(id="default")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _get_security_settings(db: Session) -> SecuritySettings:
    config = db.query(SecuritySettings).filter(SecuritySettings.id == "default").first()
    if not config:
        config = SecuritySettings(id="default")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _validate_password(db: Session, password: str, label: str = "密码"):
    config = _get_security_settings(db)
    value = password or ""
    if len(value) < int(config.password_min_length or 8):
        raise HTTPException(status_code=400, detail=f"{label}至少需要 {config.password_min_length or 8} 位")
    if int(config.require_number or 0) and not re.search(r"\d", value):
        raise HTTPException(status_code=400, detail=f"{label}必须包含数字")
    if int(config.require_mixed_case or 0) and not (re.search(r"[a-z]", value) and re.search(r"[A-Z]", value)):
        raise HTTPException(status_code=400, detail=f"{label}必须同时包含大写和小写字母")
    return config


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "")


def _audit_login(db: Session, user, username: str, success: bool, ip_address: str):
    db.add(AuditLog(
        user_id=user.id if user else "anonymous",
        username=user.username if user else username,
        action="LOGIN" if success else "LOGIN_FAILED",
        resource="auth",
        detail="登录成功" if success else "用户名或密码错误",
        ip_address=ip_address[:50],
    ))


def _reset_code_hash(account_id: str, code: str) -> str:
    return hmac.new(
        settings.JWT_SECRET.encode("utf-8"),
        f"{account_id}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _require_account_manager(current_user: MineAccount):
    if current_user.role not in {"super", "mine", "fleet"}:
        raise HTTPException(status_code=403, detail="只有超级管理员或矿山子管理员可以管理用户")


def _validate_role(role: str):
    role = (role or "").strip()
    if role not in ACCOUNT_ROLES:
        raise HTTPException(status_code=400, detail="账户角色不正确")
    return role


def _resolve_mine_id_for_role(
    db: Session,
    role: str,
    requested_mine_id: Optional[str],
    current_user: MineAccount,
):
    if role in {"super", "fleet"}:
        return None

    if current_user.role == "mine":
        if not current_user.mine_id:
            raise HTTPException(status_code=400, detail="当前矿山账户未绑定矿山")
        return current_user.mine_id

    if not requested_mine_id:
        raise HTTPException(status_code=400, detail="请选择所属矿山")

    mine = db.query(Mine).filter(Mine.id == requested_mine_id).first()
    if not mine:
        raise HTTPException(status_code=400, detail="所属矿山不存在")
    return requested_mine_id


def _resolve_fleet_id_for_role(
    db: Session,
    role: str,
    requested_fleet_id: Optional[str],
    current_user: MineAccount,
):
    if role != "fleet":
        return None
    if current_user.role == "fleet":
        if not current_user.fleet_id:
            raise HTTPException(status_code=400, detail="Current fleet account is not bound to a fleet")
        return current_user.fleet_id
    if current_user.role != "super":
        raise HTTPException(status_code=403, detail="Only super admin can create fleet accounts")
    if not requested_fleet_id:
        raise HTTPException(status_code=400, detail="Please select a fleet organization")
    fleet = db.query(FleetOrganization).filter(
        FleetOrganization.id == requested_fleet_id,
        FleetOrganization.active == 1,
    ).first()
    if not fleet:
        raise HTTPException(status_code=400, detail="Fleet organization does not exist or is disabled")
    return requested_fleet_id


def _get_manageable_account(db: Session, user_id: str, current_user: MineAccount):
    _require_account_manager(current_user)
    account = db.query(MineAccount).filter(MineAccount.id == user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="用户不存在")

    if current_user.role == "mine":
        if account.mine_id != current_user.mine_id or account.role == "super":
            raise HTTPException(status_code=403, detail="只能查看本矿山用户")
    if current_user.role == "fleet":
        if account.fleet_id != current_user.fleet_id or account.role != "fleet":
            raise HTTPException(status_code=403, detail="Permission denied")
    return account


def _ensure_can_modify_account(target: MineAccount, current_user: MineAccount):
    _require_account_manager(current_user)
    if current_user.role == "mine":
        if target.mine_id != current_user.mine_id or target.role != "user":
            raise HTTPException(status_code=403, detail="矿山子管理员只能管理本矿山子用户")

    if current_user.role == "fleet":
        if target.fleet_id != current_user.fleet_id or target.role != "fleet":
            raise HTTPException(status_code=403, detail="Fleet manager can only manage accounts in this fleet")


def _ensure_super_not_last(db: Session, target: MineAccount, next_active: int):
    if target.role != "super" or next_active == 1:
        return
    active_super_count = db.query(MineAccount).filter(
        MineAccount.role == "super",
        MineAccount.active == 1,
    ).count()
    if active_super_count <= 1:
        raise HTTPException(status_code=400, detail="不能停用最后一个超级管理员")


@router.post("/login")
async def login(form_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    security_config = _get_security_settings(db)
    ip_address = _client_ip(request)
    username = (form_data.username or "").strip()
    lock_since = datetime.now() - timedelta(minutes=int(security_config.lock_minutes or 15))
    failed_count = db.query(LoginAttempt).filter(
        LoginAttempt.username == username,
        LoginAttempt.ip_address == ip_address,
        LoginAttempt.success == 0,
        LoginAttempt.created_at >= lock_since,
    ).count()
    if failed_count >= int(security_config.max_login_attempts or 5):
        raise HTTPException(status_code=429, detail=f"登录失败次数过多，请 {security_config.lock_minutes or 15} 分钟后重试")
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        db.add(LoginAttempt(username=username, ip_address=ip_address, success=0))
        _audit_login(db, None, username, False, ip_address)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.active != 1:
        raise HTTPException(status_code=403, detail="账户已停用")
    db.query(LoginAttempt).filter(
        LoginAttempt.username == username,
        LoginAttempt.ip_address == ip_address,
        LoginAttempt.success == 0,
    ).delete(synchronize_session=False)
    db.add(LoginAttempt(username=username, ip_address=ip_address, success=1))
    _audit_login(db, user, username, True, ip_address)
    db.commit()
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=int(security_config.session_minutes or 480))
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "mine_id": user.mine_id,
        "mine_name": user.mine.name if user.mine else None,
        "fleet_id": user.fleet_id,
        "fleet_name": user.fleet.name if user.fleet else None,
        "display_name": user.display_name,
        "email": user.email,
        "must_change_password": bool(user.must_change_password),
    }


@router.post("/password-reset/request")
async def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email, required=True)
    config = _get_email_settings(db)
    if not int(config.enabled or 0) or not config.smtp_host or not config.sender_email:
        raise HTTPException(status_code=503, detail="系统邮箱尚未配置，请联系超级管理员")

    account = db.query(MineAccount).filter(
        func.lower(MineAccount.email) == email,
        MineAccount.active == 1,
    ).first()
    generic = {"message": "如果该邮箱已绑定账户，验证码已发送，有效期 10 分钟"}
    if not account:
        return generic

    recent = db.query(PasswordResetCode).filter(
        PasswordResetCode.account_id == account.id,
        PasswordResetCode.created_at >= datetime.now() - timedelta(seconds=60),
    ).first()
    if recent:
        return generic

    db.query(PasswordResetCode).filter(
        PasswordResetCode.account_id == account.id,
        PasswordResetCode.used == 0,
    ).update({PasswordResetCode.used: 1}, synchronize_session=False)
    code = f"{secrets.randbelow(1000000):06d}"
    reset = PasswordResetCode(
        account_id=account.id,
        email=email,
        code_hash=_reset_code_hash(account.id, code),
        expires_at=datetime.now() + timedelta(minutes=RESET_CODE_TTL_MINUTES),
    )
    db.add(reset)
    db.commit()
    try:
        send_email(
            config,
            email,
            "MineOps 密码重置验证码",
            f"您好，{account.display_name or account.username}：\n\n"
            f"您的 MineOps 密码重置验证码是：{code}\n"
            f"验证码 {RESET_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。\n\n"
            "如果不是您本人操作，请忽略此邮件。",
        )
    except Exception:
        reset.used = 1
        db.commit()
        raise HTTPException(status_code=502, detail="邮件发送失败，请联系管理员检查系统邮箱配置")
    return generic


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email, required=True)
    code = (payload.code or "").strip()
    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=400, detail="请输入 6 位验证码")
    _validate_password(db, payload.new_password, "新密码")

    account = db.query(MineAccount).filter(
        func.lower(MineAccount.email) == email,
        MineAccount.active == 1,
    ).first()
    if not account:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    reset = db.query(PasswordResetCode).filter(
        PasswordResetCode.account_id == account.id,
        PasswordResetCode.used == 0,
    ).order_by(PasswordResetCode.created_at.desc()).first()
    if not reset or reset.expires_at < datetime.now() or reset.attempts >= RESET_CODE_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    if not hmac.compare_digest(reset.code_hash, _reset_code_hash(account.id, code)):
        reset.attempts += 1
        if reset.attempts >= RESET_CODE_MAX_ATTEMPTS:
            reset.used = 1
        db.commit()
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    account.password_hash = get_password_hash(payload.new_password)
    account.must_change_password = 0
    account.password_changed_at = datetime.now()
    reset.used = 1
    db.commit()
    return {"message": "密码已重置，请使用新密码登录"}


@router.get("/email-settings")
async def get_email_settings(
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_super(current_user)
    config = _get_email_settings(db)
    return {
        "smtp_host": config.smtp_host or "",
        "smtp_port": config.smtp_port or 587,
        "smtp_username": config.smtp_username or "",
        "password_configured": bool(config.smtp_password_encrypted),
        "sender_email": config.sender_email or "",
        "sender_name": config.sender_name or "MineOps",
        "use_tls": bool(config.use_tls),
        "use_ssl": bool(config.use_ssl),
        "enabled": bool(config.enabled),
        "updated_at": config.updated_at,
    }


@router.put("/email-settings")
async def update_email_settings(
    payload: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_super(current_user)
    if payload.smtp_port < 1 or payload.smtp_port > 65535:
        raise HTTPException(status_code=400, detail="SMTP 端口不正确")
    sender_email = _normalize_email(payload.sender_email, required=True)
    config = _get_email_settings(db)
    config.smtp_host = _clean_required_text(payload.smtp_host, "SMTP 服务器", 255)
    config.smtp_port = payload.smtp_port
    config.smtp_username = (payload.smtp_username or "").strip()
    if payload.smtp_password:
        config.smtp_password_encrypted = encrypt_password(payload.smtp_password)
    config.sender_email = sender_email
    config.sender_name = (payload.sender_name or "MineOps").strip() or "MineOps"
    config.use_tls = 1 if payload.use_tls else 0
    config.use_ssl = 1 if payload.use_ssl else 0
    config.enabled = 1 if payload.enabled else 0
    config.updated_at = datetime.now()
    db.commit()
    return {"message": "邮箱配置已保存", "password_configured": bool(config.smtp_password_encrypted)}


@router.post("/email-settings/test")
async def test_email_settings(
    payload: EmailTestRequest,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_super(current_user)
    recipient = _normalize_email(payload.recipient, required=True)
    config = _get_email_settings(db)
    if not config.smtp_host or not config.sender_email:
        raise HTTPException(status_code=400, detail="请先保存完整的邮箱配置")
    try:
        send_email(config, recipient, "MineOps 邮箱配置测试", "这是一封 MineOps 系统邮箱测试邮件。收到此邮件表示 SMTP 配置正常。")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"测试邮件发送失败：{str(error)}")
    return {"message": "测试邮件已发送"}


@router.post("/register", response_model=UserOut)
async def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_super(current_user)
    existing = db.query(MineAccount).filter(MineAccount.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已被注册")
    email = _normalize_email(user_in.email)
    _ensure_email_available(db, email)
    _validate_password(db, user_in.password)
    role = _validate_role(user_in.role)
    db_user = MineAccount(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        display_name=user_in.display_name,
        email=email,
        role=role,
        mine_id=_resolve_mine_id_for_role(db, role, user_in.mine_id, current_user),
        fleet_id=_resolve_fleet_id_for_role(db, role, user_in.fleet_id, current_user),
        active=1,
        must_change_password=1,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return _account_to_out(db_user)


@router.get("/users", response_model=List[UserOut])
async def list_users(
    mine_id: Optional[str] = None,
    fleet_id: Optional[str] = None,
    role: Optional[str] = None,
    active: Optional[int] = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_account_manager(current_user)
    query = db.query(MineAccount)

    if current_user.role == "mine":
        query = query.filter(MineAccount.mine_id == current_user.mine_id, MineAccount.role != "super")
    elif current_user.role == "fleet":
        query = query.filter(MineAccount.fleet_id == current_user.fleet_id, MineAccount.role == "fleet")
    elif fleet_id:
        query = query.filter(MineAccount.fleet_id == fleet_id)
    elif mine_id:
        query = query.filter(MineAccount.mine_id == mine_id)

    if role:
        query = query.filter(MineAccount.role == _validate_role(role))
    if active is not None:
        query = query.filter(MineAccount.active == (1 if int(active) == 1 else 0))

    accounts = query.order_by(MineAccount.created_at.desc()).offset(skip).limit(limit).all()
    return [_account_to_out(account) for account in accounts]


@router.post("/users", response_model=UserOut)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    _require_account_manager(current_user)

    username = _clean_required_text(user_in.username, "用户名", 100)
    display_name = _clean_required_text(user_in.display_name, "显示名称", 200)
    email = _normalize_email(user_in.email)
    _ensure_email_available(db, email)
    role = _validate_role(user_in.role or "user")

    if current_user.role == "mine" and role != "user":
        raise HTTPException(status_code=403, detail="矿山子管理员只能新增子用户")
    _validate_password(db, user_in.password)

    if current_user.role == "fleet" and role != "fleet":
        raise HTTPException(status_code=403, detail="Fleet managers can only create fleet accounts")

    existing = db.query(MineAccount).filter(MineAccount.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已被注册")

    db_user = MineAccount(
        username=username,
        password_hash=get_password_hash(user_in.password),
        display_name=display_name,
        email=email,
        role=role,
        mine_id=_resolve_mine_id_for_role(db, role, user_in.mine_id, current_user),
        fleet_id=_resolve_fleet_id_for_role(db, role, user_in.fleet_id, current_user),
        active=1,
        must_change_password=1,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return _account_to_out(db_user)


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    account = _get_manageable_account(db, user_id, current_user)
    return _account_to_out(account)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    account = _get_manageable_account(db, user_id, current_user)
    _ensure_can_modify_account(account, current_user)

    data = payload.model_dump(exclude_unset=True)
    if "username" in data and data["username"] is not None:
        username = _clean_required_text(data["username"], "用户名", 100)
        existing = db.query(MineAccount).filter(
            MineAccount.username == username,
            MineAccount.id != account.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已被注册")
        account.username = username

    if "display_name" in data and data["display_name"] is not None:
        account.display_name = _clean_required_text(data["display_name"], "显示名称", 200)

    if "email" in data:
        email = _normalize_email(data["email"])
        _ensure_email_available(db, email, account.id)
        account.email = email

    if "password" in data and data["password"]:
        _validate_password(db, data["password"])
        account.password_hash = get_password_hash(data["password"])
        account.must_change_password = 1

    next_role = account.role
    if "role" in data and data["role"] is not None:
        next_role = _validate_role(data["role"])
        if current_user.role == "mine" and next_role != "user":
            raise HTTPException(status_code=403, detail="矿山子管理员只能管理子用户")
        if current_user.role == "fleet" and next_role != "fleet":
            raise HTTPException(status_code=403, detail="Fleet managers can only manage fleet accounts")
        if account.id == current_user.id and next_role != account.role:
            raise HTTPException(status_code=400, detail="不能修改自己的角色")

    if "mine_id" in data or next_role != account.role:
        account.mine_id = _resolve_mine_id_for_role(db, next_role, data.get("mine_id", account.mine_id), current_user)
    if "fleet_id" in data or next_role != account.role:
        account.fleet_id = _resolve_fleet_id_for_role(db, next_role, data.get("fleet_id", account.fleet_id), current_user)
    if account.role == "super" and next_role != "super":
        _ensure_super_not_last(db, account, 0)
    account.role = next_role

    if "active" in data and data["active"] is not None:
        next_active = 1 if int(data["active"]) == 1 else 0
        if account.id == current_user.id and next_active == 0:
            raise HTTPException(status_code=400, detail="不能停用自己的账户")
        _ensure_super_not_last(db, account, next_active)
        account.active = next_active

    db.commit()
    db.refresh(account)
    return _account_to_out(account)


@router.delete("/users/{user_id}")
async def disable_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    account = _get_manageable_account(db, user_id, current_user)
    _ensure_can_modify_account(account, current_user)
    if account.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能停用自己的账户")
    _ensure_super_not_last(db, account, 0)
    account.active = 0
    db.commit()
    return {"message": "用户已停用"}


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: MineAccount = Depends(get_current_active_user)):
    return _account_to_out(current_user)


@router.put("/me", response_model=UserOut)
async def update_users_me(
    profile: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user)
):
    display_name = profile.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="账户名称不能为空")
    if len(display_name) > 200:
        raise HTTPException(status_code=400, detail="账户名称不能超过 200 个字符")
    current_user.display_name = display_name
    db.commit()
    db.refresh(current_user)
    return _account_to_out(current_user)


@router.put("/me/account")
async def update_account_settings(
    payload: AccountSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user),
):
    username = _clean_required_text(payload.username, "用户名", 100)
    display_name = _clean_required_text(payload.display_name, "显示名称", 200)
    email = _normalize_email(payload.email)

    existing_username = db.query(MineAccount).filter(
        func.lower(MineAccount.username) == username.lower(),
        MineAccount.id != current_user.id,
    ).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="用户名已被其他账户使用")
    _ensure_email_available(db, email, current_user.id)

    current_user.username = username
    current_user.display_name = display_name
    current_user.email = email
    db.commit()
    db.refresh(current_user)
    access_token = create_access_token(
        data={"sub": current_user.username}, expires_delta=timedelta(minutes=480)
    )
    return {
        **_account_to_out(current_user),
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/change-password")
async def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: MineAccount = Depends(get_current_active_user)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    _validate_password(db, payload.new_password, "新密码")
    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")
    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.must_change_password = 0
    current_user.password_changed_at = datetime.now()
    db.commit()
    return {"message": "密码已更新"}
