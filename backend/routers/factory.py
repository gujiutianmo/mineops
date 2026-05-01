from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Factory
from schemas.factory import FactoryCreate, FactoryUpdate, FactoryOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404

router = APIRouter()

FACTORY_FIELDS = ["name"]


def _get_and_check(db, model, obj_id, current_user):
    obj = get_object_or_404(db, model, obj_id)
    check_mine_access(current_user, obj.mine_id)
    return obj


@router.get("/", response_model=List[FactoryOut])
def read_factories(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(Factory), Factory, "mine_id", current_user, mine_id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=FactoryOut)
def create_factory(
    factory: FactoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, factory.mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    db_factory = Factory(mine_id=target_mine, name=factory.name)
    db.add(db_factory)
    db.commit()
    db.refresh(db_factory)
    return db_factory


@router.get("/{factory_id}", response_model=FactoryOut)
def read_factory(
    factory_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Factory, factory_id, current_user)


@router.put("/{factory_id}", response_model=FactoryOut)
def update_factory(
    factory_id: str,
    factory_update: FactoryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_factory = _get_and_check(db, Factory, factory_id, current_user)
    for field in FACTORY_FIELDS:
        val = getattr(factory_update, field, None)
        if val is not None:
            setattr(db_factory, field, val)
    db.commit()
    db.refresh(db_factory)
    return db_factory


@router.delete("/{factory_id}")
def delete_factory(
    factory_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_factory = _get_and_check(db, Factory, factory_id, current_user)
    db.delete(db_factory)
    db.commit()
    return {"message": "工厂已删除"}
