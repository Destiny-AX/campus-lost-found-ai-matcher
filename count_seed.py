import re

with open('api/records.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找所有 demo- 开头的记录id
ids = re.findall(r'id:\s*"(demo-[a-z]+-\d+|demo-[a-z]+-cuc-\d+)"', content)
print(f'Total seed records: {len(ids)}')
print(ids[:10], '...', ids[-5:])
