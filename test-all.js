const BASE = "http://localhost:4173";

function utf8Body(body) {
  return { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}
function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}
async function json(resp) {
  const text = await resp.text();
  return JSON.parse(text);
}

async function run() {
  const results = [];

  // 1. Guest Login
  let r = await fetch(`${BASE}/api/auth?action=guest-login`, utf8Body({ nickname: "全功能测试", avatar_url: "" }));
  let j = await json(r);
  const token = j.token;
  const headers = authHeaders(token);
  results.push(`1.GuestLogin: ${r.status} nick=${j.user.nickname}`);

  // 2. Verify Identity
  r = await fetch(`${BASE}/api/auth?action=verify-identity`, { ...utf8Body({ real_name: "李四光", id_card_last4: "5678" }), headers });
  j = await json(r);
  results.push(`2.VerifyIdentity: ${r.status} verified=${j.user.is_verified}`);

  // 3. List Records (empty)
  r = await fetch(`${BASE}/api/records`);
  j = await json(r);
  results.push(`3.ListRecords: ${r.status} count=${j.records.length}`);

  // 4. Create Record
  r = await fetch(`${BASE}/api/records`, { ...utf8Body({ type: "lost", title: "测试黑色钱包", category: "证件", color: "黑色", location: "南京东路地铁站", time: "2026-05-29T14:00", contact: "微信test123", description: "黑色皮质钱包，内有身份证", item_status: "unknown" }), headers });
  j = await json(r);
  const recId = j.record.id;
  results.push(`4.CreateRecord: ${r.status} id=${recId} title=${j.record.title}`);

  // 5. List After Create
  r = await fetch(`${BASE}/api/records`);
  j = await json(r);
  results.push(`5.ListAfterCreate: ${r.status} count=${j.records.length}`);

  // 6. Update Record
  r = await fetch(`${BASE}/api/records`, { ...utf8Body({ id: recId, item_status: "custody" }), headers, method: "PATCH" });
  j = await json(r);
  results.push(`6.UpdateRecord: ${r.status} ok=${j.ok}`);

  // 7. Custody Points
  r = await fetch(`${BASE}/api/custody?action=points`);
  j = await json(r);
  results.push(`7.CustodyPoints: ${r.status} count=${j.points.length}`);

  // 8. Institutions
  r = await fetch(`${BASE}/api/custody?action=institutions`);
  j = await json(r);
  results.push(`8.Institutions: ${r.status} count=${j.institutions.length}`);

  // 9. Deposit
  r = await fetch(`${BASE}/api/custody?action=deposit`, { ...utf8Body({ record_id: recId, point_id: "cp_001" }), headers });
  j = await json(r);
  const pickupCode = j.pickup_code;
  results.push(`9.Deposit: ${r.status} code=${pickupCode}`);

  // 10. Pickup
  r = await fetch(`${BASE}/api/custody?action=pickup`, { ...utf8Body({ record_id: recId, pickup_code: pickupCode }), headers });
  j = await json(r);
  results.push(`10.Pickup: ${r.status} ok=${j.ok}`);

  // 11. Notify Push
  r = await fetch(`${BASE}/api/notify?action=push`, { ...utf8Body({ title: "测试通知", body: "这是一条测试消息" }), headers });
  j = await json(r);
  results.push(`11.NotifyPush: ${r.status} ok=${j.ok}`);

  // 12. Notify Poll
  r = await fetch(`${BASE}/api/notify?action=poll`, { headers });
  j = await json(r);
  results.push(`12.NotifyPoll: ${r.status} count=${j.notifications.length}`);

  // 13. Mark Read
  if (j.notifications.length > 0) {
    r = await fetch(`${BASE}/api/notify?action=mark-read`, { ...utf8Body({ ids: [j.notifications[0].id] }), headers });
    j = await json(r);
    results.push(`13.MarkRead: ${r.status} ok=${j.ok}`);
  } else {
    results.push("13.MarkRead: SKIP (no notifications)");
  }

  // 14. Delete Record
  r = await fetch(`${BASE}/api/records`, { ...utf8Body({ id: recId }), headers, method: "DELETE" });
  j = await json(r);
  results.push(`14.DeleteRecord: ${r.status} ok=${j.ok}`);

  // 15. List After Delete
  r = await fetch(`${BASE}/api/records`);
  j = await json(r);
  results.push(`15.ListAfterDelete: ${r.status} count=${j.records.length}`);

  // 16. Auth Me
  r = await fetch(`${BASE}/api/auth?action=me`, { headers });
  j = await json(r);
  results.push(`16.AuthMe: ${r.status} sub=${j.user.id}`);

  // 17. Unauth Create (should 401)
  r = await fetch(`${BASE}/api/records`, utf8Body({ type: "lost", title: "unauth" }));
  results.push(`17.UnauthCreate: ${r.status} (expect 401)`);

  // 18. Unauth Push (should 401)
  r = await fetch(`${BASE}/api/notify?action=push`, utf8Body({ title: "unauth" }));
  results.push(`18.UnauthPush: ${r.status} (expect 401)`);

  // 19. Wrong Pickup Code
  r = await fetch(`${BASE}/api/custody?action=deposit`, { ...utf8Body({ record_id: recId, point_id: "cp_001" }), headers });
  j = await json(r);
  const code2 = j.pickup_code;
  r = await fetch(`${BASE}/api/custody?action=pickup`, { ...utf8Body({ record_id: recId, pickup_code: "XX-0000" }), headers });
  j = await json(r);
  results.push(`19.WrongPickupCode: ${r.status} (expect 400)`);

  // 20. Structured Input (may timeout without API key)
  r = await fetch(`${BASE}/api/structured-input`, { ...utf8Body({ text: "昨天下午3点在南京东路地铁站丢了一个黑色双肩包" }), headers });
  j = await json(r);
  results.push(`20.StructuredInput: ${r.status} category=${j.category || j.error || "timeout"}`);

  console.log(results.join("\n"));
}

run().catch(console.error);
