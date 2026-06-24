"""Fleet attendance schemas"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FleetAttendanceCheckIn(BaseModel):
    staff_name: str
    staff_role: str = "司机"
    remark: str = ""
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None


class FleetAttendanceManual(BaseModel):
    staff_name: str
    staff_role: str = "司机"
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    remark: str = ""
    mine_id: Optional[str] = None
    fleet_id: Optional[str] = None


class FleetAttendanceOut(BaseModel):
    id: str
    mine_id: str
    fleet_id: Optional[str] = None
    staff_name: str
    staff_role: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    duration_hours: float = 0
    status: str
    remark: str
    created_at: Optional[datetime] = None
