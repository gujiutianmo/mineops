"""Fleet staff attendance router (driver/mechanic check-in/check-out)"""
import io
from datetime import date, datetime

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import FleetAttendanceRecord, FleetStaff
from schemas.fleet_attendance import FleetAttendanceCheckIn, FleetAttendanceManual, FleetAttendanceOut
from utils.excel_utils import create_export
from utils.fleet_scope import resolve_single_fleet_id
from utils.permissions import get_target_mine_id

router = APIRouter()


def _resolve_fleet_id(db: Session, current_user) -> str | None:
    requested_fleet_id = current_user.fleet_id if current_user.role == "fleet" else None
    try:
        return resolve_single_fleet_id(db, requested_fleet_id)
    except HTTPException:
        return requested_fleet_id or None


def _resolve_mine_id(db: Session, current_user, mine_id: str | None = None) -> str:
    target = get_target_mine_id(current_user, mine_id)
    if not target:
        raise HTTPException(status_code=400, detail="mine_id is required")
    return target


def _row_out(record: FleetAttendanceRecord) -> dict:
    return {
        "id": record.id,
        "mine_id": record.mine_id,
        "fleet_id": record.fleet_id,
        "staff_name": record.staff_name,
        "staff_role": record.staff_role,
        "check_in_time": record.check_in_time,
        "check_out_time": record.check_out_time,
        "duration_hours": float(record.duration_hours or 0),
        "status": record.status or "",
        "remark": record.remark or "",
        "created_at": record.created_at,
    }


