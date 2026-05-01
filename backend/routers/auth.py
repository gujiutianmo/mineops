from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import MineAccount
from database import get_db
from auth import authenticate_user, create_access_token, get_password_hash, get_current_active_user
from schemas.auth import UserCreate, UserOut, LoginRequest

router = APIRouter()


@router.post("/login")
async def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=480)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "mine_id": user.mine_id,
        "display_name": user.display_name
    }


@router.post("/register", response_model=UserOut)
async def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(MineAccount).filter(MineAccount.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已被注册")
    db_user = MineAccount(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        display_name=user_in.display_name,
        role=user_in.role,
        mine_id=user_in.mine_id,
        active=1
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: MineAccount = Depends(get_current_active_user)):
    return current_user
