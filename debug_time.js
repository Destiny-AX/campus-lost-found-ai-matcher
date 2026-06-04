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
  // 1. 登录
  const loginRes = await request('POST', '/api/auth?action=wechat-login', { nickname: '时间测试' });
  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;
  console.log('登录成功, sub:', loginData.user.sub);

  // 2. 发布记录
  const customTime = '2025-05-20T14:30';
  const record = {
    id: `record-${Date.now()}`, type: 'lost', title: '时间测试',
    category: '电子设备', color: '黑色', location: '南京东路',
    time: customTime, contact: '13800138000', description: '测试时间字段',
    status: '待找回', item_status: 'unknown', owner_id: loginData.user.sub,
    imageData: '', imageFeature: null, semantic: null
  };
  const pubRes = await request('POST', '/api/records', { record }, { Authorization: `Bearer ${token}` });
  const pubData = JSON.parse(pubRes.data);
  console.log('\n发布返回 record 字段:', JSON.stringify(pubData.record, null, 2));

  // 3. 获取列表
  const listRes = await request('GET', '/api/records', null, { Authorization: `Bearer ${token}` });
  const listData = JSON.parse(listRes.data);
  console.log('\n列表返回第一条:', JSON.stringify(listData.records?.[0], null, 2));
})();
