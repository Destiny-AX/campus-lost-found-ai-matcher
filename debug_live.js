const http = require('http');

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = { hostname: 'localhost', port: 4173, path, method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(options, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, data: d })); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1. 登录
  const loginRes = await request('POST', '/api/auth?action=wechat-login', { nickname: '实时测试' });
  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;
  console.log('登录成功');

  // 2. 先获取当前列表
  const listBefore = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
  const beforeData = JSON.parse(listBefore.data);
  console.log('发布前记录数:', beforeData.records?.length);

  // 3. 发布记录
  const recordId = `record-${Date.now()}`;
  const record = {
    id: recordId, type: 'lost', title: '实时测试记录',
    category: '电子设备', color: '黑色', location: '南京东路',
    time: '2025-05-20T14:30', contact: '13800138000', description: '测试',
    status: '待找回', item_status: 'unknown', owner_id: loginData.user.sub,
    imageData: '', imageFeature: null, semantic: null
  };
  const pubRes = await request('POST', '/api/records', { record }, { Authorization: `Bearer ${token}` });
  const pubData = JSON.parse(pubRes.data);
  console.log('发布状态:', pubRes.status);
  console.log('发布返回 id:', pubData.record?.id);

  // 4. 立即获取列表
  const listAfter = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
  const afterData = JSON.parse(listAfter.data);
  console.log('发布后记录数:', afterData.records?.length);
  console.log('所有记录 IDs:', afterData.records?.map(r => r.id));

  const found = afterData.records?.find(r => r.id === recordId);
  console.log('找到新记录:', !!found);
  if (found) {
    console.log('新记录时间:', found.time);
  }

  // 5. 测试编辑
  const patchRes = await request('PATCH', '/api/records', {
    id: recordId, title: '已编辑标题', time: '2025-05-21T10:00'
  }, { Authorization: `Bearer ${token}` });
  const patchData = JSON.parse(patchRes.data);
  console.log('\n编辑状态:', patchRes.status, '结果:', patchData.ok ? '成功' : patchData.error);

  // 6. 再次获取确认编辑
  const listFinal = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
  const finalData = JSON.parse(listFinal.data);
  const edited = finalData.records?.find(r => r.id === recordId);
  console.log('编辑后标题:', edited?.title);
  console.log('编辑后时间:', edited?.time);

  // 7. 删除
  const delRes = await request('DELETE', '/api/records', { id: recordId }, { Authorization: `Bearer ${token}` });
  console.log('\n删除状态:', delRes.status);
})();
