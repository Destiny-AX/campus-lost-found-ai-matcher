const { getSupabaseConfig, supabaseFetch } = require('./api/_shared');

async function addVisualSeedColumn() {
  console.log('=== 添加 visual_seed 列 ===\n');

  const config = getSupabaseConfig();
  if (!config) {
    console.log('错误: 无法获取 Supabase 配置');
    return;
  }

  try {
    // 使用 Supabase RPC 或 REST API 添加列
    // 方法1: 直接调用 Postgres REST API 执行 ALTER TABLE
    const response = await supabaseFetch(
      config,
      '/rest/v1/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'tx=commit',
        },
        body: JSON.stringify({
          query: 'ALTER TABLE public.lost_found_records ADD COLUMN IF NOT EXISTS visual_seed jsonb;'
        }),
      }
    );

    console.log('状态码:', response.status);
    const text = await response.text();
    console.log('响应:', text);

  } catch (error) {
    console.log('异常:', error.message);
  }
}

// 备用方案：检查当前表结构
async function checkTableSchema() {
  console.log('=== 检查表结构 ===\n');

  const config = getSupabaseConfig();
  if (!config) {
    console.log('错误: 无法获取 Supabase 配置');
    return;
  }

  try {
    // 查询 information_schema 获取列信息
    const response = await supabaseFetch(
      config,
      '/rest/v1/rpc/get_schema_info',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'lost_found_records' }),
      }
    );

    console.log('RPC 状态码:', response.status);
    const text = await response.text();
    console.log('响应:', text);
  } catch (error) {
    console.log('异常:', error.message);
  }
}

addVisualSeedColumn();
