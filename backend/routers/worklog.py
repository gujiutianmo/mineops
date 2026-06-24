from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import date
from database import get_db
from models import EquipmentWorkLog, Equipment
from schemas.worklog import WorkLogCreate, WorkLogUpdate, WorkLogOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_export
from services.data_governance import archive_record, assert_period_unlocked

router = APIRouter()

WORKLOG_FIELDS = ["work_date", "work_hours", "fuel_liters", "remark"]


def _get_and_check(db, model, obj_id, current_user):
    obj = get_object_or_404(db, model, obj_id)
    check_mine_access(current_user, obj.mine_id)
    return obj


def _ensure_equipment_can_log(db: Session, equipment_id: str, target_mine: str, current_user):
    equipment = get_object_or_404(db, Equipment, equipment_id)
    if current_user.role != "super" and equipment.mine_id is not None and equipment.mine_id != current_user.mine_id:
        raise HTTPException(status_code=403, detail="Permission denied: 不能使用其他矿山的设备")
    if equipment.mine_id is not None and equipment.mine_id != target_mine:
        raise HTTPException(status_code=400, detail="equipment_id does not belong to target mine")
    return equipment


# ========== Static routes (MUST be before /{worklog_id}) ==========

@router.get("/monthly-stats")
def get_monthly_stats(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """月度总工时/油耗统计"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    query = db.query(
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    result = query.first()
    return {
        "year": year,
        "month": month,
        "total_hours": float(result.total_hours or 0),
        "total_fuel": float(result.total_fuel or 0)
    }


@router.get("/fuel-trend")
def get_fuel_trend(
    year: int = None,
    month: int = None,
    start_date: str = None,
    end_date: str = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """每日油耗趋势 - 支持按月或按日期范围查询"""
    today = date.today()

    query = db.query(
        EquipmentWorkLog.work_date.label("date"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    )

    if start_date or end_date:
        # 按日期范围查询
        sd = start_date or str(today.replace(day=1))
        ed = end_date or str(today)
        query = query.filter(
            EquipmentWorkLog.work_date >= sd,
            EquipmentWorkLog.work_date <= ed
        )
    else:
        # 按月查询（向后兼容）
        year = year or today.year
        month = month or today.month
        query = query.filter(
            extract('year', EquipmentWorkLog.work_date) == year,
            extract('month', EquipmentWorkLog.work_date) == month
        )

    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    results = query.group_by(EquipmentWorkLog.work_date).order_by(EquipmentWorkLog.work_date).all()
    return [{"date": str(r.date), "total_fuel": float(r.total_fuel or 0)} for r in results]


@router.get("/export-excel")
def export_worklogs_excel(
    start_date: str = None,
    end_date: str = None,
    equipment_id: str = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """导出工作日志 Excel（含设备信息）"""
    query = db.query(EquipmentWorkLog, Equipment).join(
        Equipment, EquipmentWorkLog.equipment_id == Equipment.id
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    if equipment_id:
        query = query.filter(EquipmentWorkLog.equipment_id == equipment_id)
    if start_date:
        query = query.filter(EquipmentWorkLog.work_date >= start_date)
    if end_date:
        query = query.filter(EquipmentWorkLog.work_date <= end_date)

    logs = query.order_by(EquipmentWorkLog.work_date.desc()).all()

    headers = ["日期", "设备编号", "设备名称", "设备类型", "工时(小时)", "油耗(升)", "备注", "录入人"]
    rows = [
        [str(log.work_date), eq.code, eq.name, eq.category or "",
         float(log.work_hours or 0), float(log.fuel_liters or 0),
         log.remark or "", log.created_by or ""]
        for log, eq in logs
    ]

    filename = f"工作日志_{start_date or '全部'}_至_{end_date or '全部'}.xlsx"
    return create_export(headers, rows, filename, [18, 18, 18, 14, 18, 18, 25, 18])


# ========== CRUD routes ==========

@router.get("/", response_model=List[WorkLogOut])
def read_worklogs(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    equipment_id: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """查询工作日志"""
    query = db.query(EquipmentWorkLog)
    if equipment_id:
        query = query.filter(EquipmentWorkLog.equipment_id == equipment_id)
    if start_date:
        query = query.filter(EquipmentWorkLog.work_date >= start_date)
    if end_date:
        query = query.filter(EquipmentWorkLog.work_date <= end_date)
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    return query.order_by(EquipmentWorkLog.work_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=WorkLogOut)
def create_worklog(
    worklog: WorkLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """创建工作日志"""
    target_mine = get_target_mine_id(current_user, worklog.mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)
    assert_period_unlocked(db, target_mine, "worklogs", worklog.work_date)
    _ensure_equipment_can_log(db, worklog.equipment_id, target_mine, current_user)

    db_worklog = EquipmentWorkLog(
        mine_id=target_mine,
        equipment_id=worklog.equipment_id,
        work_date=worklog.work_date,
        work_hours=worklog.work_hours,
        fuel_liters=worklog.fuel_liters,
        remark=worklog.remark
    )
    db.add(db_worklog)
    db.commit()
    db.refresh(db_worklog)
    return db_worklog


@router.get("/{worklog_id}", response_model=WorkLogOut)
def read_worklog(
    worklog_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """获取单条工作日志"""
    return _get_and_check(db, EquipmentWorkLog, worklog_id, current_user)


@router.put("/{worklog_id}", response_model=WorkLogOut)
def update_worklog(
    worklog_id: str,
    worklog_update: WorkLogUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """更新工作日志"""
    db_worklog = _get_and_check(db, EquipmentWorkLog, worklog_id, current_user)
    assert_period_unlocked(db, db_worklog.mine_id, "worklogs", db_worklog.work_date)
    if worklog_update.work_date is not None:
        assert_period_unlocked(db, db_worklog.mine_id, "worklogs", worklog_update.work_date)
    for field in WORKLOG_FIELDS:
        val = getattr(worklog_update, field, None)
        if val is not None:
            setattr(db_worklog, field, val)
    db.commit()
    db.refresh(db_worklog)
    return db_worklog


@router.delete("/{worklog_id}")
def delete_worklog(
    worklog_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """删除工作日志"""
    db_worklog = _get_and_check(db, EquipmentWorkLog, worklog_id, current_user)
    assert_period_unlocked(db, db_worklog.mine_id, "worklogs", db_worklog.work_date)
    archive_record(db, db_worklog, "worklogs", current_user)
    db.delete(db_worklog)
    db.commit()
    return {"message": "工作日志已删除"}
