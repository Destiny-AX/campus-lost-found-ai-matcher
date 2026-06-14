const { getSupabaseConfig, supabaseFetch } = require('./api/_shared');

async function testSupabaseConnection() {
  console.log('=== Supabase 连接测试开始 ===\n');

  // 1. 检查配置是否存在
  const config = getSupabaseConfig();
  console.log('1. 配置检查:');
  console.log('   Config exists:', !!config);
  if (config) {
    console.log('   URL:', config.url.substring(0, 30) + '...');
    console.log('   Key exists:', !!config.key);
  } else {
    console.log('   错误: 无法获取 Supabase 配置，请检查环境变量');
    return;
  }

  try {
    // 2. 测试连接 - 查询 lost_found_records 表
    console.log('\n2. 数据库连接测试:');
    const response = await supabaseFetch(
      config,
      '/rest/v1/lost_found_records?select=*&order=created_at.desc&limit=5',
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   连接失败，状态码:', response.status);
      console.log('   错误信息:', errorText);
      return;
    }

    const data = await response.json();
    console.log('   连接成功!');
    console.log('   记录总数:', data.length);

    // 3. 显示最近创建的记录
    console.log('\n3. 最近创建的记录 (最多5条):');
    if (data.length === 0) {
      console.log('   表中暂无数据');
    } else {
      data.forEach((record, index) => {
        console.log(`\n   [${index + 1}]`);
        console.log('       ID:', record.id);
        console.log('       类型:', record.type);
        console.log('       标题:', record.title);
        console.log('       状态:', record.status);
        console.log('       创建时间:', record.created_at);
        if (record.location) {
          console.log('       地点:', record.location);
        }
      });
    }

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.log('   连接异常:', error.message);
    console.log('\n=== 测试失败 ===');
  }
}

testSupabaseConnection();
