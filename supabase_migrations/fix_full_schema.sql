-- 补全 lost_found_records 表缺失的列
-- 执行时间: 2026-06-03

-- 1. 添加 owner_id 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT '';

-- 2. 添加 item_status 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'unknown';

-- 3. 添加 custody_point_id 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS custody_point_id TEXT DEFAULT '';

-- 4. 添加 pickup_code 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT '';

-- 5. 添加 image_data 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS image_data TEXT DEFAULT '';

-- 6. 添加 image_feature 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS image_feature JSONB DEFAULT NULL;

-- 7. 添加 semantic 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS semantic JSONB DEFAULT NULL;

-- 8. 为现有数据设置默认值
UPDATE lost_found_records
SET
  owner_id = COALESCE(owner_id, ''),
  item_status = COALESCE(item_status, 'unknown'),
  custody_point_id = COALESCE(custody_point_id, ''),
  pickup_code = COALESCE(pickup_code, ''),
  image_data = COALESCE(image_data, ''),
  image_feature = COALESCE(image_feature, NULL),
  semantic = COALESCE(semantic, NULL)
WHERE owner_id IS NULL
   OR item_status IS NULL
   OR custody_point_id IS NULL
   OR pickup_code IS NULL
   OR image_data IS NULL;
