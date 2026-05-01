from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Employee
from schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeOut
from auth import get_current_active_user
from utils.permissions import check_mine_access, filter_by_mine, get_target_mine_id
from utils.crud_helpers import get_object_or_404
from utils.excel_utils import create_template, create_export, parse_import_file

router = APIRouter()

EMPLOYEE_HEADERS = ["法文姓名", "中文姓名", "人员类型(中方/刚方)", "职位", "薪资", "货币(USD/CDF)"]
EMPLOYEE_FIELDS = ["name_fr", "name_cn", "staff_type", "job", "salary", "currency"]


def _get_and_check(db, model, obj_id, current_user):
    obj = get_object_or_404(db, model, obj_id)
    check_mine_access(current_user, obj.mine_id)
    return obj


@router.get("/", response_model=List[EmployeeOut])
def read_employees(
    skip: int = 0,
    limit: int = 100,
    mine_id: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(Employee), Employee, "mine_id", current_user, mine_id)
    if search:
        query = query.filter(
            Employee.name_fr.contains(search)
            | Employee.name_cn.contains(search)
            | Employee.job.contains(search)
        )
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=EmployeeOut)
def create_employee(
    employee: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, employee.mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")
    check_mine_access(current_user, target_mine)

    db_employee = Employee(
        mine_id=target_mine,
        name_fr=employee.name_fr,
        name_cn=employee.name_cn or "",
        staff_type=employee.staff_type.value if employee.staff_type else "",
        job=employee.job or "",
        salary=employee.salary or 0,
        currency=employee.currency.value if employee.currency else "USD"
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@router.get("/{employee_id}", response_model=EmployeeOut)
def read_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    return _get_and_check(db, Employee, employee_id, current_user)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: str,
    employee_update: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_employee = _get_and_check(db, Employee, employee_id, current_user)
    for field in EMPLOYEE_FIELDS:
        val = getattr(employee_update, field, None)
        if val is not None:
            setattr(db_employee, field, val)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    db_employee = _get_and_check(db, Employee, employee_id, current_user)
    db.delete(db_employee)
    db.commit()
    return {"message": "员工已删除"}


# ========== Excel Import/Export ==========

@router.get("/import/template")
def download_employee_template(current_user=Depends(get_current_active_user)):
    return create_template(EMPLOYEE_HEADERS, "员工导入模板.xlsx", [20, 20, 18, 18, 14, 14])


@router.post("/import/excel")
async def import_employee_excel(
    mine_id: str = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    target_mine = get_target_mine_id(current_user, mine_id)
    if target_mine is None:
        raise HTTPException(status_code=400, detail="mine_id is required")

    ws = await parse_import_file(file, EMPLOYEE_HEADERS)
    imported = 0
    errors = []

    for row in range(2, ws.max_row + 1):
        name_fr = ws.cell(row=row, column=1).value
        name_cn = ws.cell(row=row, column=2).value or ""
        staff_type = ws.cell(row=row, column=3).value or ""
        job = ws.cell(row=row, column=4).value or ""
        salary = ws.cell(row=row, column=5).value or 0
        currency = ws.cell(row=row, column=6).value or "USD"

        if not name_fr:
            errors.append(f"第{row}行: 法文姓名为空")
            continue

        db.add(Employee(
            mine_id=target_mine,
            name_fr=str(name_fr),
            name_cn=str(name_cn),
            staff_type=str(staff_type),
            job=str(job),
            salary=float(salary),
            currency=str(currency)
        ))
        imported += 1

    db.commit()
    return {"message": f"成功导入 {imported} 条记录", "imported": imported, "errors": errors}


@router.get("/export/excel")
def export_employee_excel(
    mine_id: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = filter_by_mine(db.query(Employee), Employee, "mine_id", current_user, mine_id)
    employees = query.all()
    rows = [[e.name_fr, e.name_cn, e.staff_type, e.job, e.salary, e.currency] for e in employees]
    return create_export(EMPLOYEE_HEADERS, rows, "员工名单.xlsx", [20, 18, 18, 18, 14, 14])
