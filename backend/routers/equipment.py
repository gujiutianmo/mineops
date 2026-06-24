import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_
from typing import List
from datetime import date, datetime, time, timedelta
from database import get_db
from models import Equipment, EquipmentWorkLog, EquipmentWorkSession, EquipmentMaintenance, Mine
from schemas.equipment import (
    EquipmentCreate, EquipmentUpdate, EquipmentOut,
    ParseRequest, ParsedRecord, ParseResponse, BatchFuelRequest,
    WorkLogOut, WorkLogCreate, WorkLogUpdate
)
from auth import get_current_active_user
from utils.permissions import (
    check_mine_access,
    filter_by_mine,
    filter_equipment_visibility,
    get_target_mine_id,
)
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_template, create_export, parse_import_file
from utils.worklog_time import parse_time_ranges
from services.smart_parser import SmartParser
from services.fleet_matcher import FleetMatcher

router = APIRouter()
MANUAL_SESSION_STATUS = "manual"
FINISHED_SESSION_STATUSES = ["completed", MANUAL_SESSION_STATUS]
DEFAULT_WORKLOG_START_TIME = time(hour=8)

EQUIPMENT_HEADERS = ["设备编号", "设备名称", "品牌", "型号", "设备类型", "车辆编号", "短编号", "别名"]
WORKLOG_TEMPLATE_HEADERS = ["日期", "设备编号", "工时(小时)", "油耗(升)", "备注"]

EQUIPMENT_CATEGORY_ORDER = {
    "挖掘机": 10,
    "破碎锤": 20,
    "铲车": 30,
    "矿卡": 50,
    "短车": 70,
    "压路机": 80,
}

EQUIPMENT_BRAND_ORDER = {
    "三一": 10,
    "徐工": 20,
    "柳工": 30,
    "临工": 40,
}


def _get_and_check(db, model, obj_id, current_user):
    """设备访问控制：super全部访问，miner只能操作全局设备或自己矿山的设备"""
    obj = get_object_or_404(db, model, obj_id)
    if current_user.role == "super":
        return obj
    # 矿山子用户可以操作全局设备(mine_id=None)和自己矿山的设备
    if obj.mine_id is not None and obj.mine_id != current_user.mine_id:
        raise HTTPException(status_code=403, detail="Permission denied: 不能操作其他矿山的设备")
    return obj


def _equipment_category_sort_value(equipment: Equipment) -> int:
    category = equipment.category or ""
    brand = equipment.brand or ""
    if category == "矿卡":
        if brand == "徐工":
            return 40
        if brand == "临工":
            return 50
        return 60
    return EQUIPMENT_CATEGORY_ORDER.get(category, 900)


def _equipment_brand_sort_value(equipment: Equipment) -> int:
    return EQUIPMENT_BRAND_ORDER.get(equipment.brand or "", 900)


def _equipment_number_sort_value(equipment: Equipment):
    candidates = [
        equipment.short_num or "",
        equipment.vehicle_num or "",
        equipment.code or "",
        equipment.name or "",
    ]
    for value in candidates:
        text = str(value).strip().upper()
        if not text:
            continue
        match = re.search(r'(?<!\d)([A-Z]?)(\d+)(?!\d)', text)
        if match:
            prefix, number = match.groups()
            prefix_rank = 0 if not prefix else ord(prefix[0]) - ord('A') + 1
            return (prefix_rank, int(number))
    return (999, 999999)


def _equipment_sort_key(equipment: Equipment):
    return (
        _equipment_category_sort_value(equipment),
        _equipment_brand_sort_value(equipment),
        _equipment_number_sort_value(equipment),
        equipment.code or "",
        equipment.name or "",
    )


def _sort_equipments(equipments):
    return sorted(equipments, key=_equipment_sort_key)


def _ensure_equipment_can_log(equipment: Equipment, target_mine: str, current_user):
    """工作日志只能记录到全局设备或目标矿山自己的设备。"""
    if current_user.role != "super" and equipment.mine_id is not None and equipment.mine_id != current_user.mine_id:
        raise HTTPException(status_code=403, detail="Permission denied: 不能使用其他矿山的设备")
    if equipment.mine_id is not None and equipment.mine_id != target_mine:
        raise HTTPException(status_code=400, detail="equipment_id does not belong to target mine")


def _get_account_display_name(current_user):
    return current_user.display_name or getattr(current_user, "username", "") or ""


def _parse_worklog_start_time(work_date, time_detail: str = ""):
    if isinstance(work_date, datetime):
        work_day = work_date.date()
    else:
        work_day = work_date

    detail = (time_detail or "").strip()
    match = re.search(r"(?<!\d)([01]?\d|2[0-3])(?:(?::|\.)(\d{1,2}))?", detail)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        if 0 <= minute <= 59:
            return datetime.combine(work_day, time(hour=hour, minute=minute))

    return datetime.combine(work_day, DEFAULT_WORKLOG_START_TIME)


def _worklog_session_remark(worklog: EquipmentWorkLog):
    remark = (worklog.remark or worklog.raw_text or "").strip()
    if remark:
        return f"Imported from worklog: {remark}"[:500]
    return "Imported from worklog"


