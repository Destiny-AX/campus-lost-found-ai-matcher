const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: 4173, path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('=== 验证 1: 登录 ===');
  const loginRes = await request('POST', '/api/auth?action=wechat-login', { nickname: '测试用户' });
  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;
  console.log('登录状态:', loginRes.status, 'token:', !!token);

  console.log('\n=== 验证 2: 发布记录（带自定义时间）===');
  const customTime = '2025-05-20T14:30';
  const record = {
    id: `record-${Date.now()}`, type: 'lost', title: '测试编辑功能',
    category: '电子设备', color: '黑色', location: '南京东路',
    time: customTime, contact: '13800138000', description: '测试描述',
    status: '待找回', item_status: 'unknown', owner_id: loginData.user.sub,
    imageData: '', imageFeature: null, semantic: null
  };
  const pubRes = await request('POST', '/api/records', { record }, { Authorization: `Bearer ${token}` });
  const pubData = JSON.parse(pubRes.data);
  console.log('发布状态:', pubRes.status, '有record:', !!pubData.record);
  console.log('发布返回 time:', pubData.record?.time);
  const recordId = pubData.record?.id;

  console.log('\n=== 验证 3: 获取记录确认时间 ===');
  const listRes = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
  const listData = JSON.parse(listRes.data);
  const myRecord = listData.records?.find(r => r.id === recordId);
  console.log('列表中找到记录:', !!myRecord);
  console.log('记录时间:', myRecord?.time);
  console.log('是否等于自定义时间:', myRecord?.time === customTime);

  console.log('\n=== 验证 4: 编辑记录 ===');
  if (recordId) {
    const updateRes = await request('PATCH', '/api/records', {
      id: recordId, title: '已编辑的标题', description: '已编辑的描述', time: '2025-05-21T10:00'
    }, { Authorization: `Bearer ${token}` });
    console.log('编辑状态:', updateRes.status);
    const updateData = JSON.parse(updateRes.data);
    console.log('编辑结果:', updateData.ok ? '成功' : updateData.error);

    // 再次获取确认编辑生效
    const listRes2 = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
    const listData2 = JSON.parse(listRes2.data);
    const editedRecord = listData2.records?.find(r => r.id === recordId);
    console.log('编辑后标题:', editedRecord?.title);
    console.log('编辑后时间:', editedRecord?.time);
  }

  console.log('\n=== 验证 5: 删除记录 ===');
  if (recordId) {
    const delRes = await request('DELETE', '/api/records', { id: recordId }, { Authorization: `Bearer ${token}` });
    console.log('删除状态:', delRes.status);
    const delData = JSON.parse(delRes.data);
    console.log('删除结果:', delData.ok ? '成功' : delData.error);
  }

  console.log('\n=== 验证 6: 检查 index.html 修改 ===');
  const fs = require('fs');
  const html = fs.readFileSync('d:\\Trae_Solo_Project\\拾寻\\index.html', 'utf8');
  console.log('有"丢失/捡到时间":', html.includes('丢失/捡到时间'));
  console.log('有"上海市全域":', html.includes('上海市全域'));
  console.log('有 scope-badge:', html.includes('scope-badge'));

  console.log('\n=== 验证 7: 检查 script.js 修改 ===');
  const js = fs.readFileSync('d:\\Trae_Solo_Project\\拾寻\\script.js', 'utf8');
  console.log('有 openEditForm:', js.includes('function openEditForm'));
  console.log('有 handleUpdateRecord:', js.includes('function handleUpdateRecord'));
  console.log('有 editingRecordId:', js.includes('editingRecordId'));
  console.log('有 my-records-section:', js.includes('my-records-section'));
  console.log('编辑请求用 PATCH:', js.includes("method: \"PATCH\""));

  console.log('\n=== 验证 8: 检查 style.css 修改 ===');
  const css = fs.readFileSync('d:\\Trae_Solo_Project\\拾寻\\style.css', 'utf8');
  console.log('有 .scope-badge:', css.includes('.scope-badge'));
  console.log('有 .my-records-section:', css.includes('.my-records-section'));

  console.log('\n=== 全部验证完成 ===');
})();
