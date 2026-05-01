"""操作审计日志"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from database import get_db
from models import AuditLog
from auth import get_current_active_user
from utils.permissions import require_super_admin

router = APIRouter()


def log_action(db: Session, user_id: str, username: str, action: str, resource: str,
               resource_id: str = "", detail: str = "", ip_address: str = ""):
    """记录审计日志（供其他模块调用）"""
    try:
        db.add(AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource=resource,
            resource_id=resource_id,
            detail=detail[:1000],
            ip_address=ip_address[:50]
        ))
    except Exception:
        pass  # 审计日志不应阻塞业务


@router.get("/")
def read_audit_logs(
    skip: int = 0,
    limit: int = 200,
    username: Optional[str] = None,
    resource: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """查询审计日志 - 仅超级管理员可访问"""
    require_super_admin(current_user)
    query = db.query(AuditLog)
    if username:
        query = query.filter(AuditLog.username.contains(username))
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()


@router.get("/stats")
def audit_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """审计日志统计"""
    require_super_admin(current_user)
    from sqlalchemy import func
    total = db.query(func.count(AuditLog.id)).scalar()
    by_resource = db.query(
        AuditLog.resource, func.count(AuditLog.id)
    ).group_by(AuditLog.resource).all()
    by_action = db.query(
        AuditLog.action, func.count(AuditLog.id)
    ).group_by(AuditLog.action).all()
    return {
        "total_logs": total,
        "by_resource": [{"resource": r, "count": c} for r, c in by_resource],
        "by_action": [{"action": r, "count": c} for r, c in by_action]
    }
