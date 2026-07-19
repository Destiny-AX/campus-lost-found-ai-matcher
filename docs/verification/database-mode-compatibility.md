# 数据库模式兼容性

状态：代码路径已检查；本轮未连接或写入任何真实数据库。

- 保留 Supabase REST 适配、Storage 上传、records/auth/notify/custody 等服务端路径。
- 环境变量优先 `LOST_FOUND_SUPABASE_URL` + `LOST_FOUND_SUPABASE_SERVICE_ROLE_KEY`，兼容原有大小写与历史别名。
- URL 或 Key 任一缺失时，`getSupabaseConfig()` 返回 null，records 使用 `demo_memory`；两者完整时优先 Supabase。
- `supabaseFetch` 有 15 秒超时；服务端写入继续使用映射函数统一数据库/内存结构。
- 本轮未执行 SQL、未运行迁移接口、未修改 Schema、未触碰生产数据。
- `supabase-schema.sql` 与迁移文件仅作为建议材料；上线前需在隔离 Preview 数据库做兼容性检查和 RLS/Storage 审计。
- 未验证：真实表结构一致性、RLS、Storage bucket、并发、持久化、生产权限。
