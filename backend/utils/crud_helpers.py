"""通用 CRUD 辅助函数"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, Query


def get_object_or_404(db: Session, model, object_id):
    """获取对象，不存在则返回 404"""
    obj = db.query(model).filter(model.id == object_id).first()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{model.__name__} not found"
        )
    return obj


def paginate(query: Query, skip: int = 0, limit: int = 100):
    """通用分页"""
    return query.offset(skip).limit(limit).all()
