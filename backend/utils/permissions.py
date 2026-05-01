"""统一的权限检查工具"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from models import MineAccount


def check_mine_access(current_user: MineAccount, mine_id: str, raise_exception: bool = True):
    """检查用户是否有权限访问指定矿山的数据。
    mine_id 为 None 表示全局共享资源（如设备），所有用户均可访问。
    设置 raise_exception=False 可静默返回 True/False 而不抛出异常。
    """
    if current_user.role != "super" and mine_id is not None and mine_id != current_user.mine_id:
        if raise_exception:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied"
            )
        return False
    return True


def filter_by_mine(query, model, mine_field: str, current_user: MineAccount, mine_id: str = None, allow_global: bool = False):
    """根据用户角色和指定的 mine_id 过滤查询。
    
    allow_global: 如果为 True，普通矿山用户也能看到 mine_id=NULL 的全局资源（如设备）。
    """
    if current_user.role != "super":
        if allow_global:
            # 普通矿山用户: 自己的数据 + 全局共享数据
            col = getattr(model, mine_field)
            return query.filter(
                (col == current_user.mine_id) | (col == None)
            )
        else:
            return query.filter(getattr(model, mine_field) == current_user.mine_id)
    elif mine_id:
        return query.filter(getattr(model, mine_field) == mine_id)
    return query


def get_target_mine_id(current_user: MineAccount, mine_id: str = None):
    """获取有效的目标矿山ID，用于创建操作。
    普通用户自动使用自己的 mine_id；super admin 使用传入的 mine_id 或 None（全局操作）。
    """
    if current_user.role != "super":
        return current_user.mine_id
    return mine_id if mine_id else None


def require_super_admin(current_user: MineAccount):
    """要求当前用户是超级管理员"""
    if current_user.role != "super":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin required"
        )
