"""
智能文本解析器 - 支持多种录入格式：
1. kuangshang_system 格式: 日期行 + 分类头 + 条目行
2. 简单行格式: vehicle_num + 时间段 + 加油
3. 单行/多行直接解析（无日期头）
"""
import re
from datetime import datetime, date
from collections import defaultdict
from .fleet_matcher import FleetMatcher
from utils.worklog_time import parse_time_ranges


class SmartParser:
    """智能解析器 - 解析录入文本为结构化工作日志"""

    def __init__(self, dev_list):
        self.dev_list = dev_list
        self.devices = dev_list
        self.errors = []
        self.matcher = FleetMatcher(dev_list)  # 复用统一匹配器
        self._build_lookup_tables()

    def _build_lookup_tables(self):
        """构建兼容 kuangshang_system 旧格式的快速索引"""
        self.triple_index = {}
        for d in self.devices:
            key = (str(d.get('short_num', '')), d.get('brand', ''), d.get('category', ''))
            self.triple_index[key] = d
            if d.get('short_num', '').isdigit():
                key2 = (str(int(d['short_num'])), d.get('brand', ''), d.get('category', ''))
                self.triple_index[key2] = d

        self.vehicle_num_index = {}
        for d in self.devices:
            vn = d.get('vehicle_num', '').strip().upper()
            if vn:
                self.vehicle_num_index[vn] = d

        self.alias_map = {}
        for d in self.devices:
            aliases = d.get('aliases', '').split(',') if d.get('aliases') else []
            for alias in aliases:
                alias = alias.strip()
                if alias:
                    self.alias_map[alias] = d

        self.category_keywords = {
            '挖掘机': ['钩机', '勾机', '挖机', '挖掘机', 'wjj'],
            '破碎锤': ['炮机', '破碎', '炮', '锤', 'psc'],
            '铲车': ['铲车', '装载机', 'cc'],
            '矿卡': ['矿卡', '矿车', '卡车'],
            '短车': ['短车', 'dc'],
            '压路机': ['压路机', '压路', 'ylj'],
            '鹰嘴勾': ['鹰嘴勾', '鹰嘴', 'yzg']
        }

        self.brand_keywords = {
            '三一': ['三一', 'sany', 'sy'],
            '徐工': ['徐工', 'xcmg', 'xg'],
            '临工': ['临工', 'lingong', 'lg', '林工'],
            '柳工': ['柳工', 'liugong'],
            '短车': ['短车'],
            '卡特': ['卡特', 'cat', 'caterpillar'],
            '中国重汽': ['豪沃', '重汽', 'howo'],
            '陕汽': ['陕汽', 'shaanxi'],
        }

        self.model_features = {}
        for d in self.devices:
            nums = re.findall(r'(\d+)', d.get('code', ''))
            for num in nums:
                if len(num) >= 2:
                    key = (d.get('brand', ''), d.get('category', ''), num)
                    if key not in self.model_features:
                        self.model_features[key] = []
                    self.model_features[key].append(d)

        self.short_num_index = defaultdict(list)
        for d in self.devices:
            short = str(d.get('short_num', ''))
            if short:
                self.short_num_index[short].append(d)

        self.category_groups = defaultdict(list)
        for d in self.devices:
            self.category_groups[d.get('category', '')].append(d)

        self.brand_groups = defaultdict(list)
        for d in self.devices:
            self.brand_groups[d.get('brand', '')].append(d)

    def parse(self, text, default_mine_id="", creator=""):
        """主解析入口 - 返回 dict 列表

        支持的多格式：
        1. 无日期行时：每行单独解析，日期为当天
        2. 有日期行时：第一行为日期头，后续为数据行
        3. 分类头行：【挖掘机】等
        """
        lines = text.strip().split('\n')
        results = []
        current_date = date.today().strftime("%Y-%m-%d")
        current_shift = ""
        current_category = ""
        current_header_errors = []
        has_date_header = any(self._looks_like_date_line(line) for line in lines)
        has_time_blocks = any(re.search(r'【[^】]*】', line) for line in lines)
        strict_document = has_date_header and has_time_blocks
        seen_date_header = False

        context = {'last_brand': None, 'last_category': None}

        for line_number, line in enumerate(lines, start=1):
            line = line.strip()
            if not line:
                continue
            if self._looks_like_date_line(line):
                seen_date_header = True
                current_header_errors = []
                try:
                    current_date = self._extract_date(line)
                except ValueError as exc:
                    current_header_errors.append(str(exc))
                    self.errors.append({"line_number": line_number, "line": line, "error": str(exc), "severity": "error"})
                current_shift = self._extract_shift(line)
                if strict_document and not current_shift:
                    error = "日期行必须注明白班或晚班"
                    current_header_errors.append(error)
                    self.errors.append({"line_number": line_number, "line": line, "error": error, "severity": "error"})
                current_category = ""
                context = {'last_brand': None, 'last_category': None}
                continue
            if self._is_category_header(line):
                current_category = self._detect_category_from_header(line)
                context['last_category'] = current_category
                continue

            record = self._parse_line(
                line,
                current_date,
                current_category,
                context,
                strict=strict_document,
                shift=current_shift,
                line_number=line_number,
            )
            if record:
                record_errors = list(current_header_errors) + list(record.get('validation_errors') or [])
                if strict_document and not seen_date_header:
                    record_errors.append("设备行之前缺少日期标题")
                record['validation_errors'] = list(dict.fromkeys(record_errors))
                record['is_valid'] = bool(record.get('equipment_id')) and not record['validation_errors']
                record['mine_id'] = default_mine_id
                record['created_by'] = creator
                results.append(record)
                if record.get('equipment_id'):
                    context['last_brand'] = record.get('brand', '')

        return results

    def _is_category_header(self, line):
        return bool(re.fullmatch(r'【[^】]+】', line.strip()))

    def _looks_like_date_line(self, line):
        """检查该行是否像日期头"""
        patterns = [
            r'\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}',
            r'\d{4}\d{2}\d{2}',
            r'\d{4}年\d{1,2}月\d{1,2}日',
        ]
        for p in patterns:
            if re.search(p, line):
                return True
        return False

    def _extract_date(self, line):
        date_line = line.strip() if line else ""
        patterns = [
            r'(\d{4})年(\d{1,2})月(\d{1,2})日',
            r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})',
            r'(\d{4})(\d{2})(\d{2})',
        ]
        for pattern in patterns:
            m = re.search(pattern, date_line)
            if m:
                y, mth, d = m.groups()
                try:
                    return date(int(y), int(mth), int(d)).isoformat()
                except ValueError:
                    raise ValueError(f"日期无效：{y}.{mth}.{d}")
        raise ValueError("无法识别日期")

    def _extract_shift(self, line):
        if re.search(r'晚班|夜班|晚上|夜晚|夜间', line):
            return "晚班"
        if re.search(r'白班|白天|日班|白昼', line):
            return "白班"
        return ""

    def _detect_category_from_header(self, header):
        content = header.strip('【】')
        for cat, keywords in self.category_keywords.items():
            if any(kw in content for kw in keywords):
                return cat
        return ""

    def _parse_line(self, line, work_date, default_category, context, strict=False, shift="", line_number=0):
        line = line.strip()
        if not line:
            return None

        # 1. 先从原始行提取加油量（避免被备注提取吞掉）
        line_after_fuel, fuel = self._extract_fuel(line)

        # 2. 在去油后文本上提取时间和备注信息
        time_detail, memo, clean_line = self._extract_time_and_memo(line_after_fuel)

        validation_errors = []
        time_segments = []
        if strict:
            parsed_time = parse_time_ranges(time_detail, allow_day_rollover=shift == "晚班")
            time_detail = parsed_time["canonical"]
            duration = parsed_time["hours"]
            time_segments = parsed_time["segments"]
            validation_errors.extend(parsed_time["errors"])
            device, strict_error = self._match_device_strict(clean_line, default_category)
            if strict_error:
                validation_errors.append(strict_error)
            return {
                'date': work_date,
                'equipment_id': device.get('id', '') if device else '',
                'equipment_name': device.get('name', '') if device else clean_line,
                'duration': duration,
                'time_detail': time_detail,
                'time_segments': time_segments,
                'fuel': fuel,
                'memo': memo,
                'shift': shift,
                'raw_text': line,
                'line_number': line_number,
                'confidence': 100 if device else 0,
                'method': '严格唯一匹配' if device else '未匹配',
                'brand': device.get('brand', '') if device else '',
                'category': device.get('category', '') if device else default_category,
                'strict': True,
                'validation_errors': validation_errors,
            }

        # 计算工作时长 - 仅从时间块提取（memo可能包含加油等数字信息，不能回退）
        duration = self._calc_duration(time_detail)

        # === 核心改动：使用统一匹配器（支持 vehicle_num 等新字段） ===
        device_id, device_name, score = self.matcher.find_best_match(clean_line, default_category)

        if device_id:
            device = self._get_device_by_id(device_id)
            brand = device.get('brand', '') if device else ''
            category = device.get('category', '') if device else ''

            return {
                'date': work_date,
                'equipment_id': device_id,
                'equipment_name': device_name,
                'duration': duration,
                'time_detail': time_detail,
                'fuel': fuel,
                'memo': memo,
                'raw_text': line,
                'confidence': score,
                'method': '智能匹配',
                'brand': brand,
                'category': category,
                'shift': shift,
                'line_number': line_number,
                'strict': False,
                'validation_errors': validation_errors,
            }

        # 兜底：尝试旧格式兼容
        device, confidence, method = self._identify_device(clean_line, default_category, context)
        if not device:
            device, confidence, method = self._fuzzy_match(clean_line, default_category, context)

        if device:
            return {
                'date': work_date,
                'equipment_id': device['id'],
                'equipment_name': device.get('name', ''),
                'duration': duration,
                'time_detail': time_detail,
                'fuel': fuel,
                'memo': memo,
                'raw_text': line,
                'confidence': confidence,
                'method': method,
                'brand': device.get('brand', ''),
                'category': device.get('category', ''),
                'shift': shift,
                'line_number': line_number,
                'strict': False,
                'validation_errors': validation_errors,
            }
        return None

    def _match_device_strict(self, line, default_category):
        identity = self._normalize_identity(line)
        exact_candidates = []
        for device in self.devices:
            values = [device.get('code', ''), device.get('name', '')]
            values.extend(re.split(r'[,，;；]', device.get('aliases', '') or ''))
            if identity and any(identity == self._normalize_identity(value) for value in values if value):
                exact_candidates.append(device)
        exact_candidates = self._unique_devices(exact_candidates)
        if len(exact_candidates) == 1:
            return exact_candidates[0], ""
        if len(exact_candidates) > 1:
            return None, self._ambiguous_device_error(exact_candidates)

        category = self._detect_category_from_text(line) or default_category
        brand = self._detect_brand_from_text(line)
        short_match = re.search(r'([A-Za-z]?\d+)\s*号', line, re.IGNORECASE)
        short_num = self._normalize_short_num(short_match.group(1)) if short_match else ""
        remaining = line
        if short_match:
            remaining = remaining[:short_match.start()] + remaining[short_match.end():]
        model_numbers = re.findall(r'\d{2,4}', remaining)

        candidates = list(self.devices)
        if category:
            candidates = [device for device in candidates if device.get('category', '') == category]
        if brand:
            candidates = [device for device in candidates if device.get('brand', '') == brand]
        if short_num:
            candidates = [
                device for device in candidates
                if self._normalize_short_num(device.get('short_num', '')) == short_num
            ]
        if model_numbers:
            candidates = [
                device for device in candidates
                if all(
                    re.search(rf'(?<!\d){re.escape(model)}(?!\d)', " ".join([
                        device.get('code', ''), device.get('name', ''), device.get('type', '')
                    ]))
                    for model in model_numbers
                )
            ]

        candidates = self._unique_devices(candidates)
        if len(candidates) == 1:
            return candidates[0], ""
        if len(candidates) > 1:
            return None, self._ambiguous_device_error(candidates)
        return None, f"设备“{line}”不存在或设备档案信息不完整"

    def _normalize_identity(self, value):
        text = str(value or "").strip().lower()
        replacements = {
            "勾机": "钩机",
            "挖机": "钩机",
            "挖掘机": "钩机",
            "破碎锤": "炮机",
            "装载机": "铲车",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return re.sub(r'[\s\-_/，,;；]+', '', text)

    def _normalize_short_num(self, value):
        text = str(value or "").strip().upper()
        return str(int(text)) if text.isdigit() else text

    def _detect_brand_from_text(self, line):
        for brand, keywords in self.brand_keywords.items():
            if any(keyword.lower() in line.lower() for keyword in keywords):
                return brand
        return ""

    def _detect_category_from_text(self, line):
        for category, keywords in self.category_keywords.items():
            if any(keyword.lower() in line.lower() for keyword in keywords):
                return category
        return ""

    def _unique_devices(self, devices):
        return list({device.get('id'): device for device in devices if device.get('id')}.values())

    def _ambiguous_device_error(self, devices):
        names = "、".join(device.get('name', device.get('code', '')) for device in devices[:5])
        return f"设备匹配不唯一：{names}"

    def _get_device_by_id(self, device_id):
        for d in self.devices:
            if d.get('id') == device_id:
                return d
        return None

    def _extract_time_and_memo(self, line):
        """提取【时间】和（备注）以及去除后的纯文本"""
        time_detail = ""
        memo = ""

        # 完整时间块：【XX】格式
        time_match = re.search(r'【([^】]*)】', line)
        if time_match:
            time_detail = time_match.group(1).strip()
            line = re.sub(r'【[^】]*】', '', line)

        # 括号备注：（XX）格式
        memo_matches = re.findall(r'[（(]([^)）]+)[)）]', line)
        if memo_matches:
            memo = "；".join(item.strip() for item in memo_matches if item.strip())
            line = re.sub(r'[（(][^)）]+[)）]', '', line)

        # 内联时间格式：7:00-12:00 或 07:00-18:00
        inline_time_pattern = r'(\d{1,2}[:：]\d{2}\s*[-~—至到]\s*\d{1,2}[:：]\d{2})'
        inline_times = re.findall(inline_time_pattern, line)
        if inline_times and not time_detail:
            time_detail = ' '.join(inline_times)
            for t in inline_times:
                line = re.sub(re.escape(t), '', line)

        clean_line = ' '.join(line.strip().split())  # 压缩空格
        return time_detail, memo, clean_line

    def _extract_fuel(self, line):
        """提取加油量：加油280L / 加油: 280L / 280L / 耗油280L
        改进：增加多种格式、空值防护，确保返回合理值
        """
        fuel = 0.0
        if not line or not isinstance(line, str) or not line.strip():
            return (line if line else "", fuel)

        original_line = line

        # 扩展匹配模式，按优先级匹配
        fuel_patterns = [
            # 模式1: 加油280L / 加油:280L / 加油: 280升 / 加油：280L（全角冒号）
            r'加油[：:\s]*(\d+(?:\.\d+)?)\s*[Ll升]?',
            # 模式2: 280L加油 / 280升加油
            r'(\d+(?:\.\d+)?)\s*[Ll升]\s*加油',
            # 模式3: 加油 280 (纯数字，后面是空格或行尾)
            r'加油\s+(\d+(?:\.\d+)?)(?:\s|$)',
            # 模式4: 油耗280L / 用油280L / 耗油280L / 燃油280L
            r'(?:油耗|用油|耗油|燃油|加注)[：:\s]*(\d+(?:\.\d+)?)\s*[Ll升]?',
            # 模式5: fuel 280L / Diesel 280L / 柴油280L
            r'(?:fuel|diesel|柴油|gas|essence)[：:\s]*(\d+(?:\.\d+)?)\s*[Ll升]?',
            # 模式6: 独立 "280L" 或 "280升" (仅在没有"加油"关键词时使用)
            r'(?<!\d)(\d+(?:\.\d+)?)\s*[Ll升](?!加油)',
        ]
        for pat in fuel_patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if m:
                try:
                    fuel = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                # 移除匹配的部分，保留其余内容用于设备识别
                matched_text = m.group(0)
                line = line.replace(matched_text, '', 1)
                break

        # 压缩空格，保留有效内容
        clean_line = ' '.join(line.strip().split())
        if not clean_line.strip():
            # 如果完全为空（只有加油信息），返回原始行中非加油部分
            clean_line = ' '.join(
                part for part in original_line.strip().split()
                if not re.search(r'(加油|油耗|用油|柴油|燃料)[：:\s]*\d', part, re.IGNORECASE)
            )
            if not clean_line.strip():
                clean_line = ""
        return clean_line, fuel

    def _calc_duration(self, time_str):
        """计算工时 - 支持中文描述、HH:MM格式、纯数字格式、分数表达等
        改进：增强空值防护，支持更多格式描述，修复重复匹配bug
        """
        # 严格空值检查（None、空串、空白、特殊Unicode空白字符）
        if time_str is None:
            return 0
        if not isinstance(time_str, str):
            try:
                time_str = str(time_str)
            except (ValueError, TypeError):
                return 0

        cleaned = time_str.strip()
        if not cleaned:
            return 0
        if cleaned in ('', ' ', '\u3000', '\t', '\n', '\r', '\u200b', '\u200e', '\u200d', '\xa0', '\u202f'):
            return 0

        # ==========================================
        # 优先匹配：时间描述词（全天/半天/日班/夜班等）
        # ==========================================
        if re.search(r'全天|整天|整天班|全天班|全日|全白班|日班全天|全勤', cleaned):
            return 8.0
        if re.search(r'半天|半班|半天班|半日|上午半天|下午半天', cleaned):
            return 4.0
        if re.search(r'夜班|晚班|夜班全', cleaned):
            return 8.0  # 夜班通常也是8小时
        if re.search(r'白班|早班|日班|白班8', cleaned):
            return 8.0

        # ==========================================
        # 匹配 "X小时X分钟" / "XhXm" / "X小时半" 复合格式
        # ==========================================
        # 格式: "8小时30分钟" "8小时30分" "8h30m" "8h30"
        composite_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:个)?小?[时小时]\s*(\d+)\s*(?:分[钟]?|m(?:in)?)',
            r'(\d+(?:\.\d+)?)\s*[hH]\s*(\d+)\s*(?:m(?:in)?|分)?',
            r'(\d+(?:\.\d+)?)\s*(?:个)?小?[时小时]\s*(?:半|½|0\.5)',
        ]
        for pat in composite_patterns:
            m = re.search(pat, cleaned, re.IGNORECASE)
            if m:
                try:
                    hours = float(m.group(1))
                    # 检查是否是 "半" 格式
                    if '半' in m.group(0) or '½' in m.group(0):
                        hours += 0.5
                    elif len(m.groups()) >= 2:
                        hours += float(m.group(2)) / 60
                    return round(hours, 2)
                except (ValueError, TypeError, IndexError):
                    pass

        # ==========================================
        # 匹配 "X小时" / "X个小时" / "X个钟" / "Xh" / "Xhours"
        # ==========================================
        hour_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:个)?(?:小)?(?:时|小时|钟|点)',
            r'(\d+(?:\.\d+)?)\s*[hH](?:ou?rs?)?',
        ]
        for pat in hour_patterns:
            hour_match = re.search(pat, cleaned)
            if hour_match:
                try:
                    hours = float(hour_match.group(1))
                    # 检查是否还有 "X分钟" / "X分" / "Xm"
                    min_match = re.search(r'(\d+)\s*(?:分[钟]?|[mM](?:in)?)', cleaned)
                    if min_match:
                        hours += float(min_match.group(1)) / 60
                    # 上限检查：单日不超过24小时
                    if hours > 24:
                        hours = min(hours, 24)
                    return round(hours, 2)
                except ValueError:
                    break

        # ==========================================
        # 匹配 "X分钟" 纯分钟格式（优先于纯数字，避免"30"被识别为30小时）
        # ==========================================
        pure_min = re.search(r'^(\d+)\s*(?:分[钟]?|[mM](?:in)?)$', cleaned)
        if pure_min:
            try:
                mins = float(pure_min.group(1))
                if mins > 0 and mins <= 1440:  # 最多24小时=1440分钟
                    return round(mins / 60, 2)
            except ValueError:
                pass

        # ==========================================
        # 匹配时间段 HH:MM-HH:MM 格式
        # ==========================================
        pattern = r'(\d{1,2})[:：](\d{2})\s*[-~—至到]+\s*(\d{1,2})[:：](\d{2})'
        matches = re.findall(pattern, cleaned)
        if matches:
            total = 0
            for h1, m1, h2, m2 in matches:
                try:
                    start = int(h1) * 60 + int(m1)
                    end = int(h2) * 60 + int(m2)
                    diff_mins = end - start
                    if diff_mins < 0:
                        diff_mins += 24 * 60
                    diff_hours = diff_mins / 60
                    # 跳过异常值 (>18小时视为数据录入异常，如：缺少午夜分隔)
                    if 0 < diff_hours <= 18:
                        total += diff_hours
                except (ValueError, TypeError):
                    pass
            if total > 0:
                return round(total, 2)

        # ==========================================
        # 匹配单独时间点对（如 "7:00 12:00" 无连字符）
        # ==========================================
        time_pair_match = re.findall(r'(\d{1,2})[:：](\d{2})', cleaned)
        if len(time_pair_match) >= 2:
            try:
                start = int(time_pair_match[0][0]) * 60 + int(time_pair_match[0][1])
                end = int(time_pair_match[1][0]) * 60 + int(time_pair_match[1][1])
                diff = (end - start) / 60
                if diff < 0:
                    diff += 24
                if 0 < diff <= 18:
                    return round(diff, 2)
            except (ValueError, TypeError, IndexError):
                pass

        # ==========================================
        # 匹配纯数字（小时）- 必须在时间格式之后
        # ==========================================
        pure_number = re.match(r'^\s*(\d+(?:\.\d+)?)\s*$', cleaned)
        if pure_number:
            try:
                val = float(pure_number.group(1))
                # 合理范围：0 < val <= 24 视为小时
                if 0 < val <= 24:
                    return round(val, 2)
            except ValueError:
                pass

        # ==========================================
        # 兜底匹配：加班描述
        # ==========================================
        overtime_match = re.search(r'加班[加补]*\s*(\d+(?:\.\d+)?)\s*(?:个)?(?:小)?[时小时钟点]?', cleaned)
        if overtime_match:
            try:
                return round(float(overtime_match.group(1)), 2)
            except ValueError:
                pass

        # ==========================================
        # 最后的兜底：从字符串中提取第一个合理数字
        # ==========================================
        final_pat = re.search(r'(\d+(?:\.\d+)?)', cleaned)
        if final_pat:
            try:
                val = float(final_pat.group(1))
                if 0 < val <= 24:
                    return round(val, 2)
            except ValueError:
                pass

        return 0

    def _identify_device(self, line, default_category, context):
        line_clean = line.strip()

        # Pattern1: "1号徐工炮机"
        pattern1 = r'^(\d+)号\s*([一二三四五六七八九十临柳徐三工]+)\s*(\d{0,3})\s*(钩机|炮机|铲车|矿卡|短车|压路机|挖掘机|破碎锤)'
        m = re.search(pattern1, line_clean)
        if m:
            num, brand_hint, model, type_hint = m.groups()
            brand = self._normalize_brand(brand_hint)
            category = self._normalize_category(type_hint)
            if '临工' in brand_hint and '106' in line_clean:
                brand = '临工'
                for d in self.devices:
                    if d.get('brand') == '临工' and '106' in d.get('code', '') and str(d.get('short_num', '')) == num:
                        return d, 99, '精确匹配-临工106'
            key = (num, brand, category)
            if key in self.triple_index:
                return self.triple_index[key], 98, '精确匹配-三维索引'
            for d in self.devices:
                if (str(d.get('short_num', '')) == num and
                    d.get('brand') == brand and
                    d.get('category') == category):
                    return d, 97, '精确匹配-遍历查找'

        # Pattern2: "徐工800钩机"
        pattern2 = r'^([一二三四五六七八九十临柳徐三工]+)\s*(\d{2,4})\s*(钩机|炮机|铲车|矿卡|挖掘机|破碎锤)'
        m = re.search(pattern2, line_clean)
        if m:
            brand_hint, model, type_hint = m.groups()
            brand = self._normalize_brand(brand_hint)
            category = self._normalize_category(type_hint)
            key = (brand, category, model)
            if key in self.model_features:
                candidates = self.model_features[key]
                if len(candidates) == 1:
                    return candidates[0], 96, '精确匹配-型号特征'
                for c in candidates:
                    if c.get('short_num', '') == '':
                        return c, 95, '精确匹配-无短号'

        # Pattern3: 压路机单独
        if line_clean in ('压路机', '徐工压路机'):
            for d in self.devices:
                if d.get('category') == '压路机':
                    return d, 99, '精确匹配-单一设备'

        # Pattern4: X号矿卡
        pattern4 = r'^(\d+)号\s*矿卡'
        m = re.search(pattern4, line_clean)
        if m:
            num = m.group(1)
            for d in self.devices:
                if (d.get('brand') == '徐工' and
                    d.get('category') == '矿卡' and
                    str(d.get('short_num', '')) == num and
                    '90' in d.get('code', '')):
                    return d, 97, '精确匹配-矿卡'

        # Pattern5: X号短车
        pattern5 = r'^(\d+)号\s*短车'
        m = re.search(pattern5, line_clean)
        if m:
            num = m.group(1)
            for d in self.devices:
                if (d.get('category') == '短车' and str(d.get('short_num', '')) == num):
                    return d, 98, '精确匹配-短车'

        # Pattern6: X号品牌铲车
        pattern6 = r'^(\d+)号\s*([一二三四五六七八九十临柳徐三工]+)\s*(\d{0,3})\s*铲车'
        m = re.search(pattern6, line_clean)
        if m:
            num, brand_hint, model = m.groups()
            brand = self._normalize_brand(brand_hint)
            if brand in ('柳工', '徐工'):
                for d in self.devices:
                    if (d.get('brand') == brand and
                        d.get('category') == '铲车' and
                        str(d.get('short_num', '')) == num):
                        return d, 97, f'精确匹配-{brand}铲车'

        # Alias match
        if line_clean in self.alias_map:
            return self.alias_map[line_clean], 95, '别名匹配'

        # Combination match
        numbers = re.findall(r'(\d+)', line_clean)
        detected_brand = None
        for brand, keywords in self.brand_keywords.items():
            if any(kw in line_clean for kw in keywords):
                detected_brand = brand
                break
        detected_category = None
        for cat, keywords in self.category_keywords.items():
            if any(kw in line_clean for kw in keywords):
                detected_category = cat
                break
        if detected_brand and detected_category and numbers:
            short_num = numbers[0]
            for d in self.devices:
                if (d.get('brand') == detected_brand and
                    d.get('category') == detected_category and
                    str(d.get('short_num', '')) == short_num):
                    return d, 92, '组合匹配-完整信息'

        # Context inference
        if numbers and not detected_brand and not detected_category:
            if context.get('last_brand') and default_category:
                short_num = numbers[0]
                for d in self.devices:
                    if (d.get('brand') == context['last_brand'] and
                        d.get('category') == default_category and
                        str(d.get('short_num', '')) == short_num):
                        return d, 85, '上下文推断'

        return None, 0, '未匹配'

    def _fuzzy_match(self, line, default_category, context):
        numbers = re.findall(r'(\d+)', line)
        if not numbers:
            return None, 0, '模糊匹配-无数字'
        scores = []
        for d in self.devices:
            score = 0
            if str(d.get('short_num', '')) in numbers:
                score += 50
            for brand, keywords in self.brand_keywords.items():
                if d.get('brand') == brand:
                    if any(kw in line for kw in keywords):
                        score += 30
            if default_category and d.get('category') == default_category:
                score += 20
            else:
                for cat, keywords in self.category_keywords.items():
                    if d.get('category') == cat:
                        if any(kw in line for kw in keywords):
                            score += 20
            dev_nums = re.findall(r'\d+', d.get('code', ''))
            for dn in dev_nums:
                if dn in numbers and len(dn) >= 2:
                    score += 10
            if context.get('last_brand') == d.get('brand'):
                score += 5
            if score >= 60:
                scores.append((score, d))
        if scores:
            scores.sort(reverse=True, key=lambda x: x[0])
            return scores[0][1], scores[0][0], '模糊匹配'
        return None, 0, '模糊匹配失败'

    def _normalize_brand(self, text):
        text = text.strip()
        if '三一' in text or 'sany' in text.lower():
            return '三一'
        if '徐工' in text or 'xcmg' in text.lower():
            return '徐工'
        if '临工' in text or 'lingong' in text.lower() or '林工' in text:
            return '临工'
        if '柳工' in text or 'liugong' in text.lower():
            return '柳工'
        if '短车' in text:
            return '短车'
        return text

    def _normalize_category(self, text):
        text = text.strip()
        mapping = {
            '钩机': '挖掘机', '挖掘机': '挖掘机', '挖机': '挖掘机', '勾机': '挖掘机', 'wjj': '挖掘机',
            '炮机': '破碎锤', '破碎锤': '破碎锤', '炮': '破碎锤', '锤': '破碎锤', 'psc': '破碎锤',
            '铲车': '铲车', '装载机': '铲车', 'cc': '铲车',
            '矿卡': '矿卡', '矿车': '矿卡', '卡车': '矿卡',
            '短车': '短车', 'dc': '短车',
            '压路机': '压路机', '压路': '压路机', 'ylj': '压路机',
            '鹰嘴勾': '鹰嘴勾', '鹰嘴': '鹰嘴勾', 'yzg': '鹰嘴勾',
        }
        return mapping.get(text, text)
