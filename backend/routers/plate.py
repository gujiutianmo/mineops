from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Plate
from schemas.plate import PlateCreate, PlateUpdate, PlateOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_template, create_export, parse_import_file

router = APIRouter()

PLATE_HEADERS = ["车牌号", "车辆类型", "品牌", "颜色", "备注"]
PLATE_FIELDS = ["plate_number", "vehicle_type", "brand", "color", "remark"]


def _get_and_check(db, model, obj_id, current_user):
    obj = get_object_or_404(db, model, obj_id)
    check_mine_access(current_user, obj.mine_id)
    return obj


@router.get("/", response_model=List[PlateOut])
def read_plates(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(Plate), Plate, "mine_id", current_user, mine_id)
    if search:
        query = query.filter(
            Plate.plate_number.contains(search)
            | Plate.vehicle_type.contains(search)
            | Plate.brand.contains(search)
        )
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=PlateOut)
def create_plate(
    plate: PlateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, plate.mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    db_plate = Plate(
        mine_id=target_mine,
        plate_number=plate.plate_number,
        vehicle_type=plate.vehicle_type,
        brand=plate.brand,
        color=plate.color,
        remark=plate.remark
    )
    db.add(db_plate)
    db.commit()
    db.refresh(db_plate)
    return db_plate


@router.get("/{plate_id}", response_model=PlateOut)
def read_plate(
    plate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Plate, plate_id, current_user)


@router.put("/{plate_id}", response_model=PlateOut)
def update_plate(
    plate_id: str,
    plate_update: PlateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_plate = _get_and_check(db, Plate, plate_id, current_user)
    for field in PLATE_FIELDS:
        val = getattr(plate_update, field, None)
        if val is not None:
            setattr(db_plate, field, val)
    db.commit()
    db.refresh(db_plate)
    return db_plate


@router.delete("/{plate_id}")
def delete_plate(
    plate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_plate = _get_and_check(db, Plate, plate_id, current_user)
    db.delete(db_plate)
    db.commit()
    return {"message": "车牌已删除"}


# ========== Excel Import/Export ==========

@router.get("/import/template")
def download_plate_template(current_user=Depends(get_current_active_user)):
    return create_template(PLATE_HEADERS, "车牌导入模板.xlsx", [20, 18, 18, 15, 20])


@router.post("/import/excel")
async def import_plate_excel(
    mine_id: str = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")

    ws = await parse_import_file(file, PLATE_HEADERS)
    imported = 0
    errors = []

    for row in range(2, ws.max_row + 1):
        plate_number = ws.cell(row=row, column=1).value
        vehicle_type = ws.cell(row=row, column=2).value or ""
        brand = ws.cell(row=row, column=3).value or ""
        color = ws.cell(row=row, column=4).value or ""
        remark = ws.cell(row=row, column=5).value or ""

        if not plate_number:
            errors.append(f"第{row}行: 车牌号为空")
            continue

        existing = db.query(Plate).filter(
            Plate.mine_id == target_mine,
            Plate.plate_number == str(plate_number)
        ).first()
        if existing:
            errors.append(f"第{row}行: 车牌 {plate_number} 已存在")
            continue

        db.add(Plate(
            mine_id=target_mine, plate_number=str(plate_number),
            vehicle_type=str(vehicle_type), brand=str(brand),
            color=str(color), remark=str(remark)
        ))
        imported += 1

    db.commit()
    return {"message": f"成功导入 {imported} 条记录", "imported": imported, "errors": errors}


@router.get("/export/excel")
def export_plate_excel(
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(Plate), Plate, "mine_id", current_user, mine_id)
    plates = query.all()
    rows = [[p.plate_number, p.vehicle_type, p.brand, p.color, p.remark] for p in plates]
    return create_export(PLATE_HEADERS, rows, "车牌列表.xlsx", [20, 18, 18, 15, 20])
