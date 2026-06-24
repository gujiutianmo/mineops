"""设备利用率分析与维护提醒"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text
from datetime import date, timedelta, datetime
from typing import Optional
from database import get_db
from models import Equipment, EquipmentWorkLog, EquipmentMaintenance, Mine
from auth import get_current_active_user
from utils.permissions import filter_by_mine, filter_equipment_visibility

router = APIRouter()


# ==================== P1: 设备利用率趋势+排行榜 ====================

@router.get("/equipment/ranking")
def equipment_ranking(
    mine_id: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """设备利用率排行榜：按工作时长、油耗排名"""
    cutoff = date.today() - timedelta(days=days - 1)

    query = db.query(
        EquipmentWorkLog.equipment_id,
        func.sum(EquipmentWorkLog.work_hours).label("total_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("total_fuel"),
        func.count(EquipmentWorkLog.id).label("work_days"),
        Equipment.name,
        Equipment.code,
        Equipment.category,
        Equipment.brand,
        Equipment.mine_id
    ).join(
        Equipment, EquipmentWorkLog.equipment_id == Equipment.id
    ).filter(
        EquipmentWorkLog.work_date >= cutoff,
        Equipment.status == "active"
    ).group_by(
        EquipmentWorkLog.equipment_id, Equipment.name,
        Equipment.code, Equipment.category, Equipment.brand, Equipment.mine_id
    )

    query = filter_by_mine(query, EquipmentWorkLog, "mine_id", current_user, mine_id)

    results = query.order_by(text("total_hours DESC")).all()

    ranking = []
    for r in results:
        avg_hours = round(float(r.total_hours or 0) / max(float(r.work_days or 1), 1), 2)
        ranking.append({
            "equipment_id": r.equipment_id,
            "equipment_name": r.name,
            "equipment_code": r.code,
            "category": r.category,
            "brand": r.brand,
            "total_hours": round(float(r.total_hours or 0), 2),
            "total_fuel": round(float(r.total_fuel or 0), 2),
            "work_days": r.work_days,
            "avg_daily_hours": avg_hours,
            "utilization_rate": round(avg_hours / 8.0 * 100, 1),  # 以8小时为满勤
            "mine_id": r.mine_id
        })

    return {"period_days": days, "ranking": ranking}


@router.get("/equipment/trend")
def equipment_trend(
    equipment_id: Optional[str] = None,
    mine_id: Optional[str] = None,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """设备利用率趋势（按天/按设备）"""
    cutoff = date.today() - timedelta(days=days - 1)

    base_query = db.query(
        EquipmentWorkLog.work_date,
        func.sum(EquipmentWorkLog.work_hours).label("daily_hours"),
        func.sum(EquipmentWorkLog.fuel_liters).label("daily_fuel"),
        func.count(func.distinct(EquipmentWorkLog.equipment_id)).label("active_devices")
    ).filter(
        EquipmentWorkLog.work_date >= cutoff
    )

    base_query = filter_by_mine(base_query, EquipmentWorkLog, "mine_id", current_user, mine_id)

    if equipment_id:
        base_query = base_query.filter(EquipmentWorkLog.equipment_id == equipment_id)

    results = base_query.group_by(
        EquipmentWorkLog.work_date
    ).order_by(
        EquipmentWorkLog.work_date
    ).all()

    trend = []
    for r in results:
        trend.append({
            "date": str(r.work_date),
            "daily_hours": round(float(r.daily_hours or 0), 2),
            "daily_fuel": round(float(r.daily_fuel or 0), 2),
            "active_devices": r.active_devices or 0,
            "avg_hours_per_device": round(float(r.daily_hours or 0) / max(r.active_devices or 1, 1), 2)
        })

    # 计算移动平均
    for i, item in enumerate(trend):
        window = trend[max(0, i - 2):i + 1]
        item["ma3_hours"] = round(sum(w["daily_hours"] for w in window) / len(window), 2)

    return {"days": days, "trend": trend}


@router.get("/equipment/summary")
def equipment_summary(
    mine_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """设备总览摘要"""
    equip_query = filter_equipment_visibility(
        db.query(Equipment).filter(Equipment.status == "active"),
        Equipment,
        current_user,
        mine_id
    )

    total_equipment = equip_query.count()

    # 按类型统计
    category_stats = db.query(
        Equipment.category,
        func.count(Equipment.id).label("count")
    ).filter(
        Equipment.status == "active"
    )

    category_stats = filter_equipment_visibility(category_stats, Equipment, current_user, mine_id)

    category_stats = category_stats.group_by(Equipment.category).all()

    # 今日工时
    today = date.today()
    today_hours = db.query(
        func.sum(EquipmentWorkLog.work_hours)
    ).filter(
        EquipmentWorkLog.work_date == today
    )

    today_hours = filter_by_mine(today_hours, EquipmentWorkLog, "mine_id", current_user, mine_id)

    today_total = today_hours.scalar() or 0

    return {
        "total_equipment": total_equipment,
        "today_total_hours": round(float(today_total), 2),
        "by_category": [{"category": r.category or "未分类", "count": r.count}
                         for r in category_stats]
    }


# ==================== P2: 设备维护提醒 ====================

@router.get("/maintenance/reminders")
def maintenance_reminders(
    mine_id: Optional[str] = None,
    days_ahead: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """即将到期的维护提醒"""
    today = date.today()
    deadline = today + timedelta(days=days_ahead)

    # 查询所有设备的最新维护记录
    subq = db.query(
        EquipmentMaintenance.equipment_id,
        func.max(EquipmentMaintenance.maintenance_date).label("last_date")
    ).group_by(
        EquipmentMaintenance.equipment_id
    ).subquery()

    # 关联获取完整维护信息
    latest = db.query(
        EquipmentMaintenance,
        Equipment.name,
        Equipment.code,
        Equipment.category,
        Equipment.mine_id
    ).join(
        subq,
        (EquipmentMaintenance.equipment_id == subq.c.equipment_id) &
        (EquipmentMaintenance.maintenance_date == subq.c.last_date)
    ).join(
        Equipment, EquipmentMaintenance.equipment_id == Equipment.id
    ).filter(
        Equipment.status == "active"
    )

    latest = filter_by_mine(latest, EquipmentMaintenance, "mine_id", current_user, mine_id)

    all_records = latest.all()

    reminders = []
    overdue_count = 0
    upcoming_count = 0

    for maint, eq_name, eq_code, eq_cat, eq_mine_id in all_records:
        days_since = (today - maint.maintenance_date).days if maint.maintenance_date else 0
        recommended_next = maint.next_date

        # 如果有明确的下次维护日期
        if recommended_next:
            days_remaining = (recommended_next - today).days
        else:
            # 根据类型估算：保养90天，检查60天，维修30天
            interval_map = {"保养": 90, "检查": 60, "维修": 30, "更换": 180}
            interval = interval_map.get(maint.maintenance_type, 60)
            days_remaining = interval - days_since

        if days_remaining <= 0:
            status = "overdue"
            overdue_count += 1
        elif days_remaining <= days_ahead:
            status = "upcoming"
            upcoming_count += 1
        else:
            continue  # 跳过不在提醒范围的

        reminders.append({
            "equipment_id": maint.equipment_id,
            "equipment_name": eq_name,
            "equipment_code": eq_code,
            "category": eq_cat,
            "maintenance_id": maint.id,
            "last_date": str(maint.maintenance_date),
            "last_type": maint.maintenance_type,
            "last_description": maint.description or "",
            "next_date": str(recommended_next) if recommended_next else None,
            "days_remaining": days_remaining,
            "status": status,
            "mine_id": eq_mine_id
        })

    # 排序：逾期的在前，按天数排序
    reminders.sort(key=lambda x: x["days_remaining"])

    return {
        "days_ahead": days_ahead,
        "total": len(reminders),
        "overdue": overdue_count,
        "upcoming": upcoming_count,
        "reminders": reminders
    }


@router.get("/maintenance/stats")
def maintenance_stats(
    mine_id: Optional[str] = None,
    days: int = Query(180, ge=30, le=730),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """维护统计"""
    cutoff = date.today() - timedelta(days=days - 1)

    query = db.query(EquipmentMaintenance).filter(
        EquipmentMaintenance.maintenance_date >= cutoff
    )

    query = filter_by_mine(query, EquipmentMaintenance, "mine_id", current_user, mine_id)

    # 按类型统计
    type_stats = db.query(
        EquipmentMaintenance.maintenance_type,
        func.count(EquipmentMaintenance.id).label("count"),
        func.sum(EquipmentMaintenance.cost).label("total_cost")
    ).filter(
        EquipmentMaintenance.maintenance_date >= cutoff
    )

    type_stats = filter_by_mine(type_stats, EquipmentMaintenance, "mine_id", current_user, mine_id)

    type_stats = type_stats.group_by(EquipmentMaintenance.maintenance_type).all()

    total_maintenances = query.count()
    total_cost = query.with_entities(func.sum(EquipmentMaintenance.cost)).scalar() or 0

    return {
        "period_days": days,
        "total_maintenances": total_maintenances,
        "total_cost": round(float(total_cost), 2),
        "by_type": [{"type": r.maintenance_type or "未知", "count": r.count,
                      "total_cost": round(float(r.total_cost or 0), 2)}
                     for r in type_stats]
    }
