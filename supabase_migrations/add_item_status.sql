-- 为 lost_found_records 表添加 item_status 列
-- 执行时间: 2026-06-03

-- 1. 添加 item_status 列（如果不存在）
ALTER TABLE lost_found_records
ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'unknown';

-- 2. 为现有数据设置默认值
UPDATE lost_found_records
SET item_status = 'unknown'
WHERE item_status IS NULL;

-- 3. 添加注释说明
COMMENT ON COLUMN lost_found_records.item_status IS '物品状态: unknown(未知), custody(代为保管), institution(已交机构), in_place(仍在原地), returned(已归还), expired(已过期)';