@router.get("/staff-names")
def list_staff_names(
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get unique staff names for autocomplete dropdown"""
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    names = db.query(FleetAttendanceRecord.staff_name).filter(
        FleetAttendanceRecord.mine_id == target_mine
    ).distinct().order_by(FleetAttendanceRecord.staff_name).all()
    return [{"staff_name": name[0]} for name in names if name[0]]


@router.get("/records")
def list_attendance_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
    start_date: str | None = None,
    end_date: str | None = None,
    staff_role: str | None = None,
    status: str | None = None,
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    target_fleet = _resolve_fleet_id(db, current_user)
    query = db.query(FleetAttendanceRecord).filter(FleetAttendanceRecord.mine_id == target_mine)
    if target_fleet:
        query = query.filter(FleetAttendanceRecord.fleet_id == target_fleet)
    else:
        query = query.filter(FleetAttendanceRecord.fleet_id == None)
    if start_date:
        query = query.filter(FleetAttendanceRecord.check_in_time >= start_date)
    if end_date:
        query = query.filter(FleetAttendanceRecord.check_in_time <= f"{end_date} 23:59:59")
    if staff_role:
        query = query.filter(FleetAttendanceRecord.staff_role == staff_role)
    if status:
        query = query.filter(FleetAttendanceRecord.status == status)
    total = query.count()
    rows = query.order_by(FleetAttendanceRecord.check_in_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {"total": total, "items": [_row_out(row) for row in rows]}


@router.get("/today")
def today_attendance(
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    today = date.today()
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    target_fleet = _resolve_fleet_id(db, current_user)
    query = db.query(FleetAttendanceRecord).filter(
        FleetAttendanceRecord.mine_id == target_mine,
        func.date(FleetAttendanceRecord.check_in_time) == today,
    )
    if target_fleet:
        query = query.filter(FleetAttendanceRecord.fleet_id == target_fleet)
    else:
        query = query.filter(FleetAttendanceRecord.fleet_id == None)
    return [_row_out(row) for row in query.order_by(FleetAttendanceRecord.check_in_time.desc()).all()]


@router.get("/active")
def active_attendance(
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    target_fleet = _resolve_fleet_id(db, current_user)
    query = db.query(FleetAttendanceRecord).filter(
        FleetAttendanceRecord.mine_id == target_mine,
        FleetAttendanceRecord.status == "checked_in",
    )
    if target_fleet:
        query = query.filter(FleetAttendanceRecord.fleet_id == target_fleet)
    else:
        query = query.filter(FleetAttendanceRecord.fleet_id == None)
    return [_row_out(row) for row in query.order_by(FleetAttendanceRecord.check_in_time.desc()).all()]


@router.post("/check-in")
def check_in(
    data: FleetAttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, data.mine_id)
    target_fleet = data.fleet_id or _resolve_fleet_id(db, current_user)
    record = FleetAttendanceRecord(
        mine_id=target_mine,
        fleet_id=target_fleet,
        staff_name=data.staff_name,
        staff_role=data.staff_role,
        check_in_time=datetime.now(),
        status="checked_in",
        remark=data.remark or "",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.post("/manual")
def create_manual_attendance(
    data: FleetAttendanceManual,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, data.mine_id)
    target_fleet = data.fleet_id or _resolve_fleet_id(db, current_user)
    if data.check_out_time and data.check_out_time <= data.check_in_time:
        raise HTTPException(status_code=400, detail="签退时间必须晚于签到时间")
    duration = 0.0
    status = "checked_in"
    if data.check_out_time:
        duration = round((data.check_out_time - data.check_in_time).total_seconds() / 3600, 2)
        status = "checked_out"
    record = FleetAttendanceRecord(
        mine_id=target_mine,
        fleet_id=target_fleet,
        staff_name=data.staff_name,
        staff_role=data.staff_role,
        check_in_time=data.check_in_time,
        check_out_time=data.check_out_time,
        duration_hours=duration,
        status=status,
        remark=data.remark or "",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.post("/{record_id}/check-out")
def check_out(
    record_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    record = db.query(FleetAttendanceRecord).filter(FleetAttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="考勤记录不存在")
    if record.status != "checked_in":
        raise HTTPException(status_code=400, detail="该记录已签退")
    end_time = datetime.now()
    record.check_out_time = end_time
    record.duration_hours = round((end_time - record.check_in_time).total_seconds() / 3600, 2)
    record.status = "checked_out"
    db.commit()
    db.refresh(record)
    return _row_out(record)


@router.delete("/{record_id}")
def delete_attendance(
    record_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    record = db.query(FleetAttendanceRecord).filter(FleetAttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="考勤记录不存在")
    db.delete(record)
    db.commit()
    return {"message": "考勤记录已删除"}


# ── Staff Roster ──

@router.get("/staff")
def list_staff(
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    target_fleet = _resolve_fleet_id(db, current_user)
    query = db.query(FleetStaff).filter(FleetStaff.mine_id == target_mine)
    if target_fleet:
        query = query.filter(FleetStaff.fleet_id == target_fleet)
    else:
        query = query.filter(FleetStaff.fleet_id == None)
    rows = query.order_by(FleetStaff.staff_role, FleetStaff.staff_name).all()
    return [{"id": r.id, "staff_name": r.staff_name, "staff_role": r.staff_role, "remark": r.remark} for r in rows]


@router.get("/staff/template")
def download_staff_template():
    return create_export(["车队人员导入模板"], [["姓名", "角色", "备注"], ["张三", "司机", ""], ["李四", "修理工", ""]], "fleet_staff_template.xlsx", [20, 20, 30])


@router.post("/staff/import")
async def import_staff_excel(
    file: UploadFile = File(...),
    mine_id: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    target_mine = _resolve_mine_id(db, current_user, mine_id)
    target_fleet = _resolve_fleet_id(db, current_user)
    content = await file.read()
    workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    sheet = workbook.worksheets[0]
    imported, errors = 0, []
    for row_no, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        values = [str(v).strip() if v is not None else "" for v in row]
        if not values[0]:
            continue
        name = values[0]
        role = values[1] if len(values) > 1 and values[1] else "司机"
        if role not in ("司机", "修理工"):
            role = "司机"
        try:
            existing = db.query(FleetStaff).filter(
                FleetStaff.mine_id == target_mine,
                FleetStaff.staff_name == name,
            ).first()
            if existing:
                existing.staff_role = role
                if len(values) > 2 and values[2]:
                    existing.remark = values[2]
            else:
                db.add(FleetStaff(
                    mine_id=target_mine,
                    fleet_id=target_fleet,
                    staff_name=name,
                    staff_role=role,
                    remark=values[2] if len(values) > 2 and values[2] else "",
                ))
            imported += 1
        except Exception as e:
            errors.append(f"第{row_no}行: {str(e)}")
    db.commit()
    return {"message": f"成功导入 {imported} 人", "imported": imported, "errors": errors}
