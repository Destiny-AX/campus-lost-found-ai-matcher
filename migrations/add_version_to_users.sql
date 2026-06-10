-- 为 shiyun_users 表添加 version 字段，用于乐观锁防并发覆盖
-- 执行方式：在 Supabase SQL Editor 中运行

-- 1. 添加 version 列（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shiyun_users' AND column_name = 'version'
    ) THEN
        ALTER TABLE shiyun_users ADD COLUMN version INTEGER DEFAULT 1;
    END IF;
END $$;

-- 2. 为现有记录设置 version = 1（如果为 NULL）
UPDATE shiyun_users SET version = 1 WHERE version IS NULL;

-- 3. 添加非空约束（可选，推荐）
-- ALTER TABLE shiyun_users ALTER COLUMN version SET NOT NULL;

-- 4. 验证
SELECT id, nickname, version FROM shiyun_users LIMIT 5;
