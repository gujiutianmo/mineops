from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Mine, MineAccount, Equipment, EquipmentWorkLog, Employee, FinanceRecord, AuthorizedPlate, Plate, Factory, ShippingRecord
from schemas.mine import MineCreate, MineUpdate, MineOut
from auth import get_current_active_user, get_password_hash
from utils.permissions import require_super_admin
from utils.crud_helpers import get_object_or_404

router = APIRouter()

MINE_FIELDS = ["name"]

# Related models that reference Mine via mine_id FK (for cascade delete)
MINE_RELATED_MODELS = [
    MineAccount, EquipmentWorkLog, FinanceRecord, Employee,
    AuthorizedPlate, Plate, ShippingRecord, Factory, Equipment
]


@router.get("/", response_model=List[MineOut])
def read_mines(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    require_super_admin(current_user)
    return db.query(Mine).offset(skip).limit(limit).all()


@router.post("/", response_model=MineOut)
def create_mine(
    mine: MineCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    require_super_admin(current_user)
    db_mine = Mine(name=mine.name)
    db.add(db_mine)
    db.flush()  # get the mine id without committing yet

    # Create sub-account if requested
    if mine.create_account and mine.account_username and mine.account_password:
        # Check if username already exists
        existing = db.query(MineAccount).filter(
            MineAccount.username == mine.account_username
        ).first()
        if existing:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"用户名 '{mine.account_username}' 已存在")

        db_account = MineAccount(
            username=mine.account_username,
            password_hash=get_password_hash(mine.account_password),
            display_name=mine.account_display_name or mine.name,
            role="mine",
            mine_id=db_mine.id
        )
        db.add(db_account)

    db.commit()
    db.refresh(db_mine)
    return db_mine


@router.get("/{mine_id}", response_model=MineOut)
def read_mine(
    mine_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return get_object_or_404(db, Mine, mine_id)


@router.put("/{mine_id}", response_model=MineOut)
def update_mine(
    mine_id: str,
    mine_update: MineUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    require_super_admin(current_user)
    db_mine = get_object_or_404(db, Mine, mine_id)
    for field in MINE_FIELDS:
        val = getattr(mine_update, field, None)
        if val is not None:
            setattr(db_mine, field, val)
    db.commit()
    db.refresh(db_mine)
    return db_mine


@router.delete("/{mine_id}")
def delete_mine(
    mine_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    require_super_admin(current_user)
    db_mine = get_object_or_404(db, Mine, mine_id)

    # Cascade delete all related records in proper order (children first)
    for model in MINE_RELATED_MODELS:
        db.query(model).filter(model.mine_id == mine_id).delete(synchronize_session='fetch')

    db.delete(db_mine)
    db.commit()
    return {"message": "矿山已删除"}
