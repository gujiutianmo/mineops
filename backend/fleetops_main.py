"""Standalone FleetOps API backed by its own database."""

import json
import os
import urllib.error
import urllib.request
from contextlib import asynccontextmanager

os.environ.setdefault("FLEETOPS_SINGLE_FLEET", "1")

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

from auth import get_current_active_user
from config import settings
from database import Base, SessionLocal, engine
from models import AuditLog, MineAccount
from routers import admin_tools, auth, bulk_import, factory, finance, fleet, fleet_attendance, plate_counter, shipping


FLEETOPS_ROUTERS = [
    (auth.router, "/auth", ["Auth"]),
    (fleet.router, "/fleet", ["Fleet"]),
    (fleet_attendance.router, "/fleet-attendance", ["Fleet Attendance"]),
    (finance.router, "/finance", ["Finance"]),
    (factory.router, "/factories", ["Factories"]),
    (shipping.router, "/shipping", ["Shipping"]),
    (plate_counter.router, "/plate-counter", ["Plate Counter"]),
    (admin_tools.router, "/admin-tools", ["Admin Tools"]),
    (bulk_import.router, "/bulk-import", ["Bulk Import"]),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


def create_fleetops_app() -> FastAPI:
    app = FastAPI(title="FleetOps API", version="1.0.0", lifespan=lifespan)
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
        method = request.method.upper()
        path = request.url.path
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
                            resource = parts[0] if parts else "fleetops"
                            db.add(AuditLog(
                                user_id=user.id,
                                username=user.username,
                                action="EXPORT" if is_export else {"POST": "CREATE", "PUT": "UPDATE", "PATCH": "UPDATE", "DELETE": "DELETE"}.get(method, method),
                                resource=resource,
                                resource_id="",
                                detail=f"{method} {path}"[:1000],
                                ip_address=(request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip() or (request.client.host if request.client else ""))[:50],
                            ))
                            db.commit()
                    except (JWTError, Exception):
                        db.rollback()
                    finally:
                        db.close()
        return response

    for router, prefix, tags in FLEETOPS_ROUTERS:
        app.include_router(router, prefix=prefix, tags=tags)

    @app.get("/")
    def health_check():
        return {"message": "FleetOps API is running", "version": "1.0.0", "database": os.path.basename(settings.DB_PATH)}

    @app.get("/integration/mineops")
    def mineops_integration_status(current_user: MineAccount = Depends(get_current_active_user)):
        upstream = os.getenv("MINEOPS_API_URL", "http://127.0.0.1:8008").rstrip("/")
        try:
            with urllib.request.urlopen(f"{upstream}/", timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
                return {"connected": response.status == 200, "upstream": upstream, "upstream_status": payload}
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            return {"connected": False, "upstream": upstream, "error": str(error)}

    return app


app = create_fleetops_app()
