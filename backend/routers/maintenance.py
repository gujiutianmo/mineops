"""设备维护记录管理"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date
from database import get_db
from models import EquipmentMaintenance, Equipment, Mine
from schemas.maintenance import (
    MaintenanceCreate, MaintenanceUpdate, MaintenanceOut, MaintenanceStats
)
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_export

router = APIRouter()

MAINTENANCE_HEADERS = ["维护日期", "设备编号", "设备名称", "维护类型", "描述", "费用", "币种", "状态", "下次维护"]


def _build_maintenance_out(m: EquipmentMaintenance, eq: Equipment) -> dict:
    return {
        "id": m.id,
        "equipment_id": m.equipment_id,
        "equipment_code": eq.code if eq else "",
        "equipment_name": eq.name if eq else "",
        "mine_id": m.mine_id,
        "maintenance_date": str(m.maintenance_date),
        "maintenance_type": m.maintenance_type,
        "description": m.description or "",
        "cost": float(m.cost or 0),
        "currency": m.currency or "USD",
        "status": m.status or "pending",
        "next_date": str(m.next_date) if m.next_date else None,
        "created_by": m.created_by or "",
        "created_at": m.created_at
    }


@router.get("/", response_model=List[MaintenanceOut])
def read_maintenances(
    equipment_id: str = None,
    status: str = None,
    maintenance_type: str = None,
    year: int = None,
    month: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """查询维护记录"""
    query = db.query(EquipmentMaintenance, Equipment).join(
        Equipment, EquipmentMaintenance.equipment_id == Equipment.id
    )
    query = filter_by_mine(query, EquipmentMaintenance, "mine_id", current_user)

    if equipment_id:
        query = query.filter(EquipmentMaintenance.equipment_id == equipment_id)
    if status:
        query = query.filter(EquipmentMaintenance.status == status)
    if maintenance_type:
        query = query.filter(EquipmentMaintenance.maintenance_type == maintenance_type)
    if year:
        query = query.filter(func.extract('year', EquipmentMaintenance.maintenance_date) == year)
    if month:
        query = query.filter(func.extract('month', EquipmentMaintenance.maintenance_date) == month)

    results = query.order_by(
        EquipmentMaintenance.maintenance_date.desc()
    ).offset(skip).limit(limit).all()

    return [_build_maintenance_out(m, eq) for m, eq in results]


@router.post("/", response_model=MaintenanceOut)
def create_maintenance(
    maintenance: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """创建维护记录"""
    equip = get_object_or_404(db, Equipment, maintenance.equipment_id)
    target_mine = get_target_mine_id(current_user, maintenance.mine_id)
    if not target_mine:
        if current_user.role == "super":
            first_mine = db.query(Mine).order_by(Mine.created_at).first()
            if first_mine:
                target_mine = first_mine.id
            else:
                raise HTTPException(status_code=400, detail="系统无可用矿山，请先创建矿山")
        else:
            raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    db_maint = EquipmentMaintenance(
        mine_id=target_mine,
        equipment_id=maintenance.equipment_id,
        maintenance_date=maintenance.maintenance_date,
        maintenance_type=maintenance.maintenance_type,
        description=maintenance.description or "",
        cost=maintenance.cost or 0,
        currency=maintenance.currency or "USD",
        status=maintenance.status or "pending",
        next_date=maintenance.next_date,
        created_by=current_user.display_name
    )
    db.add(db_maint)
    db.commit()
    db.refresh(db_maint)
    return _build_maintenance_out(db_maint, equip)


@router.get("/{maintenance_id}", response_model=MaintenanceOut)
def read_maintenance(
    maintenance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """获取单条维护记录"""
    result = db.query(EquipmentMaintenance, Equipment).join(
        Equipment, EquipmentMaintenance.equipment_id == Equipment.id
    ).filter(EquipmentMaintenance.id == maintenance_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="维护记录不存在")
    m, eq = result
    check_mine_access(current_user, m.mine_id)
    return _build_maintenance_out(m, eq)


@router.put("/{maintenance_id}", response_model=MaintenanceOut)
def update_maintenance(
    maintenance_id: str,
    maintenance_update: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """更新维护记录"""
    m = get_object_or_404(db, EquipmentMaintenance, maintenance_id)
    check_mine_access(current_user, m.mine_id)

    for field in ["maintenance_type", "description", "cost", "currency", "status", "next_date"]:
        val = getattr(maintenance_update, field, None)
        if val is not None:
            setattr(m, field, val)

    db.commit()
    db.refresh(m)
    eq = get_object_or_404(db, Equipment, m.equipment_id)
    return _build_maintenance_out(m, eq)


@router.delete("/{maintenance_id}")
def delete_maintenance(
    maintenance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """删除维护记录"""
    m = get_object_or_404(db, EquipmentMaintenance, maintenance_id)
    check_mine_access(current_user, m.mine_id)
    db.delete(m)
    db.commit()
    return {"message": "维护记录已删除"}


@router.get("/stats/overview", response_model=MaintenanceStats)
def get_maintenance_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """维护统计概览"""
    query = db.query(EquipmentMaintenance)
    query = filter_by_mine(query, EquipmentMaintenance, "mine_id", current_user)
    
    all_records = query.all()
    
    total_count = len(all_records)
    completed_count = sum(1 for r in all_records if r.status == "completed")
    pending_count = sum(1 for r in all_records if r.status in ("pending", "in_progress"))
    total_cost = sum(float(r.cost or 0) for r in all_records)
    
    by_type = {}
    for r in all_records:
        t = r.maintenance_type
        by_type[t] = by_type.get(t, 0) + 1
    
    today = date.today()
    next_due = [
        {"equipment_id": r.equipment_id, "maintenance_type": r.maintenance_type, 
         "next_date": str(r.next_date), "status": r.status}
        for r in all_records
        if r.next_date and r.next_date >= today and r.status != "completed"
    ][:10]
    
    return MaintenanceStats(
        total_count=total_count,
        completed_count=completed_count,
        pending_count=pending_count,
        total_cost=round(total_cost, 2),
        by_type=by_type,
        next_due=next_due
    )


@router.get("/export/excel")
def export_maintenance_excel(
    equipment_id: str = None,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """导出维护记录"""
    query = db.query(EquipmentMaintenance, Equipment).join(
        Equipment, EquipmentMaintenance.equipment_id == Equipment.id
    )
    query = filter_by_mine(query, EquipmentMaintenance, "mine_id", current_user)
    
    if equipment_id:
        query = query.filter(EquipmentMaintenance.equipment_id == equipment_id)
    if year:
        query = query.filter(func.extract('year', EquipmentMaintenance.maintenance_date) == year)
    if month:
        query = query.filter(func.extract('month', EquipmentMaintenance.maintenance_date) == month)
    
    results = query.order_by(EquipmentMaintenance.maintenance_date.desc()).all()
    
    rows = [
        [str(m.maintenance_date), eq.code, eq.name, m.maintenance_type,
         m.description or "", float(m.cost or 0), m.currency or "USD",
         m.status or "pending", str(m.next_date) if m.next_date else ""]
        for m, eq in results
    ]
    
    return create_export(
        MAINTENANCE_HEADERS, rows, "设备维护记录.xlsx",
        [18, 18, 18, 15, 30, 15, 10, 15, 18]
    )
