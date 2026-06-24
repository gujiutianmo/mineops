from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import date
from database import get_db
from models import ShippingRecord, AuthorizedPlate, Factory, FleetOrganization, Mine, Plate
from schemas.shipping import ShippingCreate, ShippingUpdate, ShippingOut
from schemas.factory import FactoryCreate, FactoryUpdate, FactoryOut
from schemas.plate import PlateCreate, PlateUpdate, PlateOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.fleet_scope import resolve_single_fleet_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_template, create_export, parse_import_file
from services.plate_comparison import build_plate_comparison
from services.data_governance import archive_record, assert_period_unlocked

router = APIRouter()

SHIPPING_FIELDS = ["plate_number", "load_time", "factory_id", "cargo_type"]
FACTORY_FIELDS = ["name"]
PLATE_HEADERS = ["车牌号", "车辆类型", "品牌", "颜色", "备注"]
PLATE_FIELDS = ["plate_number", "vehicle_type", "brand", "color", "remark"]


def _get_and_check(db, model, obj_id, current_user):
    """通用权限检查"""
    obj = get_object_or_404(db, model, obj_id)
    _check_scope(current_user, obj)
    return obj


def _first_mine_id(db: Session) -> str | None:
    first_mine = db.query(Mine).order_by(Mine.created_at).first()
    return first_mine.id if first_mine else None


def _get_fleet(db: Session, fleet_id: str | None) -> FleetOrganization | None:
    if not fleet_id:
        return None
    fleet = db.query(FleetOrganization).filter(FleetOrganization.id == fleet_id, FleetOrganization.active == 1).first()
    if not fleet:
        raise HTTPException(status_code=400, detail="Fleet organization does not exist or is disabled")
    return fleet


def _scope_for_request(db: Session, current_user, mine_id: str | None = None, fleet_id: str | None = None) -> dict:
    fleet_id = resolve_single_fleet_id(db, fleet_id)
    if current_user.role == "fleet":
        if not current_user.fleet_id:
            raise HTTPException(status_code=403, detail="Fleet account is not bound to a fleet")
        fleet = _get_fleet(db, current_user.fleet_id)
        target_mine = fleet.mine_id or _first_mine_id(db)
        if not target_mine:
            raise HTTPException(status_code=400, detail="No backing mine exists for fleet data")
        return {"mine_id": target_mine, "fleet_id": fleet.id}
    if fleet_id:
        if current_user.role != "super":
            raise HTTPException(status_code=403, detail="Only super admin can select fleet scope")
        fleet = _get_fleet(db, fleet_id)
        target_mine = fleet.mine_id or _first_mine_id(db)
        if not target_mine:
            raise HTTPException(status_code=400, detail="No backing mine exists for fleet data")
        return {"mine_id": target_mine, "fleet_id": fleet.id}
    target_mine = get_target_mine_id(current_user, mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)
    return {"mine_id": target_mine, "fleet_id": None}


def _filter_scope(query, model, current_user, mine_id: str | None = None, fleet_id: str | None = None):
    fleet_id = resolve_single_fleet_id(query.session, fleet_id)
    if current_user.role == "fleet":
        return query.filter(getattr(model, "fleet_id") == current_user.fleet_id)
    if fleet_id:
        if current_user.role != "super":
            raise HTTPException(status_code=403, detail="Only super admin can select fleet scope")
        return query.filter(getattr(model, "fleet_id") == fleet_id)
    query = filter_by_mine(query, model, "mine_id", current_user, mine_id)
    return query.filter(getattr(model, "fleet_id") == None)


def _check_scope(current_user, obj):
    fleet_id = getattr(obj, "fleet_id", None)
    if current_user.role == "fleet":
        if fleet_id != current_user.fleet_id:
            raise HTTPException(status_code=403, detail="Permission denied")
        return
    if fleet_id and current_user.role != "super":
        raise HTTPException(status_code=403, detail="Permission denied")
    if not fleet_id:
        check_mine_access(current_user, obj.mine_id)


def _get_factory_for_scope(db: Session, factory_id: str, mine_id: str, fleet_id: str | None, current_user):
    factory = get_object_or_404(db, Factory, factory_id)
    _check_scope(current_user, factory)
    if factory.mine_id != mine_id or factory.fleet_id != fleet_id:
        raise HTTPException(status_code=400, detail="factory_id does not belong to target scope")
    return factory


# ===================== 运输记录 (Shipping) =====================

