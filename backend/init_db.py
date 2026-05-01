"""
初始化数据库脚本 - 创建表结构并插入默认数据
用法: cd backend && python init_db.py
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from models import Base, Mine, MineAccount, Equipment, EquipmentMaintenance, Plate, Employee, Factory, AuthorizedPlate
from database import engine, SessionLocal
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db_path = settings.DB_PATH
print(f"Database path: {db_path}")

# Delete old DB if exists
if os.path.exists(db_path):
    os.remove(db_path)
    print("Deleted old database")

# Create all tables
Base.metadata.create_all(bind=engine)
print("Created tables")

db = SessionLocal()

# === Mines ===
mines = [
    {"id": "mine_a", "name": "矿山A · 卢本巴希矿区"},
    {"id": "mine_b", "name": "矿山B · 科卢韦齐矿区"},
]
for m in mines:
    db.add(Mine(id=m["id"], name=m["name"]))
db.commit()
print(f"Inserted {len(mines)} mines")

# === Users ===
users = [
    {"username": "admin", "password": "admin", "display_name": "总管理员", "role": "super", "mine_id": None},
    {"username": "mine_a", "password": "mine123", "display_name": "矿山A管理员", "role": "mine", "mine_id": "mine_a"},
    {"username": "mine_b", "password": "mine123", "display_name": "矿山B管理员", "role": "mine", "mine_id": "mine_b"},
]
for u in users:
    user = MineAccount(
        id=str(uuid.uuid4()),
        username=u["username"],
        password_hash=pwd_context.hash(u["password"]),
        display_name=u["display_name"],
        role=u["role"],
        mine_id=u["mine_id"],
        active=1,
    )
    db.add(user)
db.commit()
print(f"Inserted {len(users)} users")

# === Equipment (with new fields: vehicle_num, aliases, category, short_num) ===
equipment = [
    # ==================== 三一挖掘机 ====================
    {"id": "SY-500-2-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-2-wjj", "name": "三一500-2号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "2", "aliases": "三一,2号"},
    {"id": "SY-500-16-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-16-wjj", "name": "三一500-16号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "16", "aliases": "三一,16号"},
    {"id": "SY-500-18-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-18-wjj", "name": "三一500-18号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "18", "aliases": "三一,18号"},
    {"id": "SY-500-20-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-20-wjj", "name": "三一500-20号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "20", "aliases": "三一,20号"},
    {"id": "SY-500-22-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-22-wjj", "name": "三一500-22号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "22", "aliases": "三一,22号"},
    {"id": "SY-500-4-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-4-wjj", "name": "三一500-4号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "4", "aliases": "三一,4号"},
    {"id": "SY-500-L4-wjj", "mine_id": None, "vehicle_num": "", "code": "SY-500-L4-wjj", "name": "三一500-L4号挖掘机", "brand": "三一", "type": "挖掘机", "category": "挖掘机", "short_num": "L4", "aliases": "三一,4号"},
    # ==================== 三一破碎锤 ====================
    {"id": "SY-500-3-psc", "mine_id": None, "vehicle_num": "", "code": "SY-500-3-psc", "name": "三一500-3号破碎锤", "brand": "三一", "type": "破碎锤", "category": "破碎锤", "short_num": "3", "aliases": "三一,3号,炮机"},
    {"id": "SY-500-6-psc", "mine_id": None, "vehicle_num": "", "code": "SY-500-6-psc", "name": "三一500-6号破碎锤", "brand": "三一", "type": "破碎锤", "category": "破碎锤", "short_num": "6", "aliases": "三一,6号"},
    {"id": "SY-500-19-psc", "mine_id": None, "vehicle_num": "", "code": "SY-500-19-psc", "name": "三一500-19号破碎锤", "brand": "三一", "type": "破碎锤", "category": "破碎锤", "short_num": "19", "aliases": "三一,19号,炮机"},
    # ==================== 徐工破碎锤 ====================
    {"id": "XG-500-1-psc", "mine_id": None, "vehicle_num": "", "code": "XG-500-1-psc", "name": "徐工500-1号破碎锤", "brand": "徐工", "type": "破碎锤", "category": "破碎锤", "short_num": "1", "aliases": "徐工,1号,炮机"},
    {"id": "XG-550-1-psc", "mine_id": None, "vehicle_num": "", "code": "XG-550-1-psc", "name": "徐工550-1号破碎锤", "brand": "徐工", "type": "破碎锤", "category": "破碎锤", "short_num": "1", "aliases": "徐工550,1号"},
    # ==================== 徐工挖掘机 ====================
    {"id": "XG-500-5-wjj", "mine_id": None, "vehicle_num": "", "code": "XG-500-5-wjj", "name": "徐工500-5号挖掘机", "brand": "徐工", "type": "挖掘机", "category": "挖掘机", "short_num": "5", "aliases": "徐工,5号"},
    {"id": "XG-800-3-wjj", "mine_id": None, "vehicle_num": "", "code": "XG-800-3-wjj", "name": "徐工800-3号挖掘机", "brand": "徐工", "type": "挖掘机", "category": "挖掘机", "short_num": "3", "aliases": "徐工,800,3号"},
    # ==================== 柳工挖掘机 ====================
    {"id": "LG-360-6-wjj", "mine_id": None, "vehicle_num": "", "code": "LG-360-6-wjj", "name": "柳工360-6号挖掘机", "brand": "柳工", "type": "挖掘机", "category": "挖掘机", "short_num": "6", "aliases": "柳工,6号"},
    # ==================== 临工挖掘机 ====================
    {"id": "LG-106-1-wjj", "mine_id": None, "vehicle_num": "", "code": "LG-106-1-wjj", "name": "临工106-1号挖掘机", "brand": "临工", "type": "挖掘机", "category": "挖掘机", "short_num": "1", "aliases": "临工,106,1号,钩机"},
    {"id": "LG-106-2-wjj", "mine_id": None, "vehicle_num": "", "code": "LG-106-2-wjj", "name": "临工106-2号挖掘机", "brand": "临工", "type": "挖掘机", "category": "挖掘机", "short_num": "2", "aliases": "临工,106,2号,钩机"},
    # ==================== 铲车 ====================
    {"id": "XG-CC-3", "mine_id": None, "vehicle_num": "", "code": "XG-CC-3", "name": "徐工3号铲车", "brand": "徐工", "type": "铲车", "category": "铲车", "short_num": "3", "aliases": "徐工,3号"},
    {"id": "LG-CC-1", "mine_id": None, "vehicle_num": "", "code": "LG-CC-1", "name": "柳工1号铲车", "brand": "柳工", "type": "铲车", "category": "铲车", "short_num": "1", "aliases": "柳工,1号"},
    {"id": "LG-CC-3", "mine_id": None, "vehicle_num": "", "code": "LG-CC-3", "name": "柳工3号铲车", "brand": "柳工", "type": "铲车", "category": "铲车", "short_num": "3", "aliases": "柳工,3号"},
    {"id": "LG-CC-23", "mine_id": None, "vehicle_num": "", "code": "LG-CC-23", "name": "柳工23号铲车", "brand": "柳工", "type": "铲车", "category": "铲车", "short_num": "23", "aliases": "柳工,23号"},
    {"id": "LG-CC-26", "mine_id": None, "vehicle_num": "", "code": "LG-CC-26", "name": "柳工26号铲车", "brand": "柳工", "type": "铲车", "category": "铲车", "short_num": "26", "aliases": "柳工,26号"},
    {"id": "LG-CC-28", "mine_id": None, "vehicle_num": "", "code": "LG-CC-28", "name": "柳工28号铲车", "brand": "柳工", "type": "铲车", "category": "铲车", "short_num": "28", "aliases": "柳工,28号"},
    # ==================== 矿卡 - 临工 ====================
    {"id": "LG-106-1-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-1-kc", "name": "临工106-1号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "1", "aliases": "临工,106,1号,矿卡"},
    {"id": "LG-106-2-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-2-kc", "name": "临工106-2号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "2", "aliases": "临工,106,2号,矿卡"},
    {"id": "LG-106-3-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-3-kc", "name": "临工106-3号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "3", "aliases": "临工,106,3号,矿卡"},
    {"id": "LG-106-5-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-5-kc", "name": "临工106-5号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "5", "aliases": "临工,106,5号,矿卡"},
    {"id": "LG-106-6-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-6-kc", "name": "临工106-6号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "6", "aliases": "临工,106,6号,矿卡"},
    {"id": "LG-106-7-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-7-kc", "name": "临工106-7号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "7", "aliases": "临工,106,7号,矿卡"},
    {"id": "LG-106-8-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-8-kc", "name": "临工106-8号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "8", "aliases": "临工,106,8号,矿卡"},
    {"id": "LG-106-9-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-9-kc", "name": "临工106-9号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "9", "aliases": "临工,106,9号,矿卡"},
    {"id": "LG-106-10-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-10-kc", "name": "临工106-10号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "10", "aliases": "临工,106,10号,矿卡"},
    {"id": "LG-106-11-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-11-kc", "name": "临工106-11号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "11", "aliases": "临工,106,11号,矿卡"},
    {"id": "LG-106-12-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-12-kc", "name": "临工106-12号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "12", "aliases": "临工,106,12号,矿卡"},
    {"id": "LG-106-13-kc", "mine_id": None, "vehicle_num": "", "code": "LG-106-13-kc", "name": "临工106-13号矿卡", "brand": "临工", "type": "矿卡", "category": "矿卡", "short_num": "13", "aliases": "临工,106,13号,矿卡"},
    # ==================== 矿卡 - 徐工 ====================
    {"id": "XG-90-1", "mine_id": None, "vehicle_num": "", "code": "XG-90-1", "name": "徐工90-1号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "1", "aliases": "徐工,90,1号,矿卡"},
    {"id": "XG-90-3", "mine_id": None, "vehicle_num": "", "code": "XG-90-3", "name": "徐工90-3号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "3", "aliases": "徐工,90,3号,矿卡"},
    {"id": "XG-90-8", "mine_id": None, "vehicle_num": "", "code": "XG-90-8", "name": "徐工90-8号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "8", "aliases": "徐工,90,8号,矿卡"},
    {"id": "XG-90-9", "mine_id": None, "vehicle_num": "", "code": "XG-90-9", "name": "徐工90-9号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "9", "aliases": "徐工,90,9号,矿卡"},
    {"id": "XG-90-15", "mine_id": None, "vehicle_num": "", "code": "XG-90-15", "name": "徐工90-15号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "15", "aliases": "徐工,90,15号,矿卡"},
    {"id": "XG-90-17", "mine_id": None, "vehicle_num": "", "code": "XG-90-17", "name": "徐工90-17号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "17", "aliases": "徐工,90,17号,矿卡"},
    {"id": "XG-90-19", "mine_id": None, "vehicle_num": "", "code": "XG-90-19", "name": "徐工90-19号矿卡", "brand": "徐工", "type": "矿卡", "category": "矿卡", "short_num": "19", "aliases": "徐工,90,19号,矿卡"},
    # ==================== 短车 ====================
    {"id": "DC-05", "mine_id": None, "vehicle_num": "", "code": "DC-05", "name": "5号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "5", "aliases": "5号"},
    {"id": "DC-06", "mine_id": None, "vehicle_num": "", "code": "DC-06", "name": "6号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "6", "aliases": "6号"},
    {"id": "DC-07", "mine_id": None, "vehicle_num": "", "code": "DC-07", "name": "7号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "7", "aliases": "7号"},
    {"id": "DC-08", "mine_id": None, "vehicle_num": "", "code": "DC-08", "name": "8号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "8", "aliases": "8号"},
    {"id": "DC-11", "mine_id": None, "vehicle_num": "", "code": "DC-11", "name": "11号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "11", "aliases": "11号"},
    {"id": "DC-13", "mine_id": None, "vehicle_num": "", "code": "DC-13", "name": "13号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "13", "aliases": "13号"},
    {"id": "DC-16", "mine_id": None, "vehicle_num": "", "code": "DC-16", "name": "16号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "16", "aliases": "16号"},
    {"id": "DC-17", "mine_id": None, "vehicle_num": "", "code": "DC-17", "name": "17号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "17", "aliases": "17号"},
    {"id": "DC-18", "mine_id": None, "vehicle_num": "", "code": "DC-18", "name": "18号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "18", "aliases": "18号"},
    {"id": "DC-19", "mine_id": None, "vehicle_num": "", "code": "DC-19", "name": "19号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "19", "aliases": "19号"},
    {"id": "DC-20", "mine_id": None, "vehicle_num": "", "code": "DC-20", "name": "20号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "20", "aliases": "20号"},
    {"id": "DC-29", "mine_id": None, "vehicle_num": "", "code": "DC-29", "name": "29号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "29", "aliases": "29号"},
    {"id": "DC-30", "mine_id": None, "vehicle_num": "", "code": "DC-30", "name": "30号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "30", "aliases": "30号"},
    {"id": "DC-39", "mine_id": None, "vehicle_num": "", "code": "DC-39", "name": "39号短车", "brand": "短车", "type": "短车", "category": "短车", "short_num": "39", "aliases": "39号"},
    # ==================== 压路机 ====================
    {"id": "XG-YLJ", "mine_id": None, "vehicle_num": "", "code": "XG-YLJ", "name": "压路机", "brand": "徐工", "type": "压路机", "category": "压路机", "short_num": "", "aliases": "压路机"},
]
for eq in equipment:
    db.add(Equipment(
        id=eq["id"],
        mine_id=eq["mine_id"],
        vehicle_num=eq["vehicle_num"],
        code=eq["code"],
        name=eq["name"],
        brand=eq["brand"],
        type=eq["type"],
        category=eq["category"],
        short_num=eq["short_num"],
        aliases=eq["aliases"],
        status="active",
    ))
db.commit()
print(f"Inserted {len(equipment)} equipment records")

# === Factories ===
factories = [
    {"id": "fac_a1", "mine_id": "mine_a", "name": "1号采矿点"},
    {"id": "fac_a2", "mine_id": "mine_a", "name": "2号堆浸场"},
    {"id": "fac_b1", "mine_id": "mine_b", "name": "3号选矿厂"},
    {"id": "fac_b2", "mine_id": "mine_b", "name": "4号采矿点"},
]
for f in factories:
    db.add(Factory(id=f["id"], mine_id=f["mine_id"], name=f["name"]))
db.commit()
print(f"Inserted {len(factories)} factories")

# === Plates ===
plates = [
    {"id": "ap_a1", "mine_id": "mine_a", "plate_number": "CD-12345-AB"},
    {"id": "ap_a2", "mine_id": "mine_a", "plate_number": "CD-67890-CD"},
    {"id": "ap_a3", "mine_id": "mine_a", "plate_number": "CD-11111-EF"},
    {"id": "ap_b1", "mine_id": "mine_b", "plate_number": "CD-22222-GH"},
    {"id": "ap_b2", "mine_id": "mine_b", "plate_number": "CD-33333-IJ"},
]
for p in plates:
    db.add(AuthorizedPlate(id=p["id"], mine_id=p["mine_id"], plate_number=p["plate_number"]))
db.commit()
print(f"Inserted {len(plates)} plates")

# === Employees ===
employees = [
    {"id": "emp_a1", "mine_id": "mine_a", "name_fr": "Jean Mukendi", "name_cn": "让·穆肯迪", "job": "挖掘机司机", "salary": 450.00, "currency": "USD"},
    {"id": "emp_a2", "mine_id": "mine_a", "name_fr": "Pierre Kabongo", "name_cn": "皮埃尔·卡本戈", "job": "卡车司机", "salary": 380.00, "currency": "USD"},
    {"id": "emp_a3", "mine_id": "mine_a", "name_fr": "Joseph Mwamba", "name_cn": "约瑟夫·姆万巴", "job": "普工", "salary": 180000.00, "currency": "CDF"},
    {"id": "emp_a4", "mine_id": "mine_a", "name_fr": "Antoine Tshimanga", "name_cn": "安托万·奇曼加", "job": "修理工", "salary": 500.00, "currency": "USD"},
    {"id": "emp_b1", "mine_id": "mine_b", "name_fr": "Marcel Nsungu", "name_cn": "马塞尔·恩松古", "job": "挖掘机司机", "salary": 420.00, "currency": "USD"},
    {"id": "emp_b2", "mine_id": "mine_b", "name_fr": "François Kalala", "name_cn": "弗朗索瓦·卡拉拉", "job": "装载机司机", "salary": 400.00, "currency": "USD"},
    {"id": "emp_b3", "mine_id": "mine_b", "name_fr": "Patrick Lubala", "name_cn": "帕特里克·卢巴拉", "job": "普工", "salary": 160000.00, "currency": "CDF"},
]
for e in employees:
    db.add(Employee(
        id=e["id"], mine_id=e["mine_id"], name_fr=e["name_fr"],
        name_cn=e["name_cn"], job=e["job"], salary=e["salary"],
        currency=e["currency"], staff_type=e.get("staff_type", "刚方"), deleted=0,
    ))
db.commit()
print(f"Inserted {len(employees)} employees")

db.close()
print("Done! Database initialized successfully.")
