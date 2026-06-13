// 诊断 Supabase 连接问题
const https = require('https');

async function testSupabase() {
  // 从环境变量读取配置（与 _shared.js 相同逻辑）
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_KEY || '';

  console.log('=== Supabase 连接诊断 ===\n');
  console.log('1. 配置检查:');
  console.log('   URL 存在:', !!url);
  console.log('   URL 前缀:', url ? url.substring(0, 40) + '...' : '无');
  console.log('   Key 存在:', !!key);
  console.log('   Key 长度:', key ? key.length : 0);

  if (!url || !key) {
    console.log('\n   错误: 缺少 Supabase 配置');
    return;
  }

  // 测试连接 - 查询表
  console.log('\n2. 测试查询表 lost_found_records:');
  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.get(
        `${url}/rest/v1/lost_found_records?select=*&limit=1`,
        {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });

    console.log('   状态码:', result.status);
    console.log('   响应体:', result.body.substring(0, 200));

    if (result.status === 200) {
      console.log('\n   连接成功！');
    } else if (result.status === 404) {
      console.log('\n   错误: 表不存在 (404)');
    } else if (result.status === 401) {
      console.log('\n   错误: 认证失败 (401)，请检查 API Key');
    } else {
      console.log('\n   错误: 未知错误');
    }
  } catch (error) {
    console.log('\n   连接异常:', error.message);
  }

  console.log('\n=== 诊断完成 ===');
}

testSupabase();
