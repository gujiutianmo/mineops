import os

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import FleetOrganization


def resolve_single_fleet_id(db: Session, fleet_id: str | None) -> str | None:
    """Bind FleetOps requests to its only fleet without changing MineOps behavior."""
    if fleet_id or os.getenv("FLEETOPS_SINGLE_FLEET") != "1":
        return fleet_id
    fleets = db.query(FleetOrganization.id).filter(FleetOrganization.active == 1).limit(2).all()
    if len(fleets) == 0:
        return None
    if len(fleets) != 1:
        raise HTTPException(status_code=500, detail="FleetOps requires exactly one active fleet scope")
    return fleets[0][0]

