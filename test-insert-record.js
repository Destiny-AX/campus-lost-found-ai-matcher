const { getSupabaseConfig, supabaseFetch } = require('./api/_shared');

async function testInsertRecord() {
  console.log('=== 测试插入记录 ===\n');

  const config = getSupabaseConfig();
  if (!config) {
    console.log('错误: 无法获取 Supabase 配置');
    return;
  }

  const testRecord = {
    id: `test-record-${Date.now()}`,
    type: 'lost',
    title: '测试PS5手柄',
    category: '电子设备',
    color: '黑色',
    location: '测试地点',
    event_time: '2026-06-14T10:00',
    contact: '测试联系',
    description: '这是一条测试记录',
    status: '待找回',
    item_status: 'unknown',
    owner_id: 'test-user',
    image_data: '',
    image_feature: null,
    semantic: null,
    created_at: new Date().toISOString(),
    city: '上海市',
    district: '静安区',
    street: '南京西路',
    detail_location: '测试详细地点',
    claim_question: '',
  };

  try {
    console.log('1. 插入测试记录...');
    const response = await supabaseFetch(
      config,
      '/rest/v1/lost_found_records',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(testRecord),
      }
    );

    const text = await response.text();
    console.log('   状态码:', response.status);

    if (!response.ok) {
      console.log('   插入失败:', text);
      return;
    }

    const rows = JSON.parse(text || '[]');
    console.log('   插入成功! ID:', rows[0]?.id);

    console.log('\n2. 查询验证...');
    const verifyResponse = await supabaseFetch(
      config,
      `/rest/v1/lost_found_records?id=eq.${testRecord.id}&select=*`,
      { method: 'GET' }
    );

    const verifyData = await verifyResponse.json();
    if (verifyData.length > 0) {
      console.log('   验证成功! 记录存在:', verifyData[0].title);
    } else {
      console.log('   验证失败! 记录不存在');
    }

    console.log('\n3. 清理测试记录...');
    const deleteResponse = await supabaseFetch(
      config,
      `/rest/v1/lost_found_records?id=eq.${testRecord.id}`,
      { method: 'DELETE' }
    );

    if (deleteResponse.ok) {
      console.log('   清理成功!');
    } else {
      console.log('   清理失败:', await deleteResponse.text());
    }

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.log('   异常:', error.message);
  }
}

testInsertRecord();
