"""
MineOps - Mine & Equipment Operations Management System
FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers import (
    auth,
    mine,
    equipment,
    employee,
    finance,
    factory,
    plate,
    shipping,
    worklog,
    maintenance,
    audit,
    analytics,
)

ROUTERS = [
    (auth.router, "/auth", ["Auth"]),
    (mine.router, "/mines", ["Mines"]),
    (equipment.router, "/equipment", ["Equipment"]),
    (employee.router, "/employees", ["Employees"]),
    (finance.router, "/finance", ["Finance"]),
    (factory.router, "/factories", ["Factories"]),
    (plate.router, "/plates", ["Plates"]),
    (shipping.router, "/shipping", ["Shipping"]),
    (worklog.router, "/worklogs", ["Work Logs"]),
    (maintenance.router, "/maintenance", ["Maintenance"]),
    (audit.router, "/audit", ["Audit"]),
    (analytics.router, "/analytics", ["Analytics"]),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