def _sync_worklog_to_session(
    db: Session,
    worklog: EquipmentWorkLog,
    target_mine: str,
    current_user,
    shift: str = "",
    strict_time: bool = False,
):
    work_hours = float(worklog.work_hours or 0)
    parsed_time = parse_time_ranges(
        worklog.time_detail,
        work_date=worklog.work_date,
        allow_day_rollover=shift == "晚班",
    )
    if strict_time and parsed_time["errors"]:
        raise HTTPException(status_code=400, detail="；".join(parsed_time["errors"]))
    if work_hours <= 0:
        if strict_time and parsed_time["segments"]:
            raise HTTPException(status_code=400, detail="时间段合计工时与解析工时不一致，已阻止保存")
        return None

    remark = _worklog_session_remark(worklog)
    if parsed_time["segments"]:
        if abs(float(parsed_time["hours"]) - work_hours) > 0.01:
            raise HTTPException(status_code=400, detail="时间段合计工时与解析工时不一致，已阻止保存")
        worklog.time_detail = parsed_time["canonical"]
        synced = []
        for segment in parsed_time["segments"]:
            exact_query = db.query(EquipmentWorkSession).filter(
                EquipmentWorkSession.mine_id == target_mine,
                EquipmentWorkSession.equipment_id == worklog.equipment_id,
                EquipmentWorkSession.start_time == segment["start_time"],
                EquipmentWorkSession.end_time == segment["end_time"],
                EquipmentWorkSession.status == MANUAL_SESSION_STATUS,
            )
            if not strict_time:
                exact_query = exact_query.filter(EquipmentWorkSession.remark == remark)
            existing = exact_query.first()
            if existing:
                if strict_time:
                    raise HTTPException(status_code=400, detail="相同设备和时间段已存在，已阻止重复补录")
                existing.duration_hours = segment["duration_hours"]
                existing.operator_account_id = current_user.id
                existing.operator_name = _get_account_display_name(current_user)
                synced.append(existing)
                continue
            if strict_time:
                overlap = db.query(EquipmentWorkSession).filter(
                    EquipmentWorkSession.mine_id == target_mine,
                    EquipmentWorkSession.equipment_id == worklog.equipment_id,
                    EquipmentWorkSession.start_time < segment["end_time"],
                    or_(
                        EquipmentWorkSession.end_time.is_(None),
                        EquipmentWorkSession.end_time > segment["start_time"],
                    ),
                ).first()
                if overlap:
                    raise HTTPException(status_code=400, detail="该设备的时间段与已有工时记录重叠，已阻止保存")
            record = EquipmentWorkSession(
                mine_id=target_mine,
                equipment_id=worklog.equipment_id,
                operator_account_id=current_user.id,
                operator_name=_get_account_display_name(current_user),
                start_time=segment["start_time"],
                end_time=segment["end_time"],
                duration_hours=segment["duration_hours"],
                status=MANUAL_SESSION_STATUS,
                remark=remark,
            )
            db.add(record)
            synced.append(record)
        return synced
    if strict_time:
        raise HTTPException(status_code=400, detail="有工时的补录记录必须包含明确时间段")

    start_time = _parse_worklog_start_time(worklog.work_date, worklog.time_detail)
    end_time = start_time + timedelta(hours=work_hours)
    duration_hours = round(work_hours, 2)
    existing = db.query(EquipmentWorkSession).filter(
        EquipmentWorkSession.mine_id == target_mine,
        EquipmentWorkSession.equipment_id == worklog.equipment_id,
        EquipmentWorkSession.start_time == start_time,
        EquipmentWorkSession.end_time == end_time,
        EquipmentWorkSession.status == MANUAL_SESSION_STATUS,
        EquipmentWorkSession.remark == remark,
    ).first()
    if existing:
        existing.duration_hours = duration_hours
        existing.operator_account_id = current_user.id
        existing.operator_name = _get_account_display_name(current_user)
        return existing

    record = EquipmentWorkSession(
        mine_id=target_mine,
        equipment_id=worklog.equipment_id,
        operator_account_id=current_user.id,
        operator_name=_get_account_display_name(current_user),
        start_time=start_time,
        end_time=end_time,
        duration_hours=duration_hours,
        status=MANUAL_SESSION_STATUS,
        remark=remark,
    )
    db.add(record)
    return record


def _worklog_remark(remark: str, shift: str) -> str:
    parts = []
    if shift:
        parts.append(f"班次：{shift}")
    if remark:
        parts.append(f"备注：{remark}")
    return "；".join(parts)