@router.get("/", response_model=List[ShippingOut])
def read_shippings(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    fleet_id: str = None,
    factory_id: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = _filter_scope(db.query(ShippingRecord), ShippingRecord, current_user, mine_id, fleet_id)
    if factory_id:
        query = query.filter(ShippingRecord.factory_id == factory_id)
    if start_date:
        query = query.filter(ShippingRecord.load_time >= start_date)
    if end_date:
        query = query.filter(ShippingRecord.load_time <= end_date)
    return query.order_by(ShippingRecord.load_time.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=ShippingOut)
def create_shipping(
    shipping: ShippingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    scope = _scope_for_request(db, current_user, shipping.mine_id, shipping.fleet_id)
    target_mine = scope["mine_id"]
    target_fleet = scope["fleet_id"]
    assert_period_unlocked(db, target_mine, "shipping", shipping.load_time)
    _get_factory_for_scope(db, shipping.factory_id, target_mine, target_fleet, current_user)

    db_shipping = ShippingRecord(
        mine_id=target_mine,
        fleet_id=target_fleet,
        plate_number=shipping.plate_number,
        load_time=shipping.load_time,
        factory_id=shipping.factory_id,
        cargo_type=shipping.cargo_type
    )
    db.add(db_shipping)
    db.commit()
    db.refresh(db_shipping)
    return db_shipping


# ===================== 工厂管理 (Factories) - 运输子功能 =====================
# NOTE: 必须在 /{shipping_id} 动态路由之前定义

@router.get("/factories/", response_model=List[FactoryOut])
def read_factories(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    fleet_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = _filter_scope(db.query(Factory), Factory, current_user, mine_id, fleet_id)
    return query.offset(skip).limit(limit).all()


@router.post("/factories/", response_model=FactoryOut)
def create_factory(
    factory: FactoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    scope = _scope_for_request(db, current_user, factory.mine_id, factory.fleet_id)
    target_mine = scope["mine_id"]
    target_fleet = scope["fleet_id"]

    db_factory = Factory(mine_id=target_mine, fleet_id=target_fleet, name=factory.name)
    db.add(db_factory)
    db.commit()
    db.refresh(db_factory)
    return db_factory


@router.get("/factories/{factory_id}", response_model=FactoryOut)
def read_factory(
    factory_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Factory, factory_id, current_user)


@router.put("/factories/{factory_id}", response_model=FactoryOut)
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


@router.delete("/factories/{factory_id}")
def delete_factory(
    factory_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_factory = _get_and_check(db, Factory, factory_id, current_user)
    db.delete(db_factory)
    db.commit()
    return {"message": "工厂已删除"}


# ===================== 授权车牌管理 (Plates) - 运输子功能 =====================

@router.get("/plates/", response_model=List[PlateOut])
def read_plates(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    fleet_id: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = _filter_scope(db.query(Plate), Plate, current_user, mine_id, fleet_id)
    if search:
        query = query.filter(
            Plate.plate_number.contains(search)
            | Plate.vehicle_type.contains(search)
            | Plate.brand.contains(search)
        )
    return query.offset(skip).limit(limit).all()


@router.post("/plates/", response_model=PlateOut)
def create_plate(
    plate: PlateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    scope = _scope_for_request(db, current_user, plate.mine_id, plate.fleet_id)
    target_mine = scope["mine_id"]
    target_fleet = scope["fleet_id"]

    db_plate = Plate(
        mine_id=target_mine,
        fleet_id=target_fleet,
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


@router.get("/plates/{plate_id}", response_model=PlateOut)
def read_plate(
    plate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Plate, plate_id, current_user)


@router.put("/plates/{plate_id}", response_model=PlateOut)
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


@router.delete("/plates/{plate_id}")
def delete_plate(
    plate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_plate = _get_and_check(db, Plate, plate_id, current_user)
    db.delete(db_plate)
    db.commit()
    return {"message": "车牌已删除"}


# ===================== Excel 导入导出 (车牌) - 运输子功能 =====================

@router.get("/plates/import/template")
def download_plate_template(current_user=Depends(get_current_active_user)):
    return create_template(PLATE_HEADERS, "车牌导入模板.xlsx", [20, 18, 18, 15, 20])


@router.post("/plates/import/excel")
async def import_plate_excel(
    mine_id: str = None,
    fleet_id: str = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    scope = _scope_for_request(db, current_user, mine_id, fleet_id)
    target_mine = scope["mine_id"]
    target_fleet = scope["fleet_id"]

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
            Plate.fleet_id == target_fleet,
            Plate.plate_number == str(plate_number)
        ).first()
        if existing:
            errors.append(f"第{row}行: 车牌 {plate_number} 已存在")
            continue

        db.add(Plate(
            mine_id=target_mine, fleet_id=target_fleet, plate_number=str(plate_number),
            vehicle_type=str(vehicle_type), brand=str(brand),
            color=str(color), remark=str(remark)
        ))
        imported += 1

    db.commit()
    return {"message": f"成功导入 {imported} 条记录", "imported": imported, "errors": errors}


@router.get("/plates/export/excel")
def export_plate_excel(
    mine_id: str = None,
    fleet_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = _filter_scope(db.query(Plate), Plate, current_user, mine_id, fleet_id)
    plates = query.all()
    rows = [[p.plate_number, p.vehicle_type, p.brand, p.color, p.remark] for p in plates]
    return create_export(PLATE_HEADERS, rows, "车牌列表.xlsx", [20, 18, 18, 15, 20])


# ===================== 运输报表 =====================

@router.get("/reports/plate-comparison")
def get_plate_comparison(
    mine_id: str = None,
    fleet_id: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """车牌比对：找出运输记录中出现但不在授权车牌列表中的车牌"""
    plate_query = _filter_scope(db.query(Plate), Plate, current_user, mine_id, fleet_id)
    authorized_plates = [p.plate_number for p in plate_query.all()]

    shipping_query = db.query(
        ShippingRecord.plate_number,
        ShippingRecord.load_time,
        ShippingRecord.factory_id,
        ShippingRecord.cargo_type,
        Factory.name.label("factory_name")
    ).join(
        Factory,
        ShippingRecord.factory_id == Factory.id
    )
    shipping_query = _filter_scope(shipping_query, ShippingRecord, current_user, mine_id, fleet_id)
    if start_date:
        shipping_query = shipping_query.filter(ShippingRecord.load_time >= start_date)
    if end_date:
        shipping_query = shipping_query.filter(ShippingRecord.load_time <= end_date)

    shipping_rows = [
        {
            "plate_number": row.plate_number,
            "load_time": row.load_time,
            "factory_id": row.factory_id,
            "factory_name": row.factory_name,
            "cargo_type": row.cargo_type
        }
        for row in shipping_query.order_by(ShippingRecord.load_time.desc()).all()
    ]

    return build_plate_comparison(authorized_plates, shipping_rows)


@router.get("/reports/plate-ranking")
def get_plate_ranking(
    mine_id: str = None,
    fleet_id: str = None,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """车牌运输次数排名"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    query = db.query(
        ShippingRecord.plate_number,
        func.count(ShippingRecord.id).label("count")
    ).filter(
        extract('year', ShippingRecord.load_time) == year,
        extract('month', ShippingRecord.load_time) == month
    )
    query = _filter_scope(query, ShippingRecord, current_user, mine_id, fleet_id)

    results = query.group_by(ShippingRecord.plate_number).order_by(
        func.count(ShippingRecord.id).desc()
    ).limit(20).all()

    return {
        "year": year,
        "month": month,
        "ranking": [
            {"plate_number": r.plate_number, "count": r.count}
            for r in results
        ]
    }


@router.get("/reports/factory-stats")
def get_factory_shipping_stats(
    mine_id: str = None,
    fleet_id: str = None,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """各工厂运输次数统计"""
    today = date.today()
    year = year or today.year
    month = month or today.month

    query = db.query(
        ShippingRecord.factory_id,
        Factory.name.label("factory_name"),
        func.count(ShippingRecord.id).label("count")
    ).join(Factory, ShippingRecord.factory_id == Factory.id).filter(
        extract('year', ShippingRecord.load_time) == year,
        extract('month', ShippingRecord.load_time) == month
    )
    query = _filter_scope(query, ShippingRecord, current_user, mine_id, fleet_id)

    results = query.group_by(ShippingRecord.factory_id, Factory.name).order_by(
        func.count(ShippingRecord.id).desc()
    ).all()

    return {
        "year": year,
        "month": month,
        "factories": [
            {"factory_id": r.factory_id, "factory_name": r.factory_name, "count": r.count}
            for r in results
        ]
    }


# ===================== 运输记录 CRUD (动态路由，必须在所有静态路由之后) =====================

@router.get("/{shipping_id}", response_model=ShippingOut)
def read_shipping(
    shipping_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, ShippingRecord, shipping_id, current_user)


@router.put("/{shipping_id}", response_model=ShippingOut)
def update_shipping(
    shipping_id: str,
    shipping_update: ShippingUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_shipping = _get_and_check(db, ShippingRecord, shipping_id, current_user)
    assert_period_unlocked(db, db_shipping.mine_id, "shipping", db_shipping.load_time)
    if shipping_update.load_time is not None:
        assert_period_unlocked(db, db_shipping.mine_id, "shipping", shipping_update.load_time)
    if shipping_update.factory_id is not None:
        _get_factory_for_scope(db, shipping_update.factory_id, db_shipping.mine_id, db_shipping.fleet_id, current_user)
    for field in SHIPPING_FIELDS:
        val = getattr(shipping_update, field, None)
        if val is not None:
            setattr(db_shipping, field, val)
    db.commit()
    db.refresh(db_shipping)
    return db_shipping


@router.delete("/{shipping_id}")
def delete_shipping(
    shipping_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_shipping = _get_and_check(db, ShippingRecord, shipping_id, current_user)
    assert_period_unlocked(db, db_shipping.mine_id, "shipping", db_shipping.load_time)
    archive_record(db, db_shipping, "shipping", current_user)
    db.delete(db_shipping)
    db.commit()
    return {"message": "运输记录已删除"}
