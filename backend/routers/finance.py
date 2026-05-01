from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import date
from database import get_db
from models import FinanceRecord
from schemas.finance import FinanceCreate, FinanceUpdate, FinanceOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_template, create_export, parse_import_file

router = APIRouter()

FINANCE_FIELDS = ["trans_type", "amount", "currency", "category", "description", "recorder", "trans_date"]

FINANCE_HEADERS = ["类型(收入/支出)", "金额", "货币(USD/CDF)", "类别", "描述", "记录人", "日期"]


def _get_and_check(db, model, obj_id, current_user):
    obj = get_object_or_404(db, model, obj_id)
    check_mine_access(current_user, obj.mine_id)
    return obj


# ========== Finance CRUD (List/Create) ==========

@router.get("/", response_model=List[FinanceOut])
def read_finances(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    trans_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(FinanceRecord), FinanceRecord, "mine_id", current_user, mine_id)
    if trans_type:
        query = query.filter(FinanceRecord.trans_type == trans_type)
    if start_date:
        query = query.filter(FinanceRecord.trans_date >= start_date)
    if end_date:
        query = query.filter(FinanceRecord.trans_date <= end_date)
    return query.order_by(FinanceRecord.trans_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=FinanceOut)
def create_finance(
    finance: FinanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, finance.mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    db_finance = FinanceRecord(
        mine_id=target_mine,
        trans_type=finance.trans_type,
        amount=finance.amount,
        currency=finance.currency,
        category=finance.category,
        description=finance.description,
        recorder=finance.recorder,
        trans_date=finance.trans_date
    )
    db.add(db_finance)
    db.commit()
    db.refresh(db_finance)
    return db_finance


# ========== Excel Import/Export (静态路由，必须在 /{finance_id} 之前) ==========

@router.get("/import/template")
def download_finance_template(current_user=Depends(get_current_active_user)):
    return create_template(FINANCE_HEADERS, "财务模板.xlsx", [18, 14, 16, 16, 22, 16, 14])


@router.post("/import/excel")
async def import_finance_excel(
    mine_id: str = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")

    ws = await parse_import_file(file, FINANCE_HEADERS)
    imported = 0
    errors = []

    for row in range(2, ws.max_row + 1):
        trans_type = ws.cell(row=row, column=1).value
        amount = ws.cell(row=row, column=2).value
        currency = ws.cell(row=row, column=3).value or "USD"
        category = ws.cell(row=row, column=4).value or ""
        description = ws.cell(row=row, column=5).value or ""
        recorder = ws.cell(row=row, column=6).value or ""
        trans_date_val = ws.cell(row=row, column=7).value

        if not trans_type or not amount or not trans_date_val:
            errors.append(f"第{row}行: 类型、金额或日期为空")
            continue

        ttype = str(trans_type).strip()
        if "收入" in ttype or ttype.lower() == "income":
            ttype = "income"
        elif "支出" in ttype or ttype.lower() == "expense":
            ttype = "expense"
        else:
            errors.append(f"第{row}行: 类型必须为收入或支出, 当前值: {ttype}")
            continue

        from datetime import datetime
        if isinstance(trans_date_val, datetime):
            trans_date_val = trans_date_val.date()
        elif isinstance(trans_date_val, str):
            try:
                trans_date_val = datetime.strptime(trans_date_val, "%Y-%m-%d").date()
            except:
                errors.append(f"第{row}行: 日期格式错误, 请使用YYYY-MM-DD格式")
                continue

        db.add(FinanceRecord(
            mine_id=target_mine,
            trans_type=ttype,
            amount=float(amount),
            currency=str(currency),
            category=str(category),
            description=str(description),
            recorder=str(recorder),
            trans_date=trans_date_val
        ))
        imported += 1

    db.commit()
    return {"message": f"成功导入 {imported} 条记录", "imported": imported, "errors": errors}


@router.get("/export/excel")
def export_finance_excel(
    mine_id: str = None,
    trans_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(FinanceRecord), FinanceRecord, "mine_id", current_user, mine_id)
    if trans_type:
        query = query.filter(FinanceRecord.trans_type == trans_type)
    if start_date:
        query = query.filter(FinanceRecord.trans_date >= start_date)
    if end_date:
        query = query.filter(FinanceRecord.trans_date <= end_date)
    records = query.order_by(FinanceRecord.trans_date.desc()).all()
    rows = [[r.trans_type, r.amount, r.currency, r.category, r.description, r.recorder, str(r.trans_date)]
            for r in records]
    return create_export(FINANCE_HEADERS, rows, "财务记录.xlsx", [18, 14, 16, 16, 22, 16, 14])


# ========== Finance Reports (静态路由，必须在 /{finance_id} 之前) ==========

def _build_finance_summary_query(db, current_user, year, month, mine_id):
    today = date.today()
    year = year or today.year
    month = month or today.month
    query = db.query(FinanceRecord).filter(
        extract('year', FinanceRecord.trans_date) == year,
        extract('month', FinanceRecord.trans_date) == month
    )
    query = filter_by_mine(query, FinanceRecord, "mine_id", current_user, mine_id)
    return query, year, month


@router.get("/summary/by-currency")
def get_finance_summary_by_currency(
    mine_id: str = None,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    base_query, year, month = _build_finance_summary_query(db, current_user, year, month, mine_id)

    results = base_query.with_entities(
        FinanceRecord.currency,
        FinanceRecord.trans_type,
        func.sum(FinanceRecord.amount).label("total")
    ).group_by(FinanceRecord.currency, FinanceRecord.trans_type).all()

    summary = {}
    for r in results:
        currency = r.currency
        if currency not in summary:
            summary[currency] = {"income": 0, "expense": 0}
        summary[currency][r.trans_type] = float(r.total or 0)

    return {"year": year, "month": month, "currencies": summary}


@router.get("/summary/expense-by-category")
def get_expense_by_category(
    mine_id: str = None,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    base_query, year, month = _build_finance_summary_query(db, current_user, year, month, mine_id)

    results = base_query.with_entities(
        FinanceRecord.category,
        func.sum(FinanceRecord.amount).label("total")
    ).filter(
        FinanceRecord.trans_type == "expense"
    ).group_by(FinanceRecord.category).all()

    return {
        "year": year,
        "month": month,
        "categories": [
            {"category": r.category or "uncategorized", "amount": float(r.total or 0)}
            for r in results
        ]
    }


# ========== Finance CRUD (动态路由，必须在所有静态路由之后) ==========

@router.get("/{finance_id}", response_model=FinanceOut)
def read_finance(
    finance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, FinanceRecord, finance_id, current_user)


@router.put("/{finance_id}", response_model=FinanceOut)
def update_finance(
    finance_id: str,
    finance_update: FinanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_finance = _get_and_check(db, FinanceRecord, finance_id, current_user)
    for field in FINANCE_FIELDS:
        val = getattr(finance_update, field, None)
        if val is not None:
            setattr(db_finance, field, val)
    db.commit()
    db.refresh(db_finance)
    return db_finance


@router.delete("/{finance_id}")
def delete_finance(
    finance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_finance = _get_and_check(db, FinanceRecord, finance_id, current_user)
    db.delete(db_finance)
    db.commit()
    return {"message": "财务记录已删除"}
