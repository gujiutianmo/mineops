"""设备智能匹配器 - 从 kuangshang_system 移植并适配 SQLAlchemy"""
import re
import difflib
from collections import defaultdict


class FleetMatcher:
    """设备智能匹配器 - 使用设备 dict 列表初始化"""

    def __init__(self, dev_list):
        """
        dev_list: 设备 dict 列表，每个 dict 包含字段:
          id, code, name, brand, type, category, vehicle_num, short_num, aliases
        """
        self.dev_list = dev_list
        self.dev_map = {dev['id']: dev for dev in self.dev_list}
        self._build_index()
        self._build_pattern_rules()

    def _build_index(self):
        self.idx_by_num = defaultdict(set)
        self.idx_by_brand = defaultdict(set)
        self.idx_by_category = defaultdict(set)
        self.idx_by_alias = defaultdict(set)
        self.idx_by_name_keyword = defaultdict(set)
        self.idx_by_model_num = defaultdict(set)
        self.idx_by_vehicle_num = defaultdict(set)
        self.dev_names = []
        self.dev_name_map = {}

        for dev in self.dev_list:
            dev_id = dev['id']
            short_num = dev.get('short_num', '')
            if short_num:
                self.idx_by_num[short_num].add(dev_id)
                if short_num.isdigit():
                    self.idx_by_num[str(int(short_num))].add(dev_id)

            vehicle_num = dev.get('vehicle_num', '').strip().upper()
            if vehicle_num:
                self.idx_by_vehicle_num[vehicle_num].add(dev_id)
                self.idx_by_num[vehicle_num].add(dev_id)
                self.idx_by_alias[vehicle_num].add(dev_id)
                self.idx_by_alias[vehicle_num.lower()].add(dev_id)

            aliases = dev.get('aliases', '')
            if aliases:
                for alias in aliases.split(','):
                    alias_clean = alias.strip()
                    if alias_clean:
                        self.idx_by_alias[alias_clean].add(dev_id)
                        self.idx_by_alias[alias_clean.upper()].add(dev_id)
                        nums_in_alias = re.findall(r'\d+', alias_clean)
                        for num in nums_in_alias:
                            self.idx_by_alias[num].add(dev_id)

            brand = dev.get('brand', '')
            if brand:
                self.idx_by_brand[brand].add(dev_id)
                if len(brand) >= 2:
                    self.idx_by_brand[brand[0]].add(dev_id)

            category = dev.get('category', '')
            if category:
                self.idx_by_category[category].add(dev_id)

            dev_name = dev.get('name', '')
            if dev_name:
                keywords = self._extract_name_keywords(dev_name)
                for kw in keywords:
                    self.idx_by_name_keyword[kw].add(dev_id)
                self.dev_names.append(dev_name)
                self.dev_name_map[dev_name] = dev_id

            dev_code = dev.get('code', '')
            model_nums = re.findall(r'(\d+)', dev_code)
            for num in model_nums:
                self.idx_by_model_num[num].add(dev_id)

    def _build_pattern_rules(self):
        self.category_patterns = {
            '挖掘机': {
                'keywords': ['钩机', '勾机', '挖机', '挖掘机', 'wjj', 'excavator', '挖土机', '钩车'],
                'exclude': ['炮', '破碎', '锤'],
                'weight': 1.2,
                'priority': 1
            },
            '破碎锤': {
                'keywords': ['炮', '破碎', '锤', 'psc', '破碎锤', 'breaker', '炮机', '破石锤'],
                'exclude': ['钩机', '挖机', '挖掘机'],
                'weight': 1.2,
                'priority': 1
            },
            '铲车': {
                'keywords': ['铲车', '铲', '装载机', 'cc', 'loader', '装载车', '铲土机'],
                'exclude': [],
                'weight': 1.0,
                'priority': 2
            },
            '矿卡': {
                'keywords': ['矿卡', '矿车', '卡车', 'kc', 'truck', '90', '106', '矿用卡车', '矿用自卸车'],
                'exclude': ['钩机', '铲车'],
                'weight': 1.1,
                'priority': 2
            },
            '短车': {
                'keywords': ['短车', 'dc', 'short', '短驳车', '短程车'],
                'exclude': [],
                'weight': 1.0,
                'priority': 3
            },
            '压路机': {
                'keywords': ['压路机', '压路', 'ylj', 'roller', '碾压机', '压土机'],
                'exclude': [],
                'weight': 1.0,
                'priority': 3
            },
            '鹰嘴勾': {
                'keywords': ['鹰嘴勾', '鹰嘴', 'yzg', 'hook', '鹰嘴钩', '勾臂'],
                'exclude': [],
                'weight': 1.0,
                'priority': 3
            },
            '推土机': {
                'keywords': ['推土机', '推土', 'ttj', 'dozer', '推土车'],
                'exclude': [],
                'weight': 1.0,
                'priority': 3
            }
        }
        self.brand_patterns = {
            '三一': {'keywords': ['三一', 'sany', 'sy', 'sanyi', '三一重工'], 'weight': 1.2, 'priority': 1},
            '徐工': {'keywords': ['徐工', 'xcmg', 'xg', 'xugong', '徐工集团'], 'weight': 1.2, 'priority': 1},
            '临工': {'keywords': ['临工', 'lingong', 'lg', 'lin', '林工', '临工集团'], 'weight': 1.1, 'priority': 2},
            '柳工': {'keywords': ['柳工', 'liugong', 'lg', 'liu', '柳工集团'], 'weight': 1.1, 'priority': 2},
            '山推': {'keywords': ['山推', 'shantui', 'st'], 'weight': 1.0, 'priority': 3},
            '卡特': {'keywords': ['卡特', 'caterpillar', 'cat'], 'weight': 1.0, 'priority': 3},
            '小松': {'keywords': ['小松', 'komatsu'], 'weight': 1.0, 'priority': 3}
        }

    def _extract_name_keywords(self, name):
        keywords = set()
        numbers = re.findall(r'(\d+)', name)
        keywords.update(numbers)
        chinese = re.findall(r'[\u4e00-\u9fa5]+', name)
        for ch in chinese:
            for i in range(len(ch)):
                for j in range(i + 1, min(i + 5, len(ch) + 1)):
                    keywords.add(ch[i:j])
        english = re.findall(r'[a-zA-Z]{2,}', name)
        keywords.update([e.lower() for e in english])
        keywords = {kw for kw in keywords if len(kw) > 1 or kw.isdigit()}
        return keywords

    def find_best_match(self, line, context=""):
        cleaned_line = self._clean_input(line)
        if '压路机' in cleaned_line:
            road_rollers = [dev for dev in self.dev_list if dev.get('category') == '压路机']
            if road_rollers:
                return road_rollers[0]['id'], road_rollers[0]['name'], 1000

        info = self._extract_info(line, context)
        candidates = self._get_candidates(info)
        if not candidates:
            candidates = self._fuzzy_match(line, info)
        if not candidates:
            candidates = set(self.dev_map.keys())

        scored = []
        for dev_id in candidates:
            dev = self.dev_map[dev_id]
            score = self._calculate_score_v3(dev, info, line, context)
            scored.append((score, dev_id))

        scored.sort(reverse=True)
        if scored:
            best_score, best_id = scored[0]
            best_dev = self.dev_map[best_id]
            threshold = self._calculate_threshold(info, best_score)
            if best_score >= threshold:
                return best_dev['id'], best_dev['name'], best_score
            if len(scored) > 1:
                second_score, _ = scored[1]
                if best_score - second_score >= 20:
                    return best_dev['id'], best_dev['name'], best_score

        direct_match = self._try_direct_match(line)
        if direct_match:
            return direct_match
        fuzzy_name_match = self._try_fuzzy_name_match(line)
        if fuzzy_name_match:
            return fuzzy_name_match
        return "", "未匹配", 0

    def _clean_input(self, text):
        text = re.sub(r'【[^】]*】', '', text)
        text = re.sub(r'（[^）]*）', '', text)
        text = ' '.join(text.split())
        return text.strip()

    def _extract_info(self, line, context):
        cleaned_line = self._clean_input(line)
        text = cleaned_line.lower()
        ctx = context.lower() if context else ""
        combined = f"{ctx} {text}"
        info = {
            'line': line, 'text': text, 'context': ctx, 'combined': combined,
            'numbers': re.findall(r'(\d+)[号台辆]?', line),
            'all_numbers': re.findall(r'\d+', line),
            'category_hints': self._detect_category(combined),
            'brand_hints': self._detect_brand(combined),
            'has_time': bool(re.search(r'\d{1,2}[:：]\d{2}', line)),
            'has_fuel': bool(re.search(r'[（(]\d*\.?\d*\s*[Ll升]?[)）]', line)),
            'has_number_marker': bool(re.search(r'[号台辆]', line)),
            'text_length': len(line),
        }
        info['model_numbers'] = [n for n in info['all_numbers'] if len(n) >= 2 and n not in info['numbers']]
        info['name_fragments'] = self._extract_name_fragments(line)
        # Extract alphanumeric tokens for vehicle_num matching (e.g., RX01, KC01)
        alpha_tokens = re.findall(r'[A-Za-z]{1,6}\d{1,6}', line)
        info['alpha_tokens'] = [t.upper() for t in alpha_tokens]
        # Add them to numbers list for candidate generation
        info['numbers'] = list(info['numbers']) + info['alpha_tokens']
        return info

    def _extract_name_fragments(self, line):
        fragments = []
        chinese_pattern = r'[\u4e00-\u9fa5]{2,}'
        fragments.extend(re.findall(chinese_pattern, line))
        num_chinese_pattern = r'\d+[\u4e00-\u9fa5]+'
        fragments.extend(re.findall(num_chinese_pattern, line))
        for brand in self.brand_patterns:
            for kw in self.brand_patterns[brand]['keywords']:
                if kw in line:
                    brand_num_pattern = fr'{kw}\s*(\d+)'
                    fragments.extend([f"{kw}{num}" for num in re.findall(brand_num_pattern, line)])
        return fragments

    def _detect_category(self, text):
        detected = []
        for cat, pattern in self.category_patterns.items():
            score = 0
            for kw in pattern['keywords']:
                if kw in text:
                    score += pattern['weight'] * 1.5
                    if text.startswith(kw) or f" {kw} " in f" {text} ":
                        score += 0.3
            for ex in pattern['exclude']:
                if ex in text:
                    score -= 0.8
            score += (4 - pattern['priority']) * 0.1
            if score > 0:
                detected.append((cat, score))
        detected.sort(key=lambda x: x[1], reverse=True)
        return detected[:3]

    def _detect_brand(self, text):
        detected = []
        for brand, pattern in self.brand_patterns.items():
            score = 0
            for kw in pattern['keywords']:
                if kw in text:
                    score += pattern['weight'] * 1.3
                    if re.search(fr'{kw}\s*\d+', text):
                        score += 0.5
            score += (4 - pattern['priority']) * 0.1
            if score > 0:
                detected.append((brand, score))
        detected.sort(key=lambda x: x[1], reverse=True)
        return detected[:2]

    def _get_candidates(self, info):
        candidates = set()
        for num in info['numbers']:
            candidates.update(self.idx_by_num.get(num, set()))
            candidates.update(self.idx_by_alias.get(num, set()))
        # vehicle_num matching (RX01, KC01 etc.)
        for num in info['numbers']:
            candidates.update(self.idx_by_vehicle_num.get(num.upper(), set()))
        # Also check cleaned text fragments for vehicle_num patterns
        for word in info['text'].split():
            word_upper = word.upper()
            candidates.update(self.idx_by_vehicle_num.get(word_upper, set()))
        for fragment in info['name_fragments']:
            for alias, dev_set in self.idx_by_alias.items():
                if fragment in alias or alias in fragment:
                    candidates.update(dev_set)
            for kw, dev_set in self.idx_by_name_keyword.items():
                if fragment in kw or kw in fragment:
                    candidates.update(dev_set)
        for num in info['model_numbers']:
            candidates.update(self.idx_by_model_num.get(num, set()))
        if info['brand_hints'] and info['category_hints']:
            brand_set = set()
            for brand, _ in info['brand_hints']:
                brand_set.update(self.idx_by_brand.get(brand, set()))
            cat_set = set()
            for cat, _ in info['category_hints']:
                cat_set.update(self.idx_by_category.get(cat, set()))
            joint = brand_set & cat_set
            if joint:
                candidates.update(joint)
            candidates.update(brand_set | cat_set)
        if info['brand_hints']:
            for brand, _ in info['brand_hints']:
                candidates.update(self.idx_by_brand.get(brand, set()))
        if info['category_hints']:
            for cat, _ in info['category_hints']:
                candidates.update(self.idx_by_category.get(cat, set()))
        return candidates

    def _calculate_score_v2(self, dev, info, original_line, context):
        score = 0
        dev_id = dev['id'].lower()
        dev_name = dev.get('name', '').lower()
        category = dev.get('category', '')
        brand = dev.get('brand', '')
        short_num = dev.get('short_num', '')
        aliases = dev.get('aliases', '').lower()
        vehicle_num = dev.get('vehicle_num', '').strip().upper()
        vehicle_num_lower = vehicle_num.lower()
        # Check if full vehicle_num appears anywhere in the input line
        if vehicle_num and vehicle_num in original_line.upper():
            score += 500
            if info['brand_hints'] and brand in [b for b, _ in info['brand_hints']]:
                score += 80
            if info['category_hints'] and category in [c for c, _ in info['category_hints']]:
                score += 80
        elif vehicle_num_lower and vehicle_num_lower in info['text']:
            score += 500
            if info['brand_hints'] and brand in [b for b, _ in info['brand_hints']]:
                score += 80
            if info['category_hints'] and category in [c for c, _ in info['category_hints']]:
                score += 80
        for num in info['numbers']:
            if num == short_num:
                score += 100
                if info['brand_hints'] and brand in [b for b, _ in info['brand_hints']]:
                    score += 50
                if info['category_hints'] and category in [c for c, _ in info['category_hints']]:
                    score += 50
        for alias in aliases.split(','):
            alias_clean = alias.strip()
            if alias_clean and alias_clean in info['combined']:
                score += 40
        for br, br_score in info['brand_hints']:
            if br == brand:
                score += 30 * br_score
        for cat, cat_score in info['category_hints']:
            if cat == category:
                score += 25 * cat_score
        dev_model_nums = set(re.findall(r'\d+', dev_id))
        for num in info['model_numbers']:
            if num in dev_model_nums:
                score += 20
        name_keywords = self._extract_name_keywords(dev.get('name', ''))
        for kw in name_keywords:
            if kw in info['combined']:
                score += 10
        if category == '压路机' and info['category_hints']:
            if '压路机' in [c for c, _ in info['category_hints']]:
                return 500
        if info['brand_hints']:
            detected_brands = [b for b, _ in info['brand_hints']]
            if brand not in detected_brands and len(detected_brands) > 0:
                if brand == '三一' and '徐工' in detected_brands:
                    score -= 40
                elif brand == '徐工' and '三一' in detected_brands:
                    score -= 40
                elif brand == '临工' and '柳工' in detected_brands:
                    score -= 30
        return max(0, score)

    def _calculate_score_v3(self, dev, info, line, context):
        base_score = self._calculate_score_v2(dev, info, line, context)
        extra_score = 0
        dev_name = dev.get('name', '').lower()
        category = dev.get('category', '')
        brand = dev.get('brand', '')
        if dev_name and line.lower() in dev_name:
            extra_score += 30
        if info['category_hints']:
            for cat, cat_score in info['category_hints']:
                if cat == category:
                    extra_score += 20 * cat_score
                    for pattern in self.category_patterns.get(cat, {}).get('keywords', []):
                        if pattern in line.lower():
                            extra_score += 100
        if info['brand_hints']:
            for br, br_score in info['brand_hints']:
                if br == brand:
                    extra_score += 15 * br_score
        dev_id_lower = dev['id'].lower()
        for num in info['all_numbers']:
            if num in dev_id_lower:
                extra_score += 10
        if info['text_length'] > 3 and len(line) > 3:
            similarity = self._text_similarity(line.lower(), dev_name)
            extra_score += int(similarity * 10)
        has_number_match = False
        for num in info['numbers']:
            if num == dev.get('short_num', ''):
                has_number_match = True
                break
        if has_number_match:
            extra_score += 300
            if category == '短车':
                extra_score += 200
        else:
            for num in info['numbers']:
                if num in dev_id_lower:
                    extra_score += 50
        if not has_number_match and brand and category:
            same_brand_cat = [d for d in self.dev_list
                              if d.get('brand') == brand and d.get('category') == category]
            if len(same_brand_cat) > 1:
                same_brand_cat.sort(key=lambda x: int(x.get('short_num', 999)) if x.get('short_num', '').isdigit() else 999)
                if same_brand_cat and dev['id'] == same_brand_cat[0]['id']:
                    extra_score += 20
        line_lower = line.lower()
        for cat, patterns in self.category_patterns.items():
            if cat == category:
                for keyword in patterns['keywords']:
                    if keyword in line_lower:
                        extra_score += 150
                        if info['brand_hints'] and brand in [b for b, _ in info['brand_hints']]:
                            extra_score += 80
                        break
                break
        return base_score + extra_score

    def _calculate_threshold(self, info, best_score):
        base_threshold = 30
        if info['has_number_marker']:
            base_threshold -= 5
        if info['brand_hints'] or info['category_hints']:
            base_threshold += 10
        if best_score > 80:
            base_threshold = 50
        elif best_score > 60:
            base_threshold = 40
        return base_threshold

    def _try_direct_match(self, line):
        patterns = [
            r'(SY|XG|LG|DC)[-]?(\d+)[-]?(\d+)?[-]?([a-z]+)',
            r'(SY|XG|LG|DC)[-]?(\d+)[-]?([a-z]+)',
            r'(三一|徐工|临工|柳工)[-]?(\d+)[-]?号?([a-z]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) >= 3:
                    possible_ids = [
                        f"{groups[0]}-{groups[1]}-{groups[2]}".upper(),
                        f"{groups[0]}-{groups[1]}{groups[2]}".upper(),
                    ]
                    for pid in possible_ids:
                        if pid in self.dev_map:
                            dev = self.dev_map[pid]
                            return dev['id'], dev['name'], 95
        return None

    def _fuzzy_match(self, line, info):
        candidates = set()
        if self.dev_names:
            matches = difflib.get_close_matches(line, self.dev_names, n=3, cutoff=0.6)
            for match in matches:
                dev_id = self.dev_name_map.get(match)
                if dev_id:
                    candidates.add(dev_id)
        if info['brand_hints']:
            for brand, _ in info['brand_hints']:
                candidates.update(self.idx_by_brand.get(brand, set()))
        if info['category_hints']:
            for cat, _ in info['category_hints']:
                candidates.update(self.idx_by_category.get(cat, set()))
        return candidates

    def _try_fuzzy_name_match(self, line):
        if not self.dev_names:
            return None
        matches = difflib.get_close_matches(line, self.dev_names, n=1, cutoff=0.7)
        if matches:
            dev_name = matches[0]
            dev_id = self.dev_name_map.get(dev_name)
            if dev_id:
                dev = self.dev_map[dev_id]
                return dev['id'], dev['name'], 85
        return None

    def _text_similarity(self, text1, text2):
        if not text1 or not text2:
            return 0.0
        set1 = set(text1)
        set2 = set(text2)
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
