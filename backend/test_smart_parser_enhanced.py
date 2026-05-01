"""测试增强版 SmartParser - 验证多格式支持"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 样本设备数据
sample_devices = [
    {"id": "EQ001", "code": "SY700-01", "name": "三一700钩机1号", "brand": "三一", "category": "挖掘机", "short_num": "1", "vehicle_num": "RX01", "aliases": "1号钩机,700钩机"},
    {"id": "EQ002", "code": "SY700-02", "name": "三一700钩机2号", "brand": "三一", "category": "挖掘机", "short_num": "2", "vehicle_num": "RX02", "aliases": "2号钩机"},
    {"id": "EQ003", "code": "XG800-01", "name": "徐工800破碎锤1号", "brand": "徐工", "category": "破碎锤", "short_num": "1", "vehicle_num": "PL01", "aliases": "1号炮机,800锤"},
    {"id": "EQ004", "code": "LG106-01", "name": "临工106矿卡1号", "brand": "临工", "category": "矿卡", "short_num": "1", "vehicle_num": "KC01", "aliases": "1号矿卡"},
    {"id": "EQ005", "code": "LG106-02", "name": "临工106矿卡2号", "brand": "临工", "category": "矿卡", "short_num": "2", "vehicle_num": "KC02", "aliases": "2号矿卡"},
    {"id": "EQ006", "code": "XG-YLJ-01", "name": "徐工压路机", "brand": "徐工", "category": "压路机", "short_num": "", "vehicle_num": "YLJ01", "aliases": "压路机"},
    {"id": "EQ007", "code": "DC-01", "name": "短车1号", "brand": "短车", "category": "短车", "short_num": "1", "vehicle_num": "DC01", "aliases": "1号短车"},
    {"id": "EQ008", "code": "DC-02", "name": "短车2号", "brand": "短车", "category": "短车", "short_num": "2", "vehicle_num": "DC02", "aliases": "2号短车"},
]

from services.smart_parser import SmartParser

parser = SmartParser(sample_devices)

print("=" * 60)
print("测试1: kuangshang_system 旧格式（日期头 + 分类头）")
print("=" * 60)
text1 = """2024.1.3
【挖掘机】
1号三一700钩机【7:00-12:00 13:00-17:00】（加油280L）
2号三一700钩机【7:05-12:00 13:00-17:10】（加油250L）
【破碎锤】
徐工800破碎锤1号【7:30-12:00 13:00-17:00】破碎石头
【压路机】
压路机【7:45-12:00 13:00-16:30】
"""
results1 = parser.parse(text1, "MINE01", "test_user")
for r in results1:
    print(f"  设备: {r['equipment_name']} | 时长: {r['duration']}h | 加油: {r.get('fuel',0)}L | 备注: {r['memo']} | 匹配: {r.get('confidence','?')} | {r['raw_text']}")

print("\n" + "=" * 60)
print("测试2: 新格式 - 无日期头，使用 vehicle_num")
print("=" * 60)
text2 = """RX01【7:00-12:00】
RX02【8:00-12:00 14:00-18:00】（加油300L）
KC01【7:30-12:00】
PL01【8:00-11:30】破碎
"""
results2 = parser.parse(text2, "MINE01", "test_user")
for r in results2:
    print(f"  设备: {r['equipment_name']} | 时长: {r['duration']}h | 加油: {r.get('fuel',0)}L | 备注: {r['memo']} | 匹配: {r.get('confidence','?')} | {r['raw_text']}")

print("\n" + "=" * 60)
print("测试3: 新格式 - 短号+品牌+类型")
print("=" * 60)
text3 = """1号钩机【7:00-12:00 13:00-18:00】
2号三一钩机【7:30-12:00 13:30-17:10】（加油200L）
1号炮机【8:00-12:00】
1号矿卡【7:30-12:00 14:00-18:30】临工
2号短车【8:00-12:00】
1号短车【7:30-12:00 13:00-17:30】
"""
results3 = parser.parse(text3, "MINE02", "test_user")
for r in results3:
    print(f"  设备: {r['equipment_name']} | 时长: {r['duration']}h | 加油: {r.get('fuel',0)}L | 备注: {r['memo']} | 匹配: {r.get('confidence','?')} | {r['raw_text']}")

print("\n" + "=" * 60)
print("测试4: 新格式 - 品牌+型号+类型")
print("=" * 60)
text4 = """三一700钩机【7:00-12:00】
徐工破碎锤【7:30-12:00】
临工106矿卡【8:00-12:00 14:00-18:00】（加油500L）
压路机【7:45-12:00】
"""
results4 = parser.parse(text4, "MINE03", "test_user")
for r in results4:
    print(f"  设备: {r['equipment_name']} | 时长: {r['duration']}h | 加油: {r.get('fuel',0)}L | 备注: {r['memo']} | 匹配: {r.get('confidence','?')} | {r['raw_text']}")

print("\n" + "=" * 60)
print("汇总:")
print(f"  测试1 (旧格式): {len(results1)} 条记录")
print(f"  测试2 (vehicle_num): {len(results2)} 条记录")
print(f"  测试3 (短号+品牌+类型): {len(results3)} 条记录")
print(f"  测试4 (品牌+型号+类型): {len(results4)} 条记录")
print(f"  总计: {len(results1)+len(results2)+len(results3)+len(results4)} 条")