def _ensure_no_duplicate_strict_worklog(
    db: Session,
    worklog: WorkLogCreate,
    target_mine: str,
    remark: str,
):
    if not worklog.strict_time:
        return
    existing = db.query(EquipmentWorkLog).filter(
        EquipmentWorkLog.mine_id == target_mine,
        EquipmentWorkLog.equipment_id == worklog.equipment_id,
        EquipmentWorkLog.work_date == worklog.work_date,
        EquipmentWorkLog.time_detail == (worklog.time_detail or ""),
        EquipmentWorkLog.raw_text == (worklog.raw_text or ""),
        EquipmentWorkLog.remark == remark,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该设备补录内容已经存在，已阻止重复导入")


def _get_equipments_as_dicts(db, target_mine=None, current_user=None):
    """获取设备的 dict 列表（供 SmartParser/FleetMatcher 使用）

    权限过滤：
    - super: 获取所有设备
    - mine子用户: 获取全局设备(mine_id=None) + 自己矿山的设备
    """
    query = db.query(Equipment)
    if current_user:
        query = filter_equipment_visibility(query, Equipment, current_user, target_mine)
    equips = _sort_equipments(query.all())
    return [
        {
            'id': eq.id, 'code': eq.code, 'name': eq.name,
            'brand': eq.brand or '', 'type': eq.type or '',
            'category': eq.category or '', 'vehicle_num': eq.vehicle_num or '',
            'short_num': eq.short_num or '', 'aliases': eq.aliases or ''
        }
        for eq in equips
    ]


# ========== Equipment CRUD ==========

@router.get("/", response_model=List[EquipmentOut])
def read_equipments(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """获取设备列表 - super全部，miner只能看全局+自己矿山的设备"""
    query = filter_equipment_visibility(db.query(Equipment), Equipment, current_user, mine_id)
    equipments = _sort_equipments(query.all())
    return equipments[skip:skip + limit]


@router.post("/", response_model=EquipmentOut)
def create_equipment(
    equipment: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """创建设备 - miner自动归属自己矿山，super可选"""
    if current_user.role != "super":
        mine_id = current_user.mine_id
    else:
        mine_id = equipment.mine_id if equipment.mine_id else None
    if mine_id:
        check_mine_access(current_user, mine_id)

    db_equipment = Equipment(
        mine_id=mine_id,
        code=equipment.code,
        name=equipment.name,
        brand=equipment.brand or "",
        type=equipment.type or "",
        category=equipment.category or "",
        vehicle_num=equipment.vehicle_num or "",
        short_num=equipment.short_num or "",
        aliases=equipment.aliases or ""
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


# ========== WorkLog CRUD ==========
# NOTE: 这些路由必须在 /{equipment_id} 之前定义，否则 /worklogs 会被动态路由捕获返回 404

@router.get("/worklogs", response_model=List[WorkLogOut])
def read_worklogs(
    mine_id: str = None,
    equipment_id: str = None,
    year: int = None,
    month: int = None,
    work_date: str = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """查询工作日志"""
    query = db.query(EquipmentWorkLog, Equipment).join(
        Equipment, EquipmentWorkLog.equipment_id == Equipment.id
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)

    if equipment_id:
        query = query.filter(EquipmentWorkLog.equipment_id == equipment_id)
    if year:
        query = query.filter(extract('year', EquipmentWorkLog.work_date) == year)
    if month:
        query = query.filter(extract('month', EquipmentWorkLog.work_date) == month)
    if work_date:
        query = query.filter(EquipmentWorkLog.work_date == work_date)

    results = query.order_by(EquipmentWorkLog.work_date.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": log.id,
            "equipment_id": log.equipment_id,
            "equipment_code": eq.code,
            "equipment_name": eq.name,
            "work_date": str(log.work_date),
            "work_hours": float(log.work_hours or 0),
            "fuel_liters": float(log.fuel_liters or 0),
            "remark": log.remark or "",
            "time_detail": log.time_detail or "",
            "raw_text": log.raw_text or "",
            "created_by": log.created_by or "",
            "created_at": log.created_at
        }
        for log, eq in results
    ]


@router.post("/worklogs", response_model=WorkLogOut)
def create_worklog(
    worklog: WorkLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """创建单条工作日志"""
    equip = _get_and_check(db, Equipment, worklog.equipment_id, current_user)
    target_mine = get_target_mine_id(current_user, worklog.mine_id) or equip.mine_id
    if not target_mine:
        if current_user.role == "super":
            first_mine = db.query(Mine).order_by(Mine.created_at).first()
            if first_mine:
                target_mine = first_mine.id
            else:
                raise HTTPException(status_code=400, detail="系统无可用矿山，请先创建矿山")
        else:
            raise HTTPException(status_code=400, detail="mine_id is required for creating worklogs")
    check_mine_access(current_user, target_mine)
    _ensure_equipment_can_log(equip, target_mine, current_user)

    remark = _worklog_remark(worklog.remark or "", worklog.shift or "")
    _ensure_no_duplicate_strict_worklog(db, worklog, target_mine, remark)
    db_log = EquipmentWorkLog(
        mine_id=target_mine,
        equipment_id=worklog.equipment_id,
        work_date=worklog.work_date,
        work_hours=worklog.work_hours,
        fuel_liters=worklog.fuel_liters,
        remark=remark,
        time_detail=worklog.time_detail or "",
        raw_text=worklog.raw_text or "",
        created_by=current_user.display_name
    )
    db.add(db_log)
    _sync_worklog_to_session(
        db,
        db_log,
        target_mine,
        current_user,
        shift=worklog.shift or "",
        strict_time=worklog.strict_time,
    )
    db.commit()
    db.refresh(db_log)

    return {
        "id": db_log.id,
        "equipment_id": db_log.equipment_id,
        "equipment_code": equip.code,
        "equipment_name": equip.name,
        "work_date": str(db_log.work_date),
        "work_hours": float(db_log.work_hours or 0),
        "fuel_liters": float(db_log.fuel_liters or 0),
        "remark": db_log.remark or "",
        "time_detail": db_log.time_detail or "",
        "raw_text": db_log.raw_text or "",
        "created_by": db_log.created_by or "",
        "created_at": db_log.created_at
    }


@router.post("/worklogs/batch", response_model=List[WorkLogOut])
def batch_create_worklogs(
    worklogs: List[WorkLogCreate],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """批量创建工作日志（从解析结果直接保存）"""
    result = []
    for wl in worklogs:
        equip = _get_and_check(db, Equipment, wl.equipment_id, current_user)
        target_mine = get_target_mine_id(current_user, wl.mine_id) or equip.mine_id
        if not target_mine:
            if current_user.role == "super":
                first_mine = db.query(Mine).order_by(Mine.created_at).first()
                if first_mine:
                    target_mine = first_mine.id
                else:
                    raise HTTPException(status_code=400, detail="系统无可用矿山，请先创建矿山")
            else:
                raise HTTPException(status_code=400, detail="mine_id is required for creating worklogs")
        check_mine_access(current_user, target_mine)
        _ensure_equipment_can_log(equip, target_mine, current_user)

        remark = _worklog_remark(wl.remark or "", wl.shift or "")
        _ensure_no_duplicate_strict_worklog(db, wl, target_mine, remark)
        db_log = EquipmentWorkLog(
            mine_id=target_mine,
            equipment_id=wl.equipment_id,
            work_date=wl.work_date,
            work_hours=wl.work_hours,
            fuel_liters=wl.fuel_liters,
            remark=remark,
            time_detail=wl.time_detail or "",
            raw_text=wl.raw_text or "",
            created_by=current_user.display_name
        )
        db.add(db_log)
        _sync_worklog_to_session(
            db,
            db_log,
            target_mine,
            current_user,
            shift=wl.shift or "",
            strict_time=wl.strict_time,
        )
        db.flush()
        result.append({
            "id": db_log.id,
            "equipment_id": db_log.equipment_id,
            "equipment_code": equip.code,
            "equipment_name": equip.name,
            "work_date": str(db_log.work_date),
            "work_hours": float(db_log.work_hours or 0),
            "fuel_liters": float(db_log.fuel_liters or 0),
            "remark": db_log.remark or "",
            "time_detail": db_log.time_detail or "",
            "raw_text": db_log.raw_text or "",
            "created_by": db_log.created_by or "",
            "created_at": db_log.created_at
        })
    db.commit()
    return result


@router.post("/worklogs/batch-fuel")
def batch_fuel_entry(
    req: BatchFuelRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """批量录入加油记录"""
    target_mine = get_target_mine_id(current_user, req.mine_id)
    if target_mine is None and current_user.role == "super":
        first_mine = db.query(Mine).order_by(Mine.created_at).first()
        target_mine = first_mine.id if first_mine else None
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    try:
        work_date_parsed = date.fromisoformat(req.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    count = 0
    for eq_id in req.equipment_ids:
        equip = db.query(Equipment).filter(Equipment.id == eq_id).first()
        if not equip:
            continue
        _ensure_equipment_can_log(equip, target_mine, current_user)

        existing = db.query(EquipmentWorkLog).filter(
            EquipmentWorkLog.mine_id == target_mine,
            EquipmentWorkLog.equipment_id == eq_id,
            EquipmentWorkLog.work_date == work_date_parsed
        ).first()

        if existing:
            existing.fuel_liters = (existing.fuel_liters or 0) + req.fuel
            existing.remark = (existing.remark or "") + f"; {req.memo}" if req.memo else existing.remark
        else:
            db.add(EquipmentWorkLog(
                mine_id=target_mine,
                equipment_id=eq_id,
                work_date=work_date_parsed,
                work_hours=0,
                fuel_liters=req.fuel,
                remark=req.memo or "",
                created_by=current_user.display_name
            ))
        count += 1

    db.commit()
    return {"message": f"已为 {count} 台设备记录加油", "count": count}


@router.get("/worklogs/{worklog_id}", response_model=WorkLogOut)
def read_worklog(
    worklog_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """获取单条工作日志"""
    result = db.query(EquipmentWorkLog, Equipment).join(
        Equipment, EquipmentWorkLog.equipment_id == Equipment.id
    ).filter(EquipmentWorkLog.id == worklog_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Work log not found")
    log, eq = result
    check_mine_access(current_user, log.mine_id)
    return {
        "id": log.id,
        "equipment_id": log.equipment_id,
        "equipment_code": eq.code,
        "equipment_name": eq.name,
        "work_date": str(log.work_date),
        "work_hours": float(log.work_hours or 0),
        "fuel_liters": float(log.fuel_liters or 0),
        "remark": log.remark or "",
        "time_detail": log.time_detail or "",
        "raw_text": log.raw_text or "",
        "created_by": log.created_by or "",
        "created_at": log.created_at
    }


@router.put("/worklogs/{worklog_id}", response_model=WorkLogOut)
def update_worklog(
    worklog_id: str,
    worklog_update: WorkLogUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """更新工作日志"""
    log = get_object_or_404(db, EquipmentWorkLog, worklog_id)
    check_mine_access(current_user, log.mine_id)

    for field in ["work_hours", "fuel_liters", "remark", "time_detail"]:
        val = getattr(worklog_update, field, None)
        if val is not None:
            setattr(log, field, val)

    db.commit()
    db.refresh(log)

    equip = get_object_or_404(db, Equipment, log.equipment_id)
    return {
        "id": log.id,
        "equipment_id": log.equipment_id,
        "equipment_code": equip.code,
        "equipment_name": equip.name,
        "work_date": str(log.work_date),
        "work_hours": float(log.work_hours or 0),
        "fuel_liters": float(log.fuel_liters or 0),
        "remark": log.remark or "",
        "time_detail": log.time_detail or "",
        "raw_text": log.raw_text or "",
        "created_by": log.created_by or "",
        "created_at": log.created_at
    }


@router.delete("/worklogs/{worklog_id}")
def delete_worklog(
    worklog_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """删除工作日志"""
    log = get_object_or_404(db, EquipmentWorkLog, worklog_id)
    check_mine_access(current_user, log.mine_id)
    db.delete(log)
    db.commit()
    return {"message": "工作日志已删除"}


@router.post("/worklogs/batch-delete")
def batch_delete_worklogs(
    ids: List[str],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """批量删除工作日志"""
    deleted = 0
    for wid in ids:
        log = db.query(EquipmentWorkLog).filter(EquipmentWorkLog.id == wid).first()
        if log and check_mine_access(current_user, log.mine_id, raise_exception=False):
            db.delete(log)
            deleted += 1
    db.commit()
    return {"message": f"已删除 {deleted} 条工作日志", "deleted": deleted}


# ========== Equipment CRUD (动态路由，必须在 /worklogs 等静态路由之后) ==========

@router.get("/{equipment_id}", response_model=EquipmentOut)
def read_equipment(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Equipment, equipment_id, current_user)


@router.put("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: str,
    equipment_update: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_equipment = _get_and_check(db, Equipment, equipment_id, current_user)
    for field in ["code", "name", "brand", "type", "category", "vehicle_num", "short_num", "aliases", "status"]:
        val = getattr(equipment_update, field, None)
        if val is not None:
            setattr(db_equipment, field, val)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.delete("/{equipment_id}")
def delete_equipment(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_equipment = _get_and_check(db, Equipment, equipment_id, current_user)
    db.delete(db_equipment)
    db.commit()
    return {"message": "设备已删除"}


# ========== Excel Import/Export ==========

@router.get("/import/template")
def download_equipment_template(current_user=Depends(get_current_active_user)):
    return create_template(EQUIPMENT_HEADERS, "设备导入模板.xlsx", [20, 25, 20, 20, 15, 12, 10, 30])


@router.get("/worklogs/template")
def download_worklog_template(current_user=Depends(get_current_active_user)):
    """下载工作日志录入模板"""
    return create_template(WORKLOG_TEMPLATE_HEADERS, "工作日志录入模板.xlsx", [18, 20, 18, 18, 30])


@router.post("/import/excel")
async def import_equipment_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """导入设备 - 设备不分矿山"""
    ws = await parse_import_file(file, EQUIPMENT_HEADERS)
    imported = 0
    errors = []

    for row in range(2, ws.max_row + 1):
        code = ws.cell(row=row, column=1).value
        name = ws.cell(row=row, column=2).value
        brand = ws.cell(row=row, column=3).value or ""
        eq_type = ws.cell(row=row, column=4).value or ""
        category = ws.cell(row=row, column=5).value or ""
        vehicle_num = ws.cell(row=row, column=6).value or ""
        short_num = ws.cell(row=row, column=7).value or ""
        aliases = ws.cell(row=row, column=8).value or ""

        if not code or not name:
            errors.append(f"第{row}行: 设备编号或设备名称为空")
            continue

        existing = db.query(Equipment).filter(Equipment.code == str(code)).first()
        if existing:
            errors.append(f"第{row}行: 设备编号 {code} 已存在")
            continue

        db.add(Equipment(
            mine_id=None,
            code=str(code), name=str(name),
            brand=str(brand), type=str(eq_type),
            category=str(category), vehicle_num=str(vehicle_num),
            short_num=str(short_num), aliases=str(aliases)
        ))
        imported += 1

    db.commit()
    return {"message": f"成功导入 {imported} 条记录", "imported": imported, "errors": errors}


@router.get("/export/excel")
def export_equipment_excel(
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """导出设备列表"""
    query = filter_equipment_visibility(db.query(Equipment), Equipment, current_user, mine_id)
    equipments = _sort_equipments(query.all())
    rows = [[eq.code, eq.name, eq.brand, eq.type, eq.category or "", eq.vehicle_num or "", eq.short_num or "", eq.aliases or ""] for eq in equipments]
    return create_export(EQUIPMENT_HEADERS, rows, "设备列表.xlsx", [20, 25, 20, 20, 15, 12, 10, 30])


# ========== Dashboard ==========

@router.get("/dashboard/utilization")
def get_equipment_utilization(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """设备利用率仪表板"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    # 获取可见设备
    equip_query = filter_equipment_visibility(db.query(Equipment), Equipment, current_user, mine_id)
    equipments = _sort_equipments(equip_query.filter(Equipment.status == "active").all())

    days_in_month = 30  # approx
    if month and year:
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]

    session_summary = db.query(
        EquipmentWorkSession.equipment_id,
        func.sum(EquipmentWorkSession.duration_hours).label("total_hours"),
        func.count(func.distinct(func.date(EquipmentWorkSession.start_time))).label("work_days"),
        func.count(EquipmentWorkSession.id).label("session_count")
    ).filter(
        extract('year', EquipmentWorkSession.start_time) == year,
        extract('month', EquipmentWorkSession.start_time) == month,
        EquipmentWorkSession.status.in_(FINISHED_SESSION_STATUSES)
    )
    session_summary = filter_by_mine(session_summary, EquipmentWorkSession, "mine_id", current_user, mine_id)
    session_summary = session_summary.group_by(EquipmentWorkSession.equipment_id).all()

    summary_map = {}
    for s in session_summary:
        summary_map[s.equipment_id] = {
            "total_hours": float(s.total_hours or 0),
            "total_fuel": 0,
            "work_days": s.work_days or 0,
            "session_count": s.session_count or 0
        }

    fuel_summary = db.query(
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    fuel_summary = filter_by_mine(fuel_summary, EquipmentWorkLog, "mine_id", current_user, mine_id)
    fuel_summary = fuel_summary.group_by(EquipmentWorkLog.equipment_id).all()
    for fuel in fuel_summary:
        item = summary_map.setdefault(fuel.equipment_id, {
            "total_hours": 0,
            "total_fuel": 0,
            "work_days": 0,
            "session_count": 0
        })
        item["total_fuel"] = float(fuel.total_fuel or 0)

    result = []
    total_hours_all = 0
    total_fuel_all = 0
    active_count = 0

    for eq in equipments:
        s = summary_map.get(eq.id, {"total_hours": 0, "total_fuel": 0, "work_days": 0, "session_count": 0})
        hours = s["total_hours"]
        fuel = s["total_fuel"]
        util_rate = round((hours / (days_in_month * 8)) * 100, 1) if hours > 0 else 0
        if hours > 0 or fuel > 0:
            active_count += 1

        result.append({
            "equipment_id": eq.id,
            "code": eq.code,
            "name": eq.name,
            "category": eq.category or "",
            "total_hours": hours,
            "total_fuel": fuel,
            "work_days": s["work_days"],
            "session_count": s["session_count"],
            "utilization_rate": util_rate,
            "avg_daily_hours": round(hours / days_in_month, 2),
            "avg_daily_fuel": round(fuel / max(s["work_days"], 1), 2) if fuel > 0 else 0
        })
        total_hours_all += hours
        total_fuel_all += fuel

    return {
        "year": year,
        "month": month,
        "days_in_month": days_in_month,
        "total_equipment": len(equipments),
        "active_equipment": active_count,
        "total_hours": round(total_hours_all, 2),
        "total_fuel": round(total_fuel_all, 2),
        "avg_utilization": round((total_hours_all / max(len(equipments), 1) / days_in_month / 8) * 100, 1),
        "equipments": sorted(result, key=lambda x: x["total_hours"], reverse=True)
    }


@router.get("/dashboard/category-summary")
def get_category_summary(
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """按设备类型汇总"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    results = db.query(
        Equipment.category,
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel"),
        func.count(func.distinct(EquipmentWorkLog.equipment_id)).label("equip_count")
    ).join(EquipmentWorkLog, Equipment.id == EquipmentWorkLog.equipment_id).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month,
        Equipment.category != ""
    )
    results = filter_by_mine(results, EquipmentWorkLog, "mine_id", current_user)
    results = results.group_by(Equipment.category).all()

    return [
        {
            "category": r.category or "未分类",
            "total_hours": round(float(r.total_hours or 0), 2),
            "total_fuel": round(float(r.total_fuel or 0), 2),
            "equip_count": r.equip_count
        }
        for r in results
    ]


# ========== Dashboard daily trend (NEW) ==========

@router.get("/dashboard/daily-trend")
def get_daily_trend(
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """每日工时/油耗趋势"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    query = db.query(
        EquipmentWorkLog.work_date.label("work_date"),
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel"),
        func.count(func.distinct(EquipmentWorkLog.equipment_id)).label("equip_count")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user)
    results = query.group_by(EquipmentWorkLog.work_date).order_by(EquipmentWorkLog.work_date).all()

    return [
        {
            "date": str(r.work_date),
            "total_hours": round(float(r.total_hours or 0), 2),
            "total_fuel": round(float(r.total_fuel or 0), 2),
            "equip_count": r.equip_count
        }
        for r in results
    ]


# ========== Dashboard: 设备状态总览 (NEW) ==========

@router.get("/dashboard/status-overview")
def get_equipment_status_overview(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """
    设备状态总览：统计各状态设备数量 + 最近7天闲置/高频使用设备
    
    状态计算规则：
    - working: 今天有工作日志（工时>0）
    - idle: 今天没有工作日志但设备active
    - maintenance: 有进行中的维护记录
    - broken: equipment.status标记
    """
    from datetime import timedelta
    
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    
    equip_query = filter_equipment_visibility(db.query(Equipment), Equipment, current_user)
    all_equipments = _sort_equipments(equip_query.all())
    visible_equipment_ids = [eq.id for eq in all_equipments]
    
    # 今天有工作日志的设备ID
    today_working = set()
    today_logs = db.query(EquipmentWorkLog.equipment_id).filter(
        EquipmentWorkLog.work_date == today,
        EquipmentWorkLog.work_hours > 0
    )
    today_logs = filter_by_mine(today_logs, EquipmentWorkLog, "mine_id", current_user)
    if visible_equipment_ids:
        today_logs = today_logs.filter(EquipmentWorkLog.equipment_id.in_(visible_equipment_ids))
    today_logs = today_logs.distinct().all()
    today_working = {row[0] for row in today_logs}
    
    # 进行中的维护记录
    active_maintenance = {}
    maints = db.query(EquipmentMaintenance).filter(
        EquipmentMaintenance.status.in_(["pending", "in_progress"])
    )
    maints = filter_by_mine(maints, EquipmentMaintenance, "mine_id", current_user)
    if visible_equipment_ids:
        maints = maints.filter(EquipmentMaintenance.equipment_id.in_(visible_equipment_ids))
    maints = maints.all()
    for m in maints:
        active_maintenance[m.equipment_id] = {
            "type": m.maintenance_type,
            "since": str(m.maintenance_date),
            "next_date": str(m.next_date) if m.next_date else None
        }
    
    # 最近7天工作汇总
    recent_work = db.query(
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    ).filter(
        EquipmentWorkLog.work_date >= seven_days_ago,
        EquipmentWorkLog.work_date <= today
    )
    recent_work = filter_by_mine(recent_work, EquipmentWorkLog, "mine_id", current_user)
    if visible_equipment_ids:
        recent_work = recent_work.filter(EquipmentWorkLog.equipment_id.in_(visible_equipment_ids))
    recent_work = recent_work.group_by(EquipmentWorkLog.equipment_id).all()
    recent_work_map = {}
    for row in recent_work:
        recent_work_map[row[0]] = {
            "total_hours": float(row[1] or 0),
            "total_fuel": float(row[2] or 0)
        }
    
    status_counts = {"working": 0, "idle": 0, "maintenance": 0, "broken": 0}
    idle_equipments = []
    high_usage_equipments = []
    
    for eq in all_equipments:
        eq_id = eq.id
        
        if eq.status == "broken":
            status_counts["broken"] += 1
        elif eq.status == "maintenance" or eq_id in active_maintenance:
            status_counts["maintenance"] += 1
        elif eq_id in today_working:
            status_counts["working"] += 1
        else:
            status_counts["idle"] += 1
            idle_equipments.append({
                "id": eq_id,
                "code": eq.code,
                "name": eq.name,
                "category": eq.category or "",
                "last_active": None  # 可后续扩展
            })
    
    # 高频使用设备（最近7天工时排行 top 5）
    sorted_usage = sorted(
        recent_work_map.items(),
        key=lambda x: x[1]["total_hours"],
        reverse=True
    )[:5]
    for eq_id, hours_data in sorted_usage:
        eq = next((e for e in all_equipments if e.id == eq_id), None)
        if eq:
            high_usage_equipments.append({
                "id": eq_id,
                "code": eq.code,
                "name": eq.name,
                "category": eq.category or "",
                "recent_7d_hours": hours_data["total_hours"],
                "recent_7d_fuel": hours_data["total_fuel"]
            })
    
    return {
        "total_count": len(all_equipments),
        "status_counts": status_counts,
        "idle_equipments": idle_equipments[:10],  # 最多返回10台闲置设备
        "high_usage_equipments": high_usage_equipments,
        "maintenance_active": len(active_maintenance),
        "timestamp": str(today)
    }


# ========== Dashboard: 设备工时排行 (NEW) ==========

@router.get("/dashboard/hours-ranking")
def get_equipment_hours_ranking(
    year: int = None,
    month: int = None,
    top_n: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """设备工时排行 - 指定月份内各设备工时排名"""
    today = date.today()
    year = year or today.year
    month = month or today.month
    
    query = db.query(
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel"),
        func.count(EquipmentWorkLog.id).label("work_days")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user)
    query = query.group_by(EquipmentWorkLog.equipment_id)
    query = query.order_by(func.sum(EquipmentWorkLog.work_hours).desc())
    query = query.limit(top_n)
    results = query.all()
    
    # 关联设备信息
    equip_ids = [r[0] for r in results]
    equip_map = {}
    if equip_ids:
        equips = db.query(Equipment).filter(Equipment.id.in_(equip_ids)).all()
        equip_map = {eq.id: eq for eq in equips}
    
    ranking = []
    for rank, (eq_id, hours, fuel, days) in enumerate(results, 1):
        eq = equip_map.get(eq_id)
        ranking.append({
            "rank": rank,
            "equipment_id": eq_id,
            "code": eq.code if eq else "未知",
            "name": eq.name if eq else "未知",
            "category": eq.category if eq else "",
            "total_hours": round(float(hours or 0), 2),
            "total_fuel": round(float(fuel or 0), 2),
            "work_days": int(days or 0)
        })
    
    return {
        "year": year,
        "month": month,
        "ranking": ranking
    }


@router.get("/worklogs/export-by-range")
def export_worklogs_by_range(
    start_date: str = None,
    end_date: str = None,
    equipment_id: str = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """按日期范围导出工作日志（含设备信息）"""
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


# ========== Reports ==========

def _build_worklog_query(db, current_user, year, month):
    today = date.today()
    year = year or today.year
    month = month or today.month
    query = db.query(EquipmentWorkLog, Equipment).join(Equipment, EquipmentWorkLog.equipment_id == Equipment.id).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user)
    return query, year, month


@router.get("/reports/monthly-detail")
def get_monthly_detail(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    query = db.query(EquipmentWorkSession, Equipment, Mine).join(
        Equipment, EquipmentWorkSession.equipment_id == Equipment.id
    ).outerjoin(
        Mine, EquipmentWorkSession.mine_id == Mine.id
    ).filter(
        extract('year', EquipmentWorkSession.start_time) == year,
        extract('month', EquipmentWorkSession.start_time) == month,
        EquipmentWorkSession.status.in_(["completed", "manual"])
    )
    query = filter_by_mine(query, EquipmentWorkSession, "mine_id", current_user, mine_id)
    results = query.order_by(EquipmentWorkSession.start_time).all()
    return [
        {
            "mine_id": session.mine_id,
            "mine_name": mine.name if mine else "",
            "equipment_code": eq.code,
            "equipment_name": eq.name,
            "work_date": str(session.start_time.date()) if session.start_time else "",
            "start_time": session.start_time,
            "end_time": session.end_time,
            "work_hours": float(session.duration_hours or 0),
            "duration_hours": float(session.duration_hours or 0),
            "status": session.status,
            "operator_name": session.operator_name or "",
            "remark": session.remark or "",
        }
        for session, eq, mine in results
    ]


@router.get("/reports/monthly-summary")
def get_monthly_summary(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today = date.today()
    year = year or today.year
    month = month or today.month

    session_query = db.query(
        EquipmentWorkSession.mine_id.label("mine_id"),
        Mine.name.label("mine_name"),
        Equipment.id.label("equipment_id"),
        Equipment.code.label("equipment_code"),
        Equipment.name.label("equipment_name"),
        func.sum(EquipmentWorkSession.duration_hours).label("total_hours"),
        func.count(func.distinct(func.date(EquipmentWorkSession.start_time))).label("work_days"),
        func.count(EquipmentWorkSession.id).label("session_count"),
    ).join(EquipmentWorkSession, Equipment.id == EquipmentWorkSession.equipment_id).outerjoin(
        Mine, EquipmentWorkSession.mine_id == Mine.id
    ).filter(
        extract('year', EquipmentWorkSession.start_time) == year,
        extract('month', EquipmentWorkSession.start_time) == month,
        EquipmentWorkSession.status.in_(["completed", "manual"])
    )
    session_query = filter_by_mine(session_query, EquipmentWorkSession, "mine_id", current_user, mine_id)
    session_rows = session_query.group_by(
        EquipmentWorkSession.mine_id,
        Mine.name,
        Equipment.id,
        Equipment.code,
        Equipment.name
    ).all()

    fuel_query = db.query(
        EquipmentWorkLog.mine_id,
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    fuel_query = filter_by_mine(fuel_query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    fuel_map = {
        (row.mine_id, row.equipment_id): float(row.total_fuel or 0)
        for row in fuel_query.group_by(EquipmentWorkLog.mine_id, EquipmentWorkLog.equipment_id).all()
    }

    return [
        {
            "mine_id": row.mine_id,
            "mine_name": row.mine_name or "",
            "equipment_code": row.equipment_code,
            "equipment_name": row.equipment_name,
            "total_hours": float(row.total_hours or 0),
            "total_fuel": fuel_map.get((row.mine_id, row.equipment_id), 0),
            "work_days": int(row.work_days or 0),
            "session_count": int(row.session_count or 0),
        }
        for row in session_rows
    ]


@router.get("/reports/monthly-detail/export")
def export_monthly_detail(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    query = db.query(EquipmentWorkSession, Equipment, Mine).join(
        Equipment, EquipmentWorkSession.equipment_id == Equipment.id
    ).outerjoin(
        Mine, EquipmentWorkSession.mine_id == Mine.id
    ).filter(
        extract('year', EquipmentWorkSession.start_time) == year,
        extract('month', EquipmentWorkSession.start_time) == month,
        EquipmentWorkSession.status.in_(["completed", "manual"])
    )
    query = filter_by_mine(query, EquipmentWorkSession, "mine_id", current_user, mine_id)
    sessions = query.order_by(EquipmentWorkSession.start_time).all()
    headers = ["日期", "矿山", "设备编号", "设备名称", "开始时间", "结束时间", "工时(小时)", "状态", "操作员", "备注"]
    rows = [
        [
            str(session.start_time.date()) if session.start_time else "",
            mine.name if mine else "",
            eq.code,
            eq.name,
            session.start_time.strftime("%Y-%m-%d %H:%M") if session.start_time else "",
            session.end_time.strftime("%Y-%m-%d %H:%M") if session.end_time else "",
            float(session.duration_hours or 0),
            session.status,
            session.operator_name or "",
            session.remark or "",
        ]
        for session, eq, mine in sessions
    ]
    return create_export(headers, rows, f"设备工作时间明细表_{year}_{month}.xlsx", [18, 18, 18, 18, 20, 20, 18, 14, 18, 30])


@router.get("/reports/monthly-summary/export")
def export_monthly_summary(
    year: int = None,
    month: int = None,
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today = date.today()
    year = year or today.year
    month = month or today.month

    session_query = db.query(
        EquipmentWorkSession.mine_id.label("mine_id"),
        Mine.name.label("mine_name"),
        Equipment.id.label("equipment_id"),
        Equipment.code,
        Equipment.name,
        func.sum(EquipmentWorkSession.duration_hours).label("total_hours"),
        func.count(func.distinct(func.date(EquipmentWorkSession.start_time))).label("work_days"),
        func.count(EquipmentWorkSession.id).label("session_count"),
    ).join(EquipmentWorkSession, Equipment.id == EquipmentWorkSession.equipment_id).outerjoin(
        Mine, EquipmentWorkSession.mine_id == Mine.id
    ).filter(
        extract('year', EquipmentWorkSession.start_time) == year,
        extract('month', EquipmentWorkSession.start_time) == month,
        EquipmentWorkSession.status.in_(["completed", "manual"])
    )
    session_query = filter_by_mine(session_query, EquipmentWorkSession, "mine_id", current_user, mine_id)
    summaries = session_query.group_by(
        EquipmentWorkSession.mine_id,
        Mine.name,
        Equipment.id,
        Equipment.code,
        Equipment.name
    ).all()

    fuel_query = db.query(
        EquipmentWorkLog.mine_id,
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel")
    ).filter(
        extract('year', EquipmentWorkLog.work_date) == year,
        extract('month', EquipmentWorkLog.work_date) == month
    )
    fuel_query = filter_by_mine(fuel_query, EquipmentWorkLog, "mine_id", current_user, mine_id)
    fuel_map = {
        (row.mine_id, row.equipment_id): float(row.total_fuel or 0)
        for row in fuel_query.group_by(EquipmentWorkLog.mine_id, EquipmentWorkLog.equipment_id).all()
    }

    headers = ["矿山", "设备编号", "设备名称", "月度总工时", "加油升数", "工作天数", "工时记录数"]
    rows = []
    for s in summaries:
        total_hours = float(s.total_hours or 0)
        total_fuel = fuel_map.get((s.mine_id, s.equipment_id), 0)
        rows.append([s.mine_name or "", s.code, s.name, total_hours, total_fuel, int(s.work_days or 0), int(s.session_count or 0)])

    return create_export(headers, rows, f"设备月度汇总工时表_{year}_{month}.xlsx", [18, 18, 18, 18, 18, 18, 18])


# ========== Smart Parse (Enhanced) ==========

@router.post("/smart-parse")
def smart_parse_text(
    req: ParseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """增强智能解析 - 支持多格式、车牌号识别、加油提取、别名匹配"""
    target_mine = get_target_mine_id(current_user, req.mine_id)
    if not target_mine and current_user.role == "super":
        first_mine = db.query(Mine).order_by(Mine.created_at).first()
        target_mine = first_mine.id if first_mine else None
    if target_mine:
        check_mine_access(current_user, target_mine)

    dev_list = _get_equipments_as_dicts(db, target_mine, current_user)
    if not dev_list:
        raise HTTPException(status_code=400, detail="No equipment found for this mine")

    parser = SmartParser(dev_list)

    parsed_records = parser.parse(req.text, default_mine_id=target_mine or "",
                                   creator=current_user.display_name)

    matcher = FleetMatcher(dev_list)
    errors = list(parser.errors)
    matched_count = 0

    for rec in parsed_records:
        validation_errors = rec.get("validation_errors") or []
        for validation_error in validation_errors:
            errors.append({
                "line_number": rec.get("line_number"),
                "line": rec.get("raw_text", ""),
                "error": validation_error,
                "severity": "error",
            })
        if rec.get("strict"):
            if rec.get("equipment_id"):
                matched_device = next((d for d in dev_list if d["id"] == rec["equipment_id"]), None)
                if matched_device:
                    rec["equipment_name"] = matched_device["name"]
                    rec["match_status"] = "matched"
                    if not validation_errors:
                        matched_count += 1
                else:
                    rec["equipment_id"] = ""
                    rec["match_status"] = "unmatched"
            else:
                rec["match_status"] = "unmatched"
            rec["is_valid"] = bool(rec.get("equipment_id")) and not validation_errors
            continue

        if rec.get('equipment_id'):
            matched_device = next((d for d in dev_list if d['id'] == rec['equipment_id']), None)
            if matched_device:
                rec['confidence'] = 'matched'
                rec['equipment_name'] = rec.get('equipment_name') or matched_device['name']
                matched_count += 1
            else:
                errors.append({
                    "line": rec.get('raw_text', ''),
                    "error": f"设备ID {rec['equipment_id']} 不存在",
                    "severity": "warning"
                })
                rec['confidence'] = 'unmatched'
        else:
            raw_text = rec.get('raw_text', '')
            matched_name_hint = rec.get('equipment_name', '')
            search_text = f"{matched_name_hint} {raw_text}" if matched_name_hint else raw_text

            dev_id, matched_name, score = matcher.find_best_match(search_text)
            if dev_id and score >= 0.5:
                rec['equipment_id'] = dev_id
                rec['equipment_name'] = matched_name
                rec['confidence'] = f'matched({score:.2f})'
                matched_count += 1
            else:
                errors.append({
                    "line": raw_text,
                    "error": f"无法匹配设备: {matched_name_hint or '未知'}",
                    "severity": "error" if not matched_name_hint else "warning"
                })
                rec['confidence'] = 'unmatched'

    return {
        "records": parsed_records,
        "parse_type": req.parse_type,
        "total": len(parsed_records),
        "matched": matched_count,
        "unmatched": len(parsed_records) - matched_count,
        "errors": errors,
        "summary": {
            "total_hours": round(sum(r.get('duration', 0) for r in parsed_records), 2),
            "total_fuel": round(sum(r.get('fuel', 0) for r in parsed_records), 2),
            "device_count": len(set(r.get('equipment_id', '') for r in parsed_records if r.get('equipment_id'))),
            "valid_count": len([r for r in parsed_records if r.get("is_valid", bool(r.get("equipment_id")))]),
            "invalid_count": len([r for r in parsed_records if not r.get("is_valid", bool(r.get("equipment_id")))]),
        }
    }


@router.post("/parse", response_model=ParseResponse)
def parse_text(
    req: ParseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """智能文本解析 - 将录入文本解析为结构化工作日志"""
    target_mine = get_target_mine_id(current_user, req.mine_id)
    if target_mine:
        check_mine_access(current_user, target_mine)

    dev_list = _get_equipments_as_dicts(db, target_mine, current_user)
    if not dev_list:
        raise HTTPException(status_code=400, detail="No equipment found for this mine")

    parser = SmartParser(dev_list)
    records = parser.parse(req.text, default_mine_id=target_mine or "",
                          creator=current_user.display_name)

    return ParseResponse(
        records=records,
        parse_type=req.parse_type,
        total=len(records)
    )


@router.post("/match")
def match_device(
    req: ParseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """单行文本匹配设备（用于UI预览/纠错）"""
    target_mine = get_target_mine_id(current_user, req.mine_id)
    if target_mine:
        check_mine_access(current_user, target_mine)

    dev_list = _get_equipments_as_dicts(db, target_mine, current_user)
    matcher = FleetMatcher(dev_list)

    results = []
    for line in req.text.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        dev_id, dev_name, score = matcher.find_best_match(line)
        results.append({
            "line": line,
            "equipment_id": dev_id,
            "equipment_name": dev_name,
            "score": score
        })

    return {"matches": results, "total": len(results)}


# ========== Quick Actions (NEW) ==========

@router.post("/{equipment_id}/quick-status")
def quick_toggle_equipment_status(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """快捷切换设备状态 active/broken，并可选添加备注"""
    eq = _get_and_check(db, Equipment, equipment_id, current_user)
    if eq.status == "active":
        eq.status = "broken"
    else:
        eq.status = "active"
    db.commit()
    db.refresh(eq)
    return {"equipment_id": eq.id, "status": eq.status, "message": f"设备 {eq.name} 状态已切换为 {eq.status}"}


@router.get("/dashboard/quick-summary")
def get_quick_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """首页快捷总览：设备状态概览 + 当日统计 + 待处理维护"""
    today = date.today()
    
    # 设备统计
    all_equips = _sort_equipments(filter_equipment_visibility(db.query(Equipment), Equipment, current_user).all())
    visible_equipment_ids = [eq.id for eq in all_equips]
    active_equips = [e for e in all_equips if e.status == "active"]
    broken_equips = [e for e in all_equips if e.status != "active"]
    
    # 当日工时油耗
    today_stats_query = db.query(
        func.sum(EquipmentWorkLog.work_hours).label("hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("fuel"),
        func.count(func.distinct(EquipmentWorkLog.equipment_id)).label("equip_count")
    ).filter(EquipmentWorkLog.work_date == today)
    today_stats_query = filter_by_mine(today_stats_query, EquipmentWorkLog, "mine_id", current_user)
    if visible_equipment_ids:
        today_stats_query = today_stats_query.filter(EquipmentWorkLog.equipment_id.in_(visible_equipment_ids))
    today_stats = today_stats_query.first()
    
    # 待处理维护
    pending_maintenance_query = db.query(EquipmentMaintenance, Equipment).join(
        Equipment, EquipmentMaintenance.equipment_id == Equipment.id
    ).filter(
        EquipmentMaintenance.status.in_(["pending", "in_progress"])
    )
    pending_maintenance_query = filter_by_mine(
        pending_maintenance_query,
        EquipmentMaintenance,
        "mine_id",
        current_user
    )
    if visible_equipment_ids:
        pending_maintenance_query = pending_maintenance_query.filter(
            EquipmentMaintenance.equipment_id.in_(visible_equipment_ids)
        )
    pending_maintenance = pending_maintenance_query.order_by(
        EquipmentMaintenance.next_date.asc().nullslast()
    ).limit(5).all()
    
    # 本月汇总
    month_start = date(today.year, today.month, 1)
    month_stats_query = db.query(
        func.sum(EquipmentWorkLog.work_hours).label("hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("fuel")
    ).filter(
        EquipmentWorkLog.work_date >= month_start,
        EquipmentWorkLog.work_date <= today
    )
    month_stats_query = filter_by_mine(month_stats_query, EquipmentWorkLog, "mine_id", current_user)
    if visible_equipment_ids:
        month_stats_query = month_stats_query.filter(EquipmentWorkLog.equipment_id.in_(visible_equipment_ids))
    month_stats = month_stats_query.first()
    
    return {
        "equipment": {
            "total": len(all_equips),
            "active": len(active_equips),
            "broken": len(broken_equips)
        },
        "today": {
            "total_hours": round(float(today_stats.hours or 0), 2),
            "total_fuel": round(float(today_stats.fuel or 0), 2),
            "equip_count": today_stats.equip_count or 0
        },
        "this_month": {
            "total_hours": round(float(month_stats.hours or 0), 2),
            "total_fuel": round(float(month_stats.fuel or 0), 2)
        },
        "pending_maintenance": [
            {
                "equipment_name": eq.name,
                "equipment_code": eq.code,
                "type": m.maintenance_type,
                "status": m.status,
                "next_date": str(m.next_date) if m.next_date else None,
                "cost": float(m.cost or 0)
            }
            for m, eq in pending_maintenance
        ],
        "timestamp": str(today)
    }
