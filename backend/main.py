"""
MineOps - Mine & Equipment Operations Management System
FastAPI Application Entry Point
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base, SessionLocal
from sqlalchemy import text
from jose import JWTError, jwt
from config import settings
from models import AuditLog, MineAccount
from routers import (
    auth,
    mine,
    equipment,
    employee,
    employee_attendance,
    fleet,
    fleet_attendance,
    finance,
    factory,
    fleet_org,
    ops_intelligence,
    plate,
    plate_counter,
    shipping,
    worklog,
    equipment_hours,
    maintenance,
    audit,
    analytics,
    admin_tools,
    bulk_import,
)

ROUTERS = [
    (auth.router, "/auth", ["Auth"]),
    (mine.router, "/mines", ["Mines"]),
    (equipment.router, "/equipment", ["Equipment"]),
    (employee.router, "/employees", ["Employees"]),
    (employee_attendance.router, "/employee-attendance", ["Employee Attendance"]),
    (fleet_attendance.router, "/fleet-attendance", ["Fleet Attendance"]),
    (fleet.router, "/fleet", ["Fleet"]),
    (finance.router, "/finance", ["Finance"]),
    (factory.router, "/factories", ["Factories"]),
    (fleet_org.router, "/fleet-orgs", ["Fleet Organizations"]),
    (ops_intelligence.router, "/ops-intelligence", ["Ops Intelligence"]),
    (plate.router, "/plates", ["Plates"]),
    (plate_counter.router, "/plate-counter", ["Plate Counter"]),
    (shipping.router, "/shipping", ["Shipping"]),
    (worklog.router, "/worklogs", ["Work Logs"]),
    (equipment_hours.router, "/equipment-hours", ["Equipment Hours"]),
    (maintenance.router, "/maintenance", ["Maintenance"]),
    (audit.router, "/audit", ["Audit"]),
    (analytics.router, "/analytics", ["Analytics"]),
    (admin_tools.router, "/admin-tools", ["Admin Tools"]),
    (bulk_import.router, "/bulk-import", ["Bulk Import"]),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        def ensure_column(table: str, column: str, ddl: str):
            columns = {row[1] for row in connection.execute(text(f"PRAGMA table_info({table})"))}
            if column not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))

        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(mine_account)"))}
        if "email" not in columns:
            connection.execute(text("ALTER TABLE mine_account ADD COLUMN email VARCHAR(255)"))
        if "must_change_password" not in columns:
            connection.execute(text("ALTER TABLE mine_account ADD COLUMN must_change_password INTEGER DEFAULT 0"))
        if "password_changed_at" not in columns:
            connection.execute(text("ALTER TABLE mine_account ADD COLUMN password_changed_at DATETIME"))
        if "fleet_id" not in columns:
            connection.execute(text("ALTER TABLE mine_account ADD COLUMN fleet_id VARCHAR(36)"))
        ensure_column("fleet_vehicle", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("fleet_maintenance_record", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("fleet_fuel_trip_record", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("plate_counter_daily_record", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("finance_record", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("shipping_record", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("factory", "fleet_id", "fleet_id VARCHAR(36)")
        ensure_column("plate", "fleet_id", "fleet_id VARCHAR(36)")
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_mine_account_email ON mine_account (email)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_mine_account_fleet_id ON mine_account (fleet_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_fleet_vehicle_fleet_plate ON fleet_vehicle (fleet_id, plate_number)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_fleet_maintenance_fleet_date ON fleet_maintenance_record (fleet_id, repair_date)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_fleet_fuel_fleet_date ON fleet_fuel_trip_record (fleet_id, record_date)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_plate_counter_fleet_date ON plate_counter_daily_record (fleet_id, record_date)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_finance_record_fleet_date ON finance_record (fleet_id, trans_date)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_shipping_record_fleet_time ON shipping_record (fleet_id, load_time)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_factory_fleet_id ON factory (fleet_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_plate_fleet_plate ON plate (fleet_id, plate_number)"))
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="MineOps API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def audit_mutations(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        method = request.method.upper()
        is_export = method == "GET" and "/export" in path
        if response.status_code < 400 and (method in {"POST", "PUT", "PATCH", "DELETE"} or is_export):
            if path not in {"/auth/login", "/auth/password-reset/request", "/auth/password-reset/confirm"}:
                authorization = request.headers.get("authorization", "")
                if authorization.lower().startswith("bearer "):
                    db = SessionLocal()
                    try:
                        payload = jwt.decode(authorization.split(" ", 1)[1], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
                        username = payload.get("sub")
                        user = db.query(MineAccount).filter(MineAccount.username == username).first() if username else None
                        if user:
                            parts = [part for part in path.split("/") if part]
                            resource = parts[0] if parts else "system"
                            resource_id = parts[-1] if len(parts) > 1 and len(parts[-1]) >= 8 and parts[-1] not in {"excel", "csv"} else ""
                            if is_export:
                                action = "EXPORT"
                            elif "/import" in path:
                                action = "IMPORT"
                            else:
                                action = {"POST": "CREATE", "PUT": "UPDATE", "PATCH": "UPDATE", "DELETE": "DELETE"}.get(method, method)
                            db.add(AuditLog(
                                user_id=user.id,
                                username=user.username,
                                action=action,
                                resource=resource,
                                resource_id=resource_id[:36],
                                detail=f"{method} {path}"[:1000],
                                ip_address=(request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip() or (request.client.host if request.client else ""))[:50],
                            ))
                            db.commit()
                    except (JWTError, Exception):
                        db.rollback()
                    finally:
                        db.close()
        return response

    for router, prefix, tags in ROUTERS:
        app.include_router(router, prefix=prefix, tags=tags)

    @app.get("/")
    def health_check():
        return {"message": "MineOps API is running", "version": "1.0.0"}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=True)
