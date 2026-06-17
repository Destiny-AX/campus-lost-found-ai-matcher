import re
import json

# 读取 seed records
with open('api/records.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有 demo 记录块（简化处理：用json解析）
start = content.find('const SEED_RECORDS = [')
end = content.find('];', start) + 2
records_text = content[start:end]

# 将记录文本转换为可解析的JSON（去掉尾逗号等）
records_text = records_text.replace('const SEED_RECORDS = ', '')
# 使用更健壮的方法：按id提取每个记录

# 用正则提取关键字段
ids = re.findall(r'id:\s*"([^"]+)"', records_text)
types = re.findall(r'type:\s*"([^"]+)"', records_text)
titles = re.findall(r'title:\s*"([^"]+)"', records_text)
categories = re.findall(r'category:\s*"([^"]+)"', records_text)
colors = re.findall(r'color:\s*"([^"]+)"', records_text)
locations = re.findall(r'location:\s*"([^"]+)"', records_text)
event_times = re.findall(r'event_time:\s*"([^"]+)"', records_text)
cities = re.findall(r'city:\s*"([^"]+)"', records_text)
districts = re.findall(r'district:\s*"([^"]+)"', records_text)

records = []
for i in range(len(ids)):
    records.append({
        'id': ids[i],
        'type': types[i],
        'title': titles[i],
        'category': categories[i],
        'color': colors[i],
        'location': locations[i],
        'event_time': event_times[i],
        'city': cities[i] if i < len(cities) else '',
        'district': districts[i] if i < len(districts) else '',
    })

print(f'Total records parsed: {len(records)}')

# 简单计算匹配度：类别相同+颜色相同+地点相同+时间差小于2小时
def calc_score(a, b):
    if a['type'] == b['type']:
        return 0
    score = 0
    if a['category'] == b['category']:
        score += 30
    if a['color'] == b['color']:
        score += 20
    if a['location'] == b['location']:
        score += 25
    elif a['district'] == b['district'] and a['district']:
        score += 10
    # 时间差
    try:
        ta = a['event_time'][:16]
        tb = b['event_time'][:16]
        from datetime import datetime
        da = datetime.fromisoformat(ta)
        db = datetime.fromisoformat(tb)
        diff_hours = abs((da - db).total_seconds()) / 3600
        if diff_hours <= 1:
            score += 25
        elif diff_hours <= 3:
            score += 15
        elif diff_hours <= 24:
            score += 5
    except:
        pass
    return score

losts = [r for r in records if r['type'] == 'lost']
finds = [r for r in records if r['type'] == 'found']
print(f'Lost: {len(losts)}, Found: {len(finds)}')

pairs_80 = 0
pairs_60 = 0
best_matches = []
for lost in losts:
    best_score = 0
    best_found = None
    for found in finds:
        if found['category'] != lost['category']:
            continue
        s = calc_score(lost, found)
        if s > best_score:
            best_score = s
            best_found = found
    if best_found:
        best_matches.append((lost, best_found, best_score))
        if best_score >= 80:
            pairs_80 += 1
        if best_score >= 60:
            pairs_60 += 1

print(f'Best matches >=80: {pairs_80}')
print(f'Best matches >=60: {pairs_60}')
print('\nTop matches:')
for lost, found, score in sorted(best_matches, key=lambda x: -x[2])[:10]:
    print(f'  {score}% | {lost["title"]} <-> {found["title"]} | {lost["location"]}')
