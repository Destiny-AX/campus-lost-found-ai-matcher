"use strict";

// 记录 CRUD API（v2 扩展版）
// GET    /api/records              列表（支持模糊化）
// POST   /api/records              创建（需登录，自动填充 owner_id）
// DELETE /api/records              删除（需登录 + owner 校验）
// PATCH  /api/records              更新状态（需登录）

const {
  getSupabaseConfig,
  supabaseFetch,
  readJsonBody,
  sendJson,
  getCurrentUser,
  safeErrorText,
  validateString,
  validateInt,
  checkRateLimit,
  generateUuid,
} = require("./_shared");
const { updateUserWithLock } = require("./auth");
const { pushNotification } = require("./notify");

const TABLE = "lost_found_records";
const memoryRecords = new Map();

// ============== 示例种子数据（Demo 用） ==============
// 当 Supabase 未配置或为空时，提供默认示例记录供演示
const SEED_RECORDS = [
  {
    id: "demo-lost-01",
    type: "lost",
    title: "黑色AirPods Pro耳机盒",
    category: "电子设备",
    color: "黑色",
    location: "三里屯地铁站A口",
    event_time: "2026-06-05T08:30",
    contact: "微信: zhang_san_2024",
    description: "黑色AirPods Pro充电盒，外壳有轻微划痕，没有耳机在里面。可能在早高峰过安检时掉落。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "三里屯",
    detail_location: "地铁站A口安检处",
    owner_id: "",
    image_data: "/images/耳机.png",
    image_feature: null,
    semantic: {
      object_name: "AirPods Pro充电盒",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["充电盒", "圆角", "轻微划痕"],
      confidence: 0.88,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-05T09:00:00Z",
  },
  {
    id: "demo-found-01",
    type: "found",
    title: "黑色无线耳机充电盒",
    category: "电子设备",
    color: "黑色",
    location: "三里屯地铁站A口",
    event_time: "2026-06-05T08:45",
    contact: "电话: 138****5678",
    description: "早高峰在地铁站2号口捡到黑色耳机充电盒，外观较新，没有耳机。已代为保管。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "三里屯",
    detail_location: "地铁站A口",
    owner_id: "",
    image_data: "/images/耳机.png",
    image_feature: null,
    semantic: {
      object_name: "无线耳机充电盒",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["充电盒", "圆角", "外观较新"],
      confidence: 0.85,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-05T09:15:00Z",
  },
  {
    id: "demo-lost-02",
    type: "lost",
    title: "蓝色学生卡（带卡套）",
    category: "证件",
    color: "蓝色",
    location: "王府井地铁站换乘通道",
    event_time: "2026-06-06T17:20",
    contact: "微信: li_si_campus",
    description: "蓝色校园卡，装在透明卡套里，卡套上有小星星贴纸。卡号后四位是8842。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "东城区",
    street: "王府井",
    detail_location: " 1号线转8号线换乘通道",
    owner_id: "",
    image_data: "/images/卡.png",
    image_feature: null,
    semantic: {
      object_name: "学生校园卡",
      category: "证件",
      colors: ["蓝色", "透明"],
      brand_guess: "未知",
      visible_text: ["校园卡"],
      features: ["透明卡套", "小星星贴纸", "卡号8842"],
      confidence: 0.92,
    },
    visualSeed: { background: "#e8ecf4", primary: "#2563eb", secondary: "#dbeafe", shape: "card" },
    created_at: "2026-06-06T18:00:00Z",
  },
  {
    id: "demo-found-02",
    type: "found",
    title: "蓝色校园卡",
    category: "证件",
    color: "蓝色",
    location: "王府井地铁站服务台",
    event_time: "2026-06-06T17:50",
    contact: "地铁站服务台 010-65231234",
    description: "在换乘通道捡到蓝色校园卡，已交至地铁站服务台。卡套有星星贴纸。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "东城区",
    street: "王府井",
    detail_location: "地铁站服务中心",
    owner_id: "",
    image_data: "/images/卡.png",
    image_feature: null,
    semantic: {
      object_name: "蓝色校园卡",
      category: "证件",
      colors: ["蓝色"],
      brand_guess: "未知",
      visible_text: ["校园卡"],
      features: ["卡套", "星星贴纸"],
      confidence: 0.9,
    },
    visualSeed: { background: "#e8ecf4", primary: "#2563eb", secondary: "#dbeafe", shape: "card" },
    created_at: "2026-06-06T18:30:00Z",
  },
  {
    id: "demo-lost-03",
    type: "lost",
    title: "银色钥匙串（3把+绿色挂件）",
    category: "钥匙",
    color: "银色",
    location: "中关村欧美汇购物中心B1层",
    event_time: "2026-06-07T14:00",
    contact: "电话: 159****2341",
    description: "三把银色钥匙，带一个绿色小恐龙挂件。可能在欧美汇B1美食区遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "海淀区",
    street: "中关村",
    detail_location: "欧美汇B1层美食区",
    owner_id: "",
    image_data: "/images/钥匙.png",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色小恐龙挂件"],
      confidence: 0.87,
    },
    visualSeed: { background: "#faf5f0", primary: "#b45309", secondary: "#fcd34d", shape: "key" },
    created_at: "2026-06-07T15:00:00Z",
  },
  {
    id: "demo-found-03",
    type: "found",
    title: "银色钥匙串",
    category: "钥匙",
    color: "银色",
    location: "中关村欧美汇购物中心B1层",
    event_time: "2026-06-07T14:30",
    contact: "微信: wang_wu_finder",
    description: "在美食区座位下捡到三把银色钥匙，带绿色挂件。已放在欧美汇服务台。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "海淀区",
    street: "中关村",
    detail_location: "欧美汇服务台",
    owner_id: "",
    image_data: "/images/钥匙.png",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色挂件"],
      confidence: 0.86,
    },
    visualSeed: { background: "#faf5f0", primary: "#b45309", secondary: "#fcd34d", shape: "key" },
    created_at: "2026-06-07T15:30:00Z",
  },
  {
    id: "demo-lost-04",
    type: "lost",
    title: "红色折叠伞",
    category: "生活用品",
    color: "红色",
    location: "国贸地铁站3号口",
    event_time: "2026-06-07T19:10",
    contact: "微信: zhao_liu_umbrella",
    description: "红色折叠伞，伞柄有黑色防滑套，伞面上有白色波点图案。下班高峰时遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "国贸",
    detail_location: "地铁站3号口出站闸机旁",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "红色折叠伞",
      category: "生活用品",
      colors: ["红色", "白色", "黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["折叠伞", "黑色防滑套", "白色波点"],
      confidence: 0.84,
    },
    visualSeed: { background: "#fef2f2", primary: "#dc2626", secondary: "#fca5a5", shape: "umbrella" },
    created_at: "2026-06-07T20:00:00Z",
  },
  {
    id: "demo-found-04",
    type: "found",
    title: "红色波点折叠伞",
    category: "生活用品",
    color: "红色",
    location: "国贸地铁站3号口",
    event_time: "2026-06-07T19:30",
    contact: "电话: 136****8910",
    description: "在3号口闸机旁捡到红色波点伞，伞柄有黑色防滑套。我代为保管，请联系取回。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "国贸",
    detail_location: "3号口出站闸机旁",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "红色波点折叠伞",
      category: "生活用品",
      colors: ["红色", "白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["波点图案", "黑色防滑套"],
      confidence: 0.83,
    },
    visualSeed: { background: "#fef2f2", primary: "#dc2626", secondary: "#fca5a5", shape: "umbrella" },
    created_at: "2026-06-07T20:30:00Z",
  },
  // ============== 扩展示例数据：更多区域和类别 ==============
  {
    id: "demo-lost-05",
    type: "lost",
    title: "黑色双肩包",
    category: "箱包",
    color: "黑色",
    location: "首都机场T3航站楼",
    event_time: "2026-06-06T10:15",
    contact: "微信: chen_bag_99",
    description: "黑色尼龙双肩包，侧面有反光条，包内有一台笔记本电脑和充电器。过安检后忘记拿。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "首都机场",
    detail_location: "T3航站楼C区登机口附近",
    owner_id: "",
    image_data: "/images/包.png",
    image_feature: null,
    semantic: {
      object_name: "黑色双肩包",
      category: "箱包",
      colors: ["黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["尼龙材质", "反光条", "笔记本电脑"],
      confidence: 0.86,
    },
    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-06T11:00:00Z",
  },
  {
    id: "demo-found-05",
    type: "found",
    title: "黑色双肩包",
    category: "箱包",
    color: "黑色",
    location: "首都机场服务台",
    event_time: "2026-06-06T10:40",
    contact: "首都机场失物招领 010-64535856",
    description: "在A12登机口附近捡到黑色双肩包，已交至机场失物招领处。包内有电脑，请携带身份证领取。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "朝阳区",
    street: "首都机场",
    detail_location: "机场失物招领处",
    owner_id: "",
    image_data: "/images/包.png",
    image_feature: null,
    semantic: {
      object_name: "黑色双肩包",
      category: "箱包",
      colors: ["黑色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["尼龙材质", "反光条"],
      confidence: 0.84,
    },
    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-06T11:30:00Z",
  },
  {
    id: "demo-lost-06",
    type: "lost",
    title: "金色手链（周大福）",
    category: "贵重物品",
    color: "黄色",
    location: "什刹海观景台",
    event_time: "2026-06-05T20:00",
    contact: "电话: 186****7788",
    description: "周大福足金手链，约15克，链身有细小磨砂纹理。拍照时取下放在栏杆上忘记拿。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "西城区",
    street: "什刹海",
    detail_location: "观景台北侧栏杆处",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "金色手链",
      category: "贵重物品",
      colors: ["黄色", "金色"],
      brand_guess: "周大福",
      visible_text: [],
      features: ["足金", "磨砂纹理", "约15克"],
      confidence: 0.82,
    },
    visualSeed: { background: "#fffbeb", primary: "#d97706", secondary: "#fde68a", shape: "jewelry" },
    created_at: "2026-06-05T21:00:00Z",
  },
  {
    id: "demo-found-06",
    type: "found",
    title: "金色手链",
    category: "贵重物品",
    color: "黄色",
    location: "什刹海观景台",
    event_time: "2026-06-05T20:30",
    contact: "微信: finder_wai",
    description: "在观景台栏杆处捡到一条金色手链，看起来是足金的。已代为保管，请准确描述款式来认领。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "西城区",
    street: "什刹海",
    detail_location: "观景台北侧",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "金色手链",
      category: "贵重物品",
      colors: ["黄色", "金色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["足金", "磨砂纹理"],
      confidence: 0.8,
    },
    visualSeed: { background: "#fffbeb", primary: "#d97706", secondary: "#fde68a", shape: "jewelry" },
    created_at: "2026-06-05T21:30:00Z",
  },
  {
    id: "demo-lost-07",
    type: "lost",
    title: "透明玻璃水杯",
    category: "生活用品",
    color: "透明",
    location: "五道口万达广场",
    event_time: "2026-06-07T13:00",
    contact: "微信: sun_cup",
    description: "透明玻璃杯，杯身印有星巴克logo，带黑色硅胶杯套。可能在万达三楼餐饮区遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "海淀区",
    street: "五道口",
    detail_location: "万达广场三楼餐饮区",
    owner_id: "",
    image_data: "/images/杯.png",
    image_feature: null,
    semantic: {
      object_name: "透明玻璃水杯",
      category: "生活用品",
      colors: ["透明"],
      brand_guess: "星巴克",
      visible_text: ["星巴克"],
      features: ["玻璃杯", "黑色硅胶杯套", "logo"],
      confidence: 0.85,
    },
    visualSeed: { background: "#f0f9ff", primary: "#0891b2", secondary: "#a5f3fc", shape: "cup" },
    created_at: "2026-06-07T14:00:00Z",
  },
  {
    id: "demo-found-07",
    type: "found",
    title: "星巴克玻璃杯",
    category: "生活用品",
    color: "透明",
    location: "五道口万达广场",
    event_time: "2026-06-07T13:30",
    contact: "电话: 137****9900",
    description: "在餐饮区桌上捡到透明星巴克玻璃杯，带黑色杯套。放在万达服务台了。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "海淀区",
    street: "五道口",
    detail_location: "万达广场服务台",
    owner_id: "",
    image_data: "/images/杯.png",
    image_feature: null,
    semantic: {
      object_name: "星巴克玻璃杯",
      category: "生活用品",
      colors: ["透明"],
      brand_guess: "星巴克",
      visible_text: ["星巴克"],
      features: ["玻璃杯", "黑色杯套"],
      confidence: 0.83,
    },
    visualSeed: { background: "#f0f9ff", primary: "#0891b2", secondary: "#a5f3fc", shape: "cup" },
    created_at: "2026-06-07T14:30:00Z",
  },
  {
    id: "demo-lost-08",
    type: "lost",
    title: "iPad Pro 11寸（银色）",
    category: "电子设备",
    color: "银色",
    location: "上地地铁站",
    event_time: "2026-06-08T09:00",
    contact: "微信: liu_ipad_pro",
    description: "银色iPad Pro 11寸，带深空灰智能双面夹。可能在地铁站座位上遗忘。已开启查找功能。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "海淀区",
    street: "上地",
    detail_location: "地铁站站台座椅",
    owner_id: "",
    image_data: "/images/键盘.png",
    image_feature: null,
    semantic: {
      object_name: "iPad Pro",
      category: "电子设备",
      colors: ["银色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["11寸", "智能双面夹", "深空灰"],
      confidence: 0.9,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "tablet" },
    created_at: "2026-06-08T10:00:00Z",
  },
  {
    id: "demo-found-08",
    type: "found",
    title: "银色平板电脑",
    category: "电子设备",
    color: "银色",
    location: "上地地铁站",
    event_time: "2026-06-08T09:20",
    contact: "地铁站工作人员",
    description: "在站台座椅上捡到银色平板电脑，带保护套。已交至地铁站服务中心。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "海淀区",
    street: "上地",
    detail_location: "地铁站服务中心",
    owner_id: "",
    image_data: "/images/键盘.png",
    image_feature: null,
    semantic: {
      object_name: "银色平板电脑",
      category: "电子设备",
      colors: ["银色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["平板电脑", "保护套"],
      confidence: 0.87,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "tablet" },
    created_at: "2026-06-08T10:30:00Z",
  },
  {
    id: "demo-lost-09",
    type: "lost",
    title: "粉色毛绒围巾",
    category: "生活用品",
    color: "粉色",
    location: "八角游乐园",
    event_time: "2026-06-04T16:00",
    contact: "电话: 139****1122",
    description: "粉色羊毛围巾，末端有小流苏，是在游乐园手作店买的。可能在拍照时取下遗忘。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "石景山区",
    street: "八角",
    detail_location: "游乐园正门附近",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "粉色毛绒围巾",
      category: "生活用品",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["羊毛", "小流苏", "手作"],
      confidence: 0.78,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "cup" },
    created_at: "2026-06-04T17:00:00Z",
  },
  {
    id: "demo-found-09",
    type: "found",
    title: "粉色围巾",
    category: "生活用品",
    color: "粉色",
    location: "八角游乐园游客中心",
    event_time: "2026-06-04T16:30",
    contact: "八角游乐园服务台",
    description: "在正门捡到粉色围巾，末端有流苏。已交至游客中心失物招领处。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "石景山区",
    street: "八角",
    detail_location: "游客中心失物招领处",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "粉色围巾",
      category: "生活用品",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["流苏", "羊毛"],
      confidence: 0.76,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "cup" },
    created_at: "2026-06-04T17:30:00Z",
  },
  {
    id: "demo-lost-10",
    type: "lost",
    title: "灰色运动手环",
    category: "电子设备",
    color: "灰色",
    location: "回龙观地铁站",
    event_time: "2026-06-08T07:30",
    contact: "微信: ma_mi_band",
    description: "小米手环8 Pro，灰色表带，屏幕有细微划痕。晨跑后可能在地铁站洗手台遗忘。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "昌平区",
    street: "回龙观",
    detail_location: "地铁站洗手间",
    owner_id: "",
    image_data: "/images/手环.png",
    image_feature: null,
    semantic: {
      object_name: "灰色运动手环",
      category: "电子设备",
      colors: ["灰色"],
      brand_guess: "小米",
      visible_text: [],
      features: ["手环", "灰色表带", "细微划痕"],
      confidence: 0.84,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-08T08:30:00Z",
  },
  {
    id: "demo-found-10",
    type: "found",
    title: "灰色智能手环",
    category: "电子设备",
    color: "灰色",
    location: "回龙观地铁站",
    event_time: "2026-06-08T07:50",
    contact: "电话: 150****3344",
    description: "在地铁站洗手台捡到灰色智能手环，看起来是小米的。已代为保管。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "昌平区",
    street: "回龙观",
    detail_location: "地铁站服务台",
    owner_id: "",
    image_data: "/images/手环.png",
    image_feature: null,
    semantic: {
      object_name: "灰色智能手环",
      category: "电子设备",
      colors: ["灰色"],
      brand_guess: "小米",
      visible_text: [],
      features: ["手环", "灰色表带"],
      confidence: 0.82,
    },    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-08T08:50:00Z",
  },
  {
    id: "demo-lost-11",
    type: "lost",
    title: "白色笔记本（带贴纸）",
    category: "学习用品",
    color: "白色",
    location: "学院路大学图书馆",
    event_time: "2026-06-07T15:00",
    contact: "微信: zhou_notebook",
    description: "白色硬壳笔记本，封面贴满了动漫贴纸，内有课堂笔记。可能在图书馆三楼阅览室遗忘。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "海淀区",
    street: "学院路",
    detail_location: "图书馆三楼阅览室",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "白色笔记本",
      category: "学习用品",
      colors: ["白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["硬壳", "动漫贴纸", "课堂笔记"],
      confidence: 0.79,
    },    visualSeed: { background: "#f0fdf4", primary: "#16a34a", secondary: "#bbf7d0", shape: "book" },
    created_at: "2026-06-07T16:00:00Z",
  },
  {
    id: "demo-found-11",
    type: "found",
    title: "白色硬壳笔记本",
    category: "学习用品",
    color: "白色",
    location: "学院路大学图书馆",
    event_time: "2026-06-07T15:40",
    contact: "图书馆管理员",
    description: "在三楼阅览室桌上捡到白色笔记本，封面有很多贴纸。已交至图书馆失物招领处。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "海淀区",
    street: "学院路",
    detail_location: "图书馆失物招领处",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "白色硬壳笔记本",
      category: "学习用品",
      colors: ["白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["硬壳", "贴纸"],
      confidence: 0.77,
    },    visualSeed: { background: "#f0fdf4", primary: "#16a34a", secondary: "#bbf7d0", shape: "book" },
    created_at: "2026-06-07T16:40:00Z",
  },
  {
    id: "demo-lost-12",
    type: "lost",
    title: "绿色帆布手提袋",
    category: "箱包",
    color: "绿色",
    location: "黄村百联购物中心",
    event_time: "2026-06-06T14:00",
    contact: "电话: 133****5566",
    description: "绿色帆布手提袋，印有白色小花图案，袋内有刚买的化妆品和钱包。可能在试衣间遗忘。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "大兴区",
    street: "黄村",
    detail_location: "百联购物中心二楼试衣间",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "绿色帆布手提袋",
      category: "箱包",
      colors: ["绿色", "白色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["帆布", "白色小花", "化妆品"],
      confidence: 0.81,
    },    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-06T15:00:00Z",
  },
  {
    id: "demo-found-12",
    type: "found",
    title: "绿色帆布袋",
    category: "箱包",
    color: "绿色",
    location: "黄村百联购物中心",
    event_time: "2026-06-06T14:30",
    contact: "购物中心服务台",
    description: "在二楼试衣间捡到绿色帆布手提袋，内有物品。已交至服务台，请描述袋内物品认领。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "大兴区",
    street: "黄村",
    detail_location: "购物中心服务台",
    owner_id: "",
    image_data: "",
    image_feature: null,
    semantic: {
      object_name: "绿色帆布袋",
      category: "箱包",
      colors: ["绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["帆布", "手提袋"],
      confidence: 0.79,
    },    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-06T15:30:00Z",
  },
  // ============== 传媒大学校园场景示例数据 ==============
  {
    id: "demo-lost-cuc-01",
    type: "lost",
    title: "白色蓝牙耳机（AirPods 3）",
    category: "电子设备",
    color: "白色",
    location: "中国传媒大学一食堂二楼",
    event_time: "2026-06-10T12:00",
    contact: "微信: cuc_student_01",
    description: "白色AirPods 3充电盒（含耳机），外壳有轻微划痕，挂有一个小熊挂件。中午在食堂吃饭时放在桌上忘记拿。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "一食堂二楼靠窗座位",
    owner_id: "",
    image_data: "/images/耳机.png",
    image_feature: null,
    semantic: {
      object_name: "AirPods 3蓝牙耳机",
      category: "电子设备",
      colors: ["白色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["充电盒", "小熊挂件", "轻微划痕"],
      confidence: 0.9,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-10T12:30:00Z",
  },
  {
    id: "demo-found-cuc-01",
    type: "found",
    title: "白色AirPods充电盒",
    category: "电子设备",
    color: "白色",
    location: "中国传媒大学一食堂",
    event_time: "2026-06-10T12:20",
    contact: "微信: cuc_finder_01",
    description: "在一食堂二楼靠窗座位捡到白色AirPods充电盒，有小熊挂件。已代为保管，请联系认领。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "一食堂二楼",
    owner_id: "",
    image_data: "/images/耳机.png",
    image_feature: null,
    semantic: {
      object_name: "白色AirPods充电盒",
      category: "电子设备",
      colors: ["白色"],
      brand_guess: "Apple",
      visible_text: [],
      features: ["充电盒", "小熊挂件"],
      confidence: 0.88,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "earbud" },
    created_at: "2026-06-10T13:00:00Z",
  },
  {
    id: "demo-lost-cuc-02",
    type: "lost",
    title: "蓝色校园卡（带挂绳）",
    category: "证件",
    color: "蓝色",
    location: "中国传媒大学图书馆",
    event_time: "2026-06-09T18:00",
    contact: "微信: cuc_student_02",
    description: "蓝色中国传媒大学校园卡，装在透明卡套里，配蓝色挂绳。卡号后四位是2024。可能在图书馆三楼自习区遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "图书馆三楼自习区",
    owner_id: "",
    image_data: "/images/卡.png",
    image_feature: null,
    semantic: {
      object_name: "校园卡",
      category: "证件",
      colors: ["蓝色", "透明"],
      brand_guess: "未知",
      visible_text: ["中国传媒大学"],
      features: ["透明卡套", "蓝色挂绳", "卡号2024"],
      confidence: 0.93,
    },
    visualSeed: { background: "#e8ecf4", primary: "#2563eb", secondary: "#dbeafe", shape: "card" },
    created_at: "2026-06-09T19:00:00Z",
  },
  {
    id: "demo-found-cuc-02",
    type: "found",
    title: "蓝色校园卡",
    category: "证件",
    color: "蓝色",
    location: "中国传媒大学图书馆",
    event_time: "2026-06-09T18:30",
    contact: "图书馆管理员",
    description: "在三楼自习区桌上捡到蓝色校园卡，有透明卡套和蓝色挂绳。已交至图书馆一楼服务台。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "图书馆一楼服务台",
    owner_id: "",
    image_data: "/images/卡.png",
    image_feature: null,
    semantic: {
      object_name: "蓝色校园卡",
      category: "证件",
      colors: ["蓝色"],
      brand_guess: "未知",
      visible_text: ["中国传媒大学"],
      features: ["透明卡套", "蓝色挂绳"],
      confidence: 0.91,
    },
    visualSeed: { background: "#e8ecf4", primary: "#2563eb", secondary: "#dbeafe", shape: "card" },
    created_at: "2026-06-09T19:30:00Z",
  },
  {
    id: "demo-lost-cuc-03",
    type: "lost",
    title: "黑色双肩包（内有笔记本电脑）",
    category: "箱包",
    color: "黑色",
    location: "中国传媒大学48教",
    event_time: "2026-06-10T10:00",
    contact: "微信: cuc_student_03",
    description: "黑色尼龙双肩包，侧面有红色条纹，内装MacBook Air和充电器。下课后忘记带走，可能落在48教302教室后排。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "48教302教室后排座位",
    owner_id: "",
    image_data: "/images/包.png",
    image_feature: null,
    semantic: {
      object_name: "黑色双肩包",
      category: "箱包",
      colors: ["黑色", "红色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["尼龙材质", "红色条纹", "MacBook Air"],
      confidence: 0.87,
    },
    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-10T11:00:00Z",
  },
  {
    id: "demo-found-cuc-03",
    type: "found",
    title: "黑色双肩包",
    category: "箱包",
    color: "黑色",
    location: "中国传媒大学48教",
    event_time: "2026-06-10T10:30",
    contact: "微信: cuc_finder_02",
    description: "在48教302教室后排捡到黑色双肩包，有红色条纹，内有笔记本电脑。已交至教学楼值班室。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "48教值班室",
    owner_id: "",
    image_data: "/images/包.png",
    image_feature: null,
    semantic: {
      object_name: "黑色双肩包",
      category: "箱包",
      colors: ["黑色", "红色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["尼龙材质", "红色条纹", "笔记本电脑"],
      confidence: 0.85,
    },
    visualSeed: { background: "#f5f5f0", primary: "#525252", secondary: "#d4d4d4", shape: "bag" },
    created_at: "2026-06-10T11:30:00Z",
  },
  {
    id: "demo-lost-cuc-04",
    type: "lost",
    title: "银色保温杯（膳魔师）",
    category: "生活用品",
    color: "银色",
    location: "中国传媒大学南操场",
    event_time: "2026-06-08T16:00",
    contact: "微信: cuc_student_04",
    description: "银色膳魔师保温杯，500ml，杯身贴有卡通贴纸。下午体育课后放在操场看台忘记拿。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "南操场东侧看台",
    owner_id: "",
    image_data: "/images/杯.png",
    image_feature: null,
    semantic: {
      object_name: "银色保温杯",
      category: "生活用品",
      colors: ["银色"],
      brand_guess: "膳魔师",
      visible_text: [],
      features: ["500ml", "卡通贴纸"],
      confidence: 0.84,
    },
    visualSeed: { background: "#f0f9ff", primary: "#0891b2", secondary: "#a5f3fc", shape: "cup" },
    created_at: "2026-06-08T17:00:00Z",
  },
  {
    id: "demo-found-cuc-04",
    type: "found",
    title: "银色保温杯",
    category: "生活用品",
    color: "银色",
    location: "中国传媒大学南操场",
    event_time: "2026-06-08T16:20",
    contact: "微信: cuc_finder_03",
    description: "在南操场看台捡到银色保温杯，有卡通贴纸。已代为保管，请联系取回。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "南操场东侧看台",
    owner_id: "",
    image_data: "/images/杯.png",
    image_feature: null,
    semantic: {
      object_name: "银色保温杯",
      category: "生活用品",
      colors: ["银色"],
      brand_guess: "膳魔师",
      visible_text: [],
      features: ["500ml", "卡通贴纸"],
      confidence: 0.82,
    },
    visualSeed: { background: "#f0f9ff", primary: "#0891b2", secondary: "#a5f3fc", shape: "cup" },
    created_at: "2026-06-08T17:30:00Z",
  },
  {
    id: "demo-lost-cuc-05",
    type: "lost",
    title: "粉色毛绒玩偶（小兔子）",
    category: "生活用品",
    color: "粉色",
    location: "中国传媒大学中蓝公寓",
    event_time: "2026-06-09T14:00",
    contact: "微信: cuc_student_05",
    description: "粉色小兔子毛绒玩偶，高约30cm，左耳有一个小蝴蝶结。可能在中蓝公寓B区楼下晾晒区遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "中蓝公寓B区楼下晾晒区",
    owner_id: "",
    image_data: "/images/兔子.png",
    image_feature: null,
    semantic: {
      object_name: "粉色毛绒玩偶",
      category: "生活用品",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["小兔子", "30cm", "左耳蝴蝶结"],
      confidence: 0.8,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "cup" },
    created_at: "2026-06-09T15:00:00Z",
  },
  {
    id: "demo-found-cuc-05",
    type: "found",
    title: "粉色小兔子玩偶",
    category: "生活用品",
    color: "粉色",
    location: "中国传媒大学中蓝公寓",
    event_time: "2026-06-09T14:30",
    contact: "微信: cuc_finder_04",
    description: "在中蓝公寓B区楼下捡到粉色小兔子玩偶，左耳有蝴蝶结。已代为保管。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "中蓝公寓B区楼下",
    owner_id: "",
    image_data: "/images/兔子.png",
    image_feature: null,
    semantic: {
      object_name: "粉色小兔子玩偶",
      category: "生活用品",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["小兔子", "左耳蝴蝶结"],
      confidence: 0.78,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "cup" },
    created_at: "2026-06-09T15:30:00Z",
  },
  {
    id: "demo-lost-cuc-06",
    type: "lost",
    title: "黑色机械键盘（Keychron K2）",
    category: "电子设备",
    color: "黑色",
    location: "中国传媒大学动画学院",
    event_time: "2026-06-10T09:00",
    contact: "微信: cuc_student_06",
    description: "黑色Keychron K2机械键盘，红轴，键帽有轻微打油。可能落在动画学院机房A03工位。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "动画学院机房A03工位",
    owner_id: "",
    image_data: "/images/键盘.png",
    image_feature: null,
    semantic: {
      object_name: "机械键盘",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "Keychron",
      visible_text: [],
      features: ["K2", "红轴", "键帽打油"],
      confidence: 0.86,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "card" },
    created_at: "2026-06-10T10:00:00Z",
  },
  {
    id: "demo-found-cuc-06",
    type: "found",
    title: "黑色机械键盘",
    category: "电子设备",
    color: "黑色",
    location: "中国传媒大学动画学院",
    event_time: "2026-06-10T09:30",
    contact: "微信: cuc_finder_05",
    description: "在动画学院机房A03工位捡到黑色机械键盘，红轴。已交至学院值班室。",
    status: "待认领",
    item_status: "institution",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "动画学院值班室",
    owner_id: "",
    image_data: "/images/键盘.png",
    image_feature: null,
    semantic: {
      object_name: "黑色机械键盘",
      category: "电子设备",
      colors: ["黑色"],
      brand_guess: "Keychron",
      visible_text: [],
      features: ["红轴"],
      confidence: 0.84,
    },
    visualSeed: { background: "#f0f0f5", primary: "#3a3a44", secondary: "#e8e8ed", shape: "card" },
    created_at: "2026-06-10T10:30:00Z",
  },
  {
    id: "demo-lost-cuc-07",
    type: "lost",
    title: "银色钥匙串（宿舍+柜子钥匙）",
    category: "钥匙",
    color: "银色",
    location: "中国传媒大学中蓝公寓",
    event_time: "2026-06-11T08:00",
    contact: "微信: cuc_student_07",
    description: "三把银色钥匙，配一个绿色小恐龙挂件。包括宿舍门钥匙和柜子钥匙。可能在中蓝公寓B区门口遗失。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "中蓝公寓B区门口",
    owner_id: "",
    image_data: "/images/钥匙.png",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色恐龙挂件"],
      confidence: 0.85,
    },
    visualSeed: { background: "#faf5f0", primary: "#b45309", secondary: "#fcd34d", shape: "key" },
    created_at: "2026-06-11T09:00:00Z",
  },
  {
    id: "demo-found-cuc-07",
    type: "found",
    title: "银色钥匙串",
    category: "钥匙",
    color: "银色",
    location: "中国传媒大学中蓝公寓",
    event_time: "2026-06-11T08:30",
    contact: "微信: cuc_finder_07",
    description: "在中蓝公寓B区门口捡到三把银色钥匙，有绿色恐龙挂件。已代为保管，请联系认领。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "中蓝公寓B区门口",
    owner_id: "",
    image_data: "/images/钥匙.png",
    image_feature: null,
    semantic: {
      object_name: "银色钥匙串",
      category: "钥匙",
      colors: ["银色", "绿色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["三把钥匙", "绿色恐龙挂件"],
      confidence: 0.83,
    },
    visualSeed: { background: "#faf5f0", primary: "#b45309", secondary: "#fcd34d", shape: "key" },
    created_at: "2026-06-11T09:30:00Z",
  },
  {
    id: "demo-lost-cuc-08",
    type: "lost",
    title: "粉色智能运动手环",
    category: "电子设备",
    color: "粉色",
    location: "中国传媒大学南操场",
    event_time: "2026-06-11T17:00",
    contact: "微信: cuc_student_08",
    description: "粉色智能运动手环，表带为浅粉色硅胶材质。下午跑步后放在操场看台忘记拿。",
    status: "待找回",
    item_status: "unknown",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "南操场西侧看台",
    owner_id: "",
    image_data: "/images/手环.png",
    image_feature: null,
    semantic: {
      object_name: "智能运动手环",
      category: "电子设备",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["粉色硅胶表带", "运动手环"],
      confidence: 0.82,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "card" },
    created_at: "2026-06-11T18:00:00Z",
  },
  {
    id: "demo-found-cuc-08",
    type: "found",
    title: "粉色运动手环",
    category: "电子设备",
    color: "粉色",
    location: "中国传媒大学南操场",
    event_time: "2026-06-11T17:30",
    contact: "微信: cuc_finder_08",
    description: "在南操场西侧看台捡到粉色运动手环，硅胶表带。已代为保管，请联系取回。",
    status: "待认领",
    item_status: "custody",
    city: "北京市",
    district: "朝阳区",
    street: "中国传媒大学",
    detail_location: "南操场西侧看台",
    owner_id: "",
    image_data: "/images/手环.png",
    image_feature: null,
    semantic: {
      object_name: "粉色运动手环",
      category: "电子设备",
      colors: ["粉色"],
      brand_guess: "未知",
      visible_text: [],
      features: ["粉色硅胶表带"],
      confidence: 0.8,
    },
    visualSeed: { background: "#fdf2f8", primary: "#db2777", secondary: "#fbcfe8", shape: "card" },
    created_at: "2026-06-11T18:30:00Z",
  },
];

// 初始化时将种子数据写入内存（仅当内存为空时）
function initSeedRecords() {
  if (memoryRecords.size === 0) {
    SEED_RECORDS.forEach((record) => {
      memoryRecords.set(record.id, record);
    });
  }
}

// Debug用：强制重置内存为纯净种子数据（解决历史残留乱码问题）
function resetSeedRecords() {
  memoryRecords.clear();
  SEED_RECORDS.forEach((record) => {
    memoryRecords.set(record.id, record);
  });
}

const handler = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const action = url.searchParams.get("action") || "";

    // 限流：写操作每用户每分钟最多20次
    const current = getCurrentUser(req);
    const rateKey = current ? `records:user:${current.sub}` : `records:ip:${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown"}`;
    const writeActions = ["claim-request", "review-claim", "submit-review", "report"];
    const isWrite = writeActions.includes(action) || req.method === "POST" || req.method === "DELETE" || req.method === "PATCH";
    if (isWrite) {
      const limit = checkRateLimit(rateKey, 60000, 20);
      if (!limit.ok) {
        sendJson(res, 429, { error: "请求过于频繁，请稍后再试", retryAfter: limit.retryAfter });
        return;
      }
    }

    if (action === "diag") return await handleDiag(req, res);
    if (action === "sync-status") return await handleSyncStatus(req, res);
    if (action === "claim-request") return await handleClaimRequest(req, res);
    if (action === "review-claim") return await handleReviewClaim(req, res);
    if (action === "mark-returned") return await handleMarkReturned(req, res);
    if (action === "confirm-received") return await handleConfirmReceived(req, res);
    if (action === "get-resolved") return await handleGetResolved(req, res);
    if (action === "submit-review") return await handleSubmitReview(req, res);
    if (action === "report") return await handleReport(req, res);
    if (req.method === "GET") return await handleList(req, res);
    if (req.method === "POST") return await handleCreate(req, res);
    if (req.method === "DELETE") return await handleDelete(req, res);
    if (req.method === "PATCH") return await handleUpdate(req, res);
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: "Records API failed", detail: safeErrorText(error.message) });
  }
};

module.exports = handler;
module.exports.memoryRecords = memoryRecords;

async function handleList(req, res) {
  const current = getCurrentUser(req);
  const config = getSupabaseConfig();

  if (!config) {
    sendJson(res, 503, { error: "数据库服务未配置，请联系管理员" });
    return;
  }

  try {
    // 自动同步示例种子数据到数据库（upsert 方式，幂等）
    const syncResult = await syncSeedRecordsToSupabase(config);
    console.log(`[LIST] Sync result: ${JSON.stringify(syncResult)}`);

    const response = await supabaseFetch(config, `/rest/v1/${TABLE}?select=*&order=created_at.desc`, { method: "GET" });
    const text = await response.text();
    if (!response.ok) {
      console.log(`[LIST] Supabase query failed: ${response.status} ${text.substring(0, 200)}`);
      sendJson(res, 503, { error: "数据库服务暂时不可用，请稍后再试" });
      return;
    }
    const rows = JSON.parse(text || "[]");
    console.log(`[LIST] Fetched ${rows.length} rows from Supabase`);
    const supabaseRecords = rows.map((row) => fromSupabaseRow(row, current)).filter(Boolean);
    console.log(`[LIST] Returning ${supabaseRecords.length} records`);
    sendJson(res, 200, { records: supabaseRecords });
  } catch (error) {
    console.log(`[LIST] Error: ${error.message}`);
    sendJson(res, 503, { error: "数据库服务异常，请稍后再试" });
  }
}

// 检查同步状态（调试用）
async function handleSyncStatus(req, res) {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 503, { error: "数据库未配置" });
    return;
  }
  try {
    // 查询数据库中 demo- 前缀记录数（用 eq. 精确查询第一条）
    const demoResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.demo-lost-01&select=id`, { method: "GET" });
    const demoText = await demoResp.text();
    const demoRows = JSON.parse(demoText || "[]");
    // 查询总记录数
    const allResp = await supabaseFetch(config, `/rest/v1/${TABLE}?select=id`, { method: "GET" });
    const allText = await allResp.text();
    const allRows = JSON.parse(allText || "[]");
    sendJson(res, 200, {
      seedCount: SEED_RECORDS.length,
      demoInDb: demoRows.length,
      totalInDb: allRows.length,
      demoIds: demoRows.map((r) => r.id).slice(0, 5),
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

// 将示例种子数据同步到 Supabase（仅在数据库为空时调用）
async function syncSeedRecordsToSupabase(config) {
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  try {
    for (const record of SEED_RECORDS) {
      const row = {
        id: record.id,
        type: record.type,
        title: record.title,
        category: record.category,
        color: record.color,
        location: record.location,
        event_time: record.event_time,
        contact: record.contact,
        description: record.description,
        status: record.status,
        item_status: record.item_status || "unknown",
        custody_point_id: record.custody_point_id || "",
        pickup_code: record.pickup_code || "",
        owner_id: record.owner_id || "",
        image_data: record.image_data || "",
        image_feature: record.image_feature,
        semantic: record.semantic,
        created_at: record.created_at,
        city: record.city || "北京市",
        district: record.district || "",
        street: record.street || "",
        detail_location: record.detail_location || "",
        claim_question: record.claim_question || "",
      };
      // visual_seed 列可能不存在于数据库中，仅在存在时添加
      if (record.visualSeed) {
        row.visual_seed = record.visualSeed;
      }
      // 先查询是否已存在
      const checkUrl = `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(record.id)}&select=id&limit=1`;
      const checkResp = await supabaseFetch(config, checkUrl, { method: "GET" });
      if (!checkResp.ok) {
        const checkErr = await checkResp.text().catch(() => "");
        failCount++;
        errors.push({ id: record.id, step: "check", status: checkResp.status, error: checkErr.substring(0, 200) });
        continue;
      }
      const existing = await checkResp.json();
      if (existing.length > 0) {
        successCount++; // 已存在，算成功
        continue;
      }
      // 不存在则插入
      const postResp = await supabaseFetch(config, `/rest/v1/${TABLE}`, {
        method: "POST",
        headers: {
          Prefer: "return=representation",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row),
      });
      if (postResp.ok) {
        successCount++;
      } else {
        // 读取错误信息
        const errText = await postResp.text().catch(() => "");
        // 如果是主键冲突（23505）算成功
        if (errText.includes("23505") || errText.includes("unique constraint")) {
          successCount++;
        } else {
          failCount++;
          errors.push({ id: record.id, step: "insert", status: postResp.status, error: errText.substring(0, 200) });
        }
      }
    }
  } catch (error) {
    errors.push({ id: "global", error: error.message });
  }
  // 输出同步日志到控制台（Vercel日志中可见）
  const firstError = errors.length > 0 ? errors[0] : null;
  console.log(`[SYNC] Seed sync complete: ${successCount}/${SEED_RECORDS.length} success, ${failCount} failed. First error: ${JSON.stringify(firstError)}`);
  return { successCount, failCount, errors };
}

async function handleCreate(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录后再发布" });
    return;
  }
  const body = await readJsonBody(req);
  const record = normalizeRecord(body.record || body, current);
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(res, 503, { error: "数据库服务未配置，请联系管理员" });
    return;
  }
  try {
    const response = await supabaseFetch(config, `/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(toSupabaseRow(record)),
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`[handleCreate] Supabase POST failed: ${response.status} ${text.substring(0, 500)}`);
      sendJson(res, 503, { error: "数据保存失败，请稍后再试", detail: text.substring(0, 200) });
      return;
    }
    const rows = JSON.parse(text || "[]");
    sendJson(res, 200, { record: fromSupabaseRow(rows[0], current) });
  } catch (error) {
    console.error("[handleCreate] Exception:", error.message);
    sendJson(res, 503, { error: "数据保存异常，请稍后再试", detail: error.message });
  }
}

async function handleDelete(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    sendJson(res, 400, { error: "Missing record id" });
    return;
  }
  const config = getSupabaseConfig();
  if (!config) {
    const row = memoryRecords.get(id);
    if (!row) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (row.owner_id && row.owner_id !== current.sub) { sendJson(res, 403, { error: "只能删除自己发布的记录" }); return; }
    memoryRecords.delete(id);
    sendJson(res, 200, { ok: true });
    return;
  }
  try {
    const checkResponse = await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=owner_id&limit=1`,
      { method: "GET" },
    );
    if (!checkResponse.ok) {
      const memRow = memoryRecords.get(id);
      if (memRow && memRow.owner_id && memRow.owner_id !== current.sub) {
        sendJson(res, 403, { error: "只能删除自己发布的记录" });
        return;
      }
      memoryRecords.delete(id);
      sendJson(res, 200, { ok: true, fallback: true });
      return;
    }
    const rows = await checkResponse.json();
    const owner = rows[0]?.owner_id;
    // owner_id 为空时禁止删除，避免无主记录被任意用户删除
    if (!owner) {
      sendJson(res, 403, { error: "该记录无所有者，无法删除" });
      return;
    }
    if (owner !== current.sub && current.role !== "admin") {
      sendJson(res, 403, { error: "只能删除自己发布的记录" });
      return;
    }
    await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    memoryRecords.delete(id);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    // 数据库异常时不再回退到内存删除，避免数据不一致
    sendJson(res, 500, { ok: false, error: "删除失败，请稍后重试" });
  }
}

async function handleUpdate(req, res) {
  const current = getCurrentUser(req);
  if (!current) {
    sendJson(res, 401, { error: "请先登录" });
    return;
  }
  const body = await readJsonBody(req);
  const id = String(body.id || "").trim();
  if (!id) {
    sendJson(res, 400, { error: "Missing record id" });
    return;
  }

  // 构建可编辑字段的 patch
  const patch = {};
  if (body.title !== undefined) patch.title = String(body.title).slice(0, 80);
  if (body.category !== undefined) patch.category = String(body.category).slice(0, 30);
  if (body.color !== undefined) patch.color = String(body.color).slice(0, 30);
  if (body.location !== undefined) patch.location = String(body.location).slice(0, 60);
  if (body.time !== undefined) patch.event_time = String(body.time).slice(0, 40);
  if (body.contact !== undefined) patch.contact = String(body.contact).slice(0, 120);
  if (body.description !== undefined) patch.description = String(body.description).slice(0, 800);
  if (body.status !== undefined) patch.status = String(body.status).slice(0, 30);
  if (body.item_status !== undefined) patch.item_status = String(body.item_status).slice(0, 20);
  if (body.custody_point_id !== undefined) patch.custody_point_id = String(body.custody_point_id).slice(0, 40);
  if (body.pickup_code !== undefined) patch.pickup_code = String(body.pickup_code).slice(0, 20);
  if (body.image_data !== undefined) patch.image_data = String(body.image_data);
  if (body.image_feature !== undefined && typeof body.image_feature === "object" && body.image_feature !== null) patch.image_feature = body.image_feature;
  if (body.semantic !== undefined && typeof body.semantic === "object" && body.semantic !== null) patch.semantic = body.semantic;
  if (body.city !== undefined) patch.city = String(body.city).slice(0, 20);
  if (body.district !== undefined) patch.district = String(body.district).slice(0, 20);
  if (body.street !== undefined) patch.street = String(body.street).slice(0, 40);
  if (body.detail_location !== undefined) patch.detail_location = String(body.detail_location).slice(0, 60);
  if (body.claim_question !== undefined) patch.claim_question = String(body.claim_question).slice(0, 200);

  if (!Object.keys(patch).length) {
    sendJson(res, 400, { error: "No fields to update" });
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    const row = memoryRecords.get(id);
    if (!row) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (row.owner_id && row.owner_id !== current.sub && current.role !== "admin") { sendJson(res, 403, { error: "只能更新自己发布的记录" }); return; }
    Object.assign(row, patch);
    memoryRecords.set(id, row);
    sendJson(res, 200, { ok: true, record: fromMemoryRow(row, current) });
    return;
  }
  try {
    const checkResponse = await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=owner_id&limit=1`,
      { method: "GET" },
    );
    if (checkResponse.ok) {
      const rows = await checkResponse.json();
      const owner = rows[0]?.owner_id;
      // owner_id 为空时禁止更新，避免无主记录被任意用户篡改
      if (!owner) {
        sendJson(res, 403, { error: "该记录无所有者，无法更新" });
        return;
      }
      if (owner !== current.sub && current.role !== "admin") {
        sendJson(res, 403, { error: "只能更新自己发布的记录" });
        return;
      }
    } else {
      // 数据库查询失败时拒绝更新，避免权限校验被绕过
      sendJson(res, 500, { error: "校验记录失败，请稍后重试" });
      return;
    }
    await supabaseFetch(
      config,
      `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
    );
    const memRow = memoryRecords.get(id);
    if (memRow) { Object.assign(memRow, patch); memoryRecords.set(id, memRow); }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    // 数据库异常时不再假装成功，避免数据不一致
    sendJson(res, 500, { ok: false, error: "更新失败，请稍后重试" });
  }
}

function normalizeRecord(record, currentUser) {
  const now = new Date().toISOString();
  return {
    id: String(record.id || `record-${Date.now()}`),
    type: record.type === "found" ? "found" : "lost",
    title: String(record.title || "物品信息待完善").slice(0, 80),
    category: String(record.category || "其他").slice(0, 30),
    color: String(record.color || "未知").slice(0, 30),
    location: String(record.location || "未知地点").slice(0, 60),
    time: String(record.time || "").slice(0, 40),
    contact: String(record.contact || "").slice(0, 120),
    description: String(record.description || "").slice(0, 800),
    status: String(record.status || (record.type === "found" ? "待认领" : "待找回")).slice(0, 30),
    item_status: String(record.item_status || "unknown").slice(0, 20),
    custody_point_id: String(record.custody_point_id || "").slice(0, 40),
    pickup_code: String(record.pickup_code || "").slice(0, 20),
    owner_id: currentUser?.sub || record.owner_id || "",
    imageData: String(record.imageData || ""),
    imageFeature: record.imageFeature || null,
    semantic: record.semantic || null,
    createdAt: String(record.createdAt || now),
    city: String(record.city || "北京市").slice(0, 20),
    district: String(record.district || "").slice(0, 20),
    street: String(record.street || "").slice(0, 40),
    detail_location: String(record.detail_location || "").slice(0, 60),
    claim_question: String(record.claim_question || "").slice(0, 200),
    visualSeed: record.visualSeed || null,
  };
}

function toSupabaseRow(record) {
  const row = {
    id: record.id,
    type: record.type,
    title: record.title,
    category: record.category,
    color: record.color,
    location: record.location,
    event_time: record.time,
    contact: record.contact,
    description: record.description,
    status: record.status,
    item_status: record.item_status,
    custody_point_id: record.custody_point_id,
    pickup_code: record.pickup_code,
    owner_id: record.owner_id,
    image_data: record.imageData,
    image_feature: record.imageFeature,
    semantic: record.semantic,
    created_at: record.createdAt,
    city: record.city,
    district: record.district,
    street: record.street,
    detail_location: record.detail_location,
    claim_question: record.claim_question,
  };
  // visual_seed 列可能不存在于数据库中，仅在列存在时添加
  if (record.visualSeed) {
    row.visual_seed = record.visualSeed;
  }
  return row;
}

function fromSupabaseRow(row, currentUser) {
  if (!row) return null;
  const isOwner = currentUser?.sub && row.owner_id === currentUser.sub;
  const isVerified = currentUser?.verified;
  // 统一逻辑：未登录且未认证时，所有数据（含示例数据）均模糊化处理
  const shouldFuzzify = !isOwner && !isVerified;

  const record = {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category,
    color: row.color,
    location: shouldFuzzify ? fuzzifyLocation(row.location) : row.location,
    time: shouldFuzzify ? fuzzifyTime(row.event_time) : row.event_time,
    // 联系方式：未认证使用特殊标记，前端据此渲染"查看联系方式"按钮
    contact: shouldFuzzify ? "__FUZZY_CONTACT__" : row.contact,
    description: shouldFuzzify ? fuzzifyDescription(row.description) : row.description,
    status: row.status,
    item_status: row.item_status || "unknown",
    custody_point_id: row.custody_point_id || "",
    pickup_code: isOwner ? (row.pickup_code || "") : "",
    owner_id: isOwner ? row.owner_id : "",
    imageData: row.image_data || "",
    imageFeature: row.image_feature || null,
    semantic: row.semantic || null,
    visualSeed: row.visual_seed || row.visualSeed || null,
    createdAt: row.created_at,
    is_fuzzy: shouldFuzzify,
    city: row.city || "北京市",
    district: row.district || "",
    street: row.street || "",
    detail_location: row.detail_location || "",
    claim_question: row.claim_question || "",
    is_claimed: !!row.claimed_by,
    is_claimed_by_me: !!(currentUser?.sub && row.claimed_by === currentUser.sub),
  };
  return record;
}

function toMemoryRow(record) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    category: record.category,
    color: record.color,
    location: record.location,
    event_time: record.time,
    contact: record.contact,
    description: record.description,
    status: record.status,
    item_status: record.item_status,
    custody_point_id: record.custody_point_id,
    pickup_code: record.pickup_code,
    owner_id: record.owner_id,
    image_data: record.imageData,
    image_feature: record.imageFeature,
    semantic: record.semantic,
    visual_seed: record.visualSeed || null,
    created_at: record.createdAt,
    city: record.city || "北京市",
    district: record.district || "",
    street: record.street || "",
    detail_location: record.detail_location || "",
    claim_question: record.claim_question || "",
  };
}

function fromMemoryRow(row, currentUser) {
  if (!row) return null;
  return fromSupabaseRow(row, currentUser);
}

// 诊断接口：检查 Supabase 连接状态
async function handleDiag(req, res) {
  const config = getSupabaseConfig();
  const result = {
    configExists: !!config,
    urlPrefix: config ? config.url.substring(0, 30) + '...' : null,
    keyExists: config ? !!config.key : false,
    keyLength: config ? config.key.length : 0,
    table: TABLE,
    testResult: null,
    error: null,
  };

  if (config) {
    try {
      const response = await supabaseFetch(config, `/rest/v1/${TABLE}?select=*&limit=1`, { method: 'GET' });
      result.testStatus = response.status;
      const text = await response.text();
      result.testBody = text.substring(0, 200);
      if (response.ok) {
        result.testResult = 'success';
      } else if (response.status === 404) {
        result.testResult = 'table_not_found';
      } else if (response.status === 401) {
        result.testResult = 'auth_failed';
      } else {
        result.testResult = 'error';
      }
    } catch (error) {
      result.testResult = 'exception';
      result.error = error.message;
    }
  }

  sendJson(res, 200, result);
}

// 模糊化函数
function fuzzifyLocation(location) {
  if (!location || location === "未知地点") return location;
  // 保留到"XX路附近"或"XX区"
  const roadMatch = location.match(/^(.+?[路道街巷])/);
  if (roadMatch) return `${roadMatch[1]}附近`;
  const districtMatch = location.match(/^(.+?[区县])/);
  if (districtMatch) return `${districtMatch[1]}范围内`;
  return `${location.slice(0, Math.max(2, location.length - 2))}附近`;
}

function fuzzifyTime(timeStr) {
  if (!timeStr) return "未知时间";
  // 如果是自然语言描述（如"今天早晨"、"5月1日下午"），直接模糊化返回
  const naturalLangPattern = /^(今天|昨天|前天|上周|本周|几天前|早晨|上午|下午|晚上|凌晨|刚刚|不久前)/;
  const relativePattern = /^(\d+天前|\d+周前|\d+小时前|\d+分钟前)/;
  const datePattern = /^(\d{1,2})月(\d{1,2})日/;
  if (naturalLangPattern.test(timeStr) || relativePattern.test(timeStr)) {
    // 提取时间段并模糊化
    const periodMatch = timeStr.match(/(早晨|上午|下午|晚上|凌晨)/);
    const period = periodMatch ? periodMatch[1] : "";
    const dayMatch = timeStr.match(/^(今天|昨天|前天|\d+天前)/);
    const day = dayMatch ? dayMatch[1] : "";
    if (day && period) return `${day}${period}`;
    if (day) return `${day}`;
    if (period) return `某${period}`;
    return timeStr;
  }
  // 尝试解析为标准日期格式
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr; // 无法解析则原样返回
    const hour = date.getHours();
    const period = hour < 6 ? "凌晨" : hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上";
    const dayDiff = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (dayDiff === 0) return `今天${period}`;
    if (dayDiff === 1) return `昨天${period}`;
    if (dayDiff < 7) return `${dayDiff}天前${period}`;
    return `${date.getMonth() + 1}月${date.getDate()}日${period}`;
  } catch (error) {
    return timeStr || "未知时间";
  }
}

function fuzzifyDescription(description) {
  if (!description) return "";
  // 保留前 30 字 + "..."
  const trimmed = description.trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...（实名认证后查看完整描述）` : trimmed;
}

// ============== 认领问答系统 ==============
async function handleClaimRequest(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordIdVal = validateString(body.record_id, { required: true, name: "记录ID" });
  if (!recordIdVal.ok) { sendJson(res, 400, { error: recordIdVal.error }); return; }
  const answerVal = validateString(body.answer, { required: true, minLength: 1, maxLength: 500, name: "回答" });
  if (!answerVal.ok) { sendJson(res, 400, { error: answerVal.error }); return; }
  const recordId = recordIdVal.value;
  const answer = answerVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录信息，校验是否为自己发布的物品
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,title,type,status,claim_question&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const targetRecord = recRows[0];
    const ownerId = targetRecord?.owner_id;
    const title = targetRecord?.title || "物品";
    if (!targetRecord) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (targetRecord.type !== "found") { sendJson(res, 400, { error: "仅招领信息可申请认领" }); return; }
    if (targetRecord.status !== "待认领") { sendJson(res, 400, { error: "该物品当前不可认领" }); return; }
    if (ownerId === current.sub) { sendJson(res, 403, { error: "不能认领自己发布的物品" }); return; }
    const hasQuestion = !!(targetRecord.claim_question || "").trim();
    if (!answer.trim()) { sendJson(res, 400, { error: hasQuestion ? "请回答认领问题" : "请填写物品特征说明" }); return; }

    // 检查是否已有 pending 申请，避免重复申请
    const existClaimResp = await supabaseFetch(config, `/rest/v1/shiyun_claim_requests?record_id=eq.${encodeURIComponent(recordId)}&claimant_id=eq.${encodeURIComponent(current.sub)}&status=eq.pending&limit=1`, { method: "GET" });
    const existClaimRows = await existClaimResp.json();
    if (existClaimRows.length > 0) { sendJson(res, 400, { error: "你已提交过认领申请，请等待审核" }); return; }

    // 创建认领申请
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabaseFetch(config, `/rest/v1/shiyun_claim_requests`, {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: claimId, record_id: recordId, claimant_id: current.sub, answer, status: "pending" }),
    });
    // 发送通知给发布者（body中包含claim_id供前端审核使用）
    if (ownerId) {
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: generateUuid(), user_id: ownerId, type: "claim_request",
          title: "有人申请认领", body: `有人申请认领你的「${title}」，请查看并审核。claim_id:${claimId}`, related_record_id: recordId,
        }),
      });
    }
    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 500, { ok: false, error: "认领申请失败" }); }
}

async function handleReviewClaim(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const claimIdVal = validateString(body.claim_id, { required: true, name: "认领申请ID" });
  if (!claimIdVal.ok) { sendJson(res, 400, { error: claimIdVal.error }); return; }
  const statusVal = validateString(body.status, { required: true, enum: ["approved", "rejected"], name: "审核状态" });
  if (!statusVal.ok) { sendJson(res, 400, { error: statusVal.error }); return; }
  const claimId = claimIdVal.value;
  const status = statusVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 先获取认领申请详情（审核前需验证权限）
    const claimResp = await supabaseFetch(config, `/rest/v1/shiyun_claim_requests?id=eq.${encodeURIComponent(claimId)}&select=*&limit=1`, { method: "GET" });
    const claimRows = await claimResp.json();
    const claim = claimRows[0];
    if (!claim) { sendJson(res, 404, { error: "认领申请不存在" }); return; }
    // 已审核过的申请不可重复审核
    if (claim.status !== "pending") { sendJson(res, 400, { error: "该申请已审核过" }); return; }

    // 获取记录信息并校验权限：只有记录发布者才能审核
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(claim.record_id)}&select=owner_id,contact&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];
    if (!record) { sendJson(res, 404, { error: "关联记录不存在" }); return; }
    if (record.owner_id !== current.sub) { sendJson(res, 403, { error: "只有记录发布者才能审核认领申请" }); return; }

    // 更新认领申请状态
    await supabaseFetch(config, `/rest/v1/shiyun_claim_requests?id=eq.${encodeURIComponent(claimId)}`, {
      method: "PATCH", body: JSON.stringify({ status }),
    });

    if (status === "approved") {
      // 向申请者发送通知（含联系方式）
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: generateUuid(), user_id: claim.claimant_id, type: "claim_approved",
          title: "认领申请已通过", body: `你的认领申请已通过！联系方式：${record.contact || "请查看详情"}`, related_record_id: claim.record_id,
        }),
      });
      // 更新记录状态
      await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(claim.record_id)}`, {
        method: "PATCH", body: JSON.stringify({ claimed_by: claim.claimant_id, claimed_at: new Date().toISOString(), status: "已认领" }),
      });
    } else {
      // 向申请者发送拒绝通知
      await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
        method: "POST",
        body: JSON.stringify({
          id: generateUuid(), user_id: claim.claimant_id, type: "claim_rejected",
          title: "认领申请被拒绝", body: `你的认领申请未被通过，请确认物品信息后再试。`, related_record_id: claim.record_id,
        }),
      });
    }
    sendJson(res, 200, { ok: true, status });
  } catch (error) { sendJson(res, 500, { ok: false, error: "审核操作失败" }); }
}

// ============== 找回确认：拾到者标记已归还 ==============
async function handleMarkReturned(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordIdVal = validateString(body.record_id, { required: true, name: "记录ID" });
  if (!recordIdVal.ok) { sendJson(res, 400, { error: recordIdVal.error }); return; }
  const recordId = recordIdVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,claimed_by,status,type,title&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];
    if (!record) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (record.type !== "found") { sendJson(res, 400, { error: "只有招领记录可以标记归还" }); return; }
    if (record.owner_id !== current.sub) { sendJson(res, 403, { error: "只有发布者可以标记归还" }); return; }
    if (record.status !== "已认领") { sendJson(res, 400, { error: "记录尚未被认领" }); return; }

    // 检查是否已存在 resolved 记录
    const existResp = await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?record_id=eq.${encodeURIComponent(recordId)}&limit=1`, { method: "GET" });
    const existRows = await existResp.json();
    if (existRows.length > 0) {
      // 已标记过归还则拒绝重复操作
      if (existRows[0].finder_confirmed) { sendJson(res, 400, { error: "已标记过归还，请等待失主确认" }); return; }
      // 更新 finder_confirmed
      await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?id=eq.${encodeURIComponent(existRows[0].id)}`, {
        method: "PATCH", body: JSON.stringify({ finder_confirmed: true, finder_confirmed_at: new Date().toISOString() }),
      });
    } else {
      // 创建 resolved_records
      const resolvedId = `resolved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await supabaseFetch(config, `/rest/v1/shiyun_resolved_records`, {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: resolvedId, record_id: recordId, finder_id: current.sub,
          owner_id: record.claimed_by, finder_confirmed: true,
          finder_confirmed_at: new Date().toISOString(),
        }),
      });
    }

    // 通知失主
    await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
      method: "POST",
      body: JSON.stringify({
        id: generateUuid(), user_id: record.claimed_by, type: "finder_confirmed",
        title: "拾到者已确认归还", body: `「${record.title}」的拾到者已确认归还，请确认是否已收到物品。`, related_record_id: recordId,
      }),
    });

    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 500, { ok: false, error: "标记归还失败" }); }
}

// ============== 找回确认：失主确认已收到 ==============
async function handleConfirmReceived(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordIdVal = validateString(body.record_id, { required: true, name: "记录ID" });
  if (!recordIdVal.ok) { sendJson(res, 400, { error: recordIdVal.error }); return; }
  const recordId = recordIdVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,claimed_by,status,type,title&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];
    if (!record) { sendJson(res, 404, { error: "记录不存在" }); return; }
    if (record.claimed_by !== current.sub) { sendJson(res, 403, { error: "只有认领者可以确认收到" }); return; }

    // 获取 resolved_records
    const resolvedResp = await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?record_id=eq.${encodeURIComponent(recordId)}&select=*&limit=1`, { method: "GET" });
    const resolvedRows = await resolvedResp.json();
    const resolved = resolvedRows[0];
    if (!resolved) { sendJson(res, 400, { error: "拾到者尚未标记归还" }); return; }
    if (!resolved.finder_confirmed) { sendJson(res, 400, { error: "拾到者尚未标记归还" }); return; }
    if (resolved.owner_confirmed) { sendJson(res, 400, { error: "已确认过收到" }); return; }

    // 更新 owner_confirmed
    await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?id=eq.${encodeURIComponent(resolved.id)}`, {
      method: "PATCH", body: JSON.stringify({ owner_confirmed: true, owner_confirmed_at: new Date().toISOString() }),
    });

    // 更新记录状态为"已找回"
    await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}`, {
      method: "PATCH", body: JSON.stringify({ status: "已找回" }),
    });

    // 发放积分（使用条件更新保证幂等，避免并发重复发放）
    if (!resolved.credit_awarded) {
      // 先用条件更新标记 credit_awarded=true，只有成功更新才发放积分
      const markResp = await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?id=eq.${encodeURIComponent(resolved.id)}&credit_awarded=eq.false`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ credit_awarded: true }),
      });
      let awarded = false;
      if (markResp.ok) {
        const markRows = await markResp.json();
        awarded = Array.isArray(markRows) && markRows.length > 0;
      }
      if (awarded) {
        // 给拾到者 +10
        await awardCredit(config, resolved.finder_id, 10, "归还物品奖励", recordId);
        // 给失主 +5
        await awardCredit(config, resolved.owner_id, 5, "找回物品奖励", recordId);
      }
    }

    // 通知双方
    await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
      method: "POST",
      body: JSON.stringify({
        id: generateUuid(), user_id: resolved.finder_id, type: "recovery_complete",
        title: "归还确认完成", body: `「${record.title}」的归还已确认完成，信用积分 +10 已发放。`, related_record_id: recordId,
      }),
    });
    await supabaseFetch(config, `/rest/v1/shiyun_notifications`, {
      method: "POST",
      body: JSON.stringify({
        id: generateUuid(), user_id: resolved.owner_id, type: "recovery_complete",
        title: "找回确认完成", body: `「${record.title}」的找回已确认完成，信用积分 +5 已发放。`, related_record_id: recordId,
      }),
    });

    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 500, { ok: false, error: "确认收到失败" }); }
}

// 辅助函数：发放积分
async function awardCredit(config, userId, delta, description, recordId) {
  // 创建信用日志（使用 UUID 避免高并发下时间戳冲突）
  await supabaseFetch(config, `/rest/v1/shiyun_credit_logs`, {
    method: "POST",
    body: JSON.stringify({
      id: generateUuid(), user_id: userId, action: description, delta, description,
    }),
  });
  // 更新用户积分
  const userResp = await supabaseFetch(config, `/rest/v1/shiyun_users?id=eq.${encodeURIComponent(userId)}&select=credit_score,exp,total_helped&limit=1`, { method: "GET" });
  const userRows = await userResp.json();
  const user = userRows[0];
  if (user) {
    const newCredit = (user.credit_score || 0) + delta;
    const newExp = (user.exp || 0) + delta;
    const newHelped = (user.total_helped || 0) + (delta > 0 ? 1 : 0);
    await supabaseFetch(config, `/rest/v1/shiyun_users?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH", body: JSON.stringify({ credit_score: newCredit, exp: newExp, total_helped: newHelped }),
    });
    // 推送积分变更通知，方便用户回看
    try {
      await pushNotification({
        userId,
        type: "credit_change",
        title: "信用积分变更",
        body: `因${description}，信用积分 ${delta > 0 ? "+" : ""}${delta}。`,
        relatedRecordId: recordId,
      });
    } catch (e) { /* 静默，避免影响主流程 */ }
  }
}

// ============== 查询找回状态 ==============
async function handleGetResolved(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const recordId = url.searchParams.get("record_id");
  if (!recordId) { sendJson(res, 400, { error: "缺少记录ID" }); return; }

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { resolved: null }); return; }

  try {
    const resp = await supabaseFetch(config, `/rest/v1/shiyun_resolved_records?record_id=eq.${encodeURIComponent(recordId)}&select=*&limit=1`, { method: "GET" });
    const rows = await resp.json();
    sendJson(res, 200, { resolved: rows[0] || null });
  } catch (error) { sendJson(res, 500, { error: "查询失败" }); }
}

// ============== 评价系统 ==============
async function handleSubmitReview(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordIdVal = validateString(body.record_id, { required: true, name: "记录ID" });
  if (!recordIdVal.ok) { sendJson(res, 400, { error: recordIdVal.error }); return; }
  const ratingVal = validateInt(body.rating, { required: true, min: 1, max: 5, name: "评分" });
  if (!ratingVal.ok) { sendJson(res, 400, { error: ratingVal.error }); return; }
  const commentVal = validateString(body.comment, { maxLength: 500, name: "评论" });
  if (!commentVal.ok) { sendJson(res, 400, { error: commentVal.error }); return; }
  const recordId = recordIdVal.value;
  const rating = ratingVal.value;
  const comment = commentVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 获取记录
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id,claimed_by,status&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    const record = recRows[0];
    if (!record) { sendJson(res, 404, { error: "记录不存在" }); return; }
    // 只有已找回的记录可以评价，避免未完成流程刷信用分
    if (record.status !== "已找回") { sendJson(res, 400, { error: "只有已找回的记录可以评价" }); return; }

    const isOwner = record.owner_id === current.sub;
    const isClaimant = record.claimed_by === current.sub;
    if (!isOwner && !isClaimant) { sendJson(res, 403, { error: "只能评价自己参与的交易" }); return; }

    const toUserId = isOwner ? record.claimed_by : record.owner_id;
    if (!toUserId) { sendJson(res, 400, { error: "对方用户不存在" }); return; }

    // 检查是否已评价
    const existResp = await supabaseFetch(config, `/rest/v1/shiyun_reviews?record_id=eq.${encodeURIComponent(recordId)}&from_user_id=eq.${encodeURIComponent(current.sub)}&limit=1`, { method: "GET" });
    const existRows = await existResp.json();
    if (existRows.length > 0) { sendJson(res, 400, { error: "已评价过该记录" }); return; }

    // 创建评价（使用 UUID 避免高并发下时间戳冲突）
    const reviewId = generateUuid();
    await supabaseFetch(config, `/rest/v1/shiyun_reviews`, {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: reviewId, record_id: recordId, from_user_id: current.sub, to_user_id: toUserId, rating, comment }),
    });

    // 更新信用分和经验（使用乐观锁防止并发覆盖）
    await updateUserWithLock(toUserId, (toUser) => {
      const currentCredit = typeof toUser.credit_score === "number" ? toUser.credit_score : 0;
      const currentExp = typeof toUser.exp === "number" ? toUser.exp : 0;
      let newCredit = currentCredit;
      let newExp = currentExp;
      if (rating >= 5) {
        newCredit = currentCredit + 10;
        newExp = currentExp + 30;
      } else if (rating <= 2) {
        newCredit = Math.max(0, currentCredit - 5);
      }
      const newLevel = Math.max(1, Math.floor(1 + Math.sqrt(newExp / 100)));
      const patch = { credit_score: newCredit };
      if (newExp !== currentExp) {
        patch.exp = newExp;
        patch.level = newLevel;
      }
      return patch;
    });

    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 500, { ok: false, error: "评价操作失败" }); }
}

// ============== 举报系统 ==============
async function handleReport(req, res) {
  const current = getCurrentUser(req);
  if (!current) { sendJson(res, 401, { error: "请先登录" }); return; }
  const body = await readJsonBody(req);
  const recordIdVal = validateString(body.record_id, { required: true, name: "记录ID" });
  if (!recordIdVal.ok) { sendJson(res, 400, { error: recordIdVal.error }); return; }
  const reasonVal = validateString(body.reason, { required: true, minLength: 5, maxLength: 500, name: "举报原因" });
  if (!reasonVal.ok) { sendJson(res, 400, { error: reasonVal.error }); return; }
  const recordId = recordIdVal.value;
  const reason = reasonVal.value;

  const config = getSupabaseConfig();
  if (!config) { sendJson(res, 200, { ok: true, fallback: true }); return; }

  try {
    // 防止重复举报：检查当前用户是否已举报过该记录
    const existResp = await supabaseFetch(config, `/rest/v1/shiyun_reports?record_id=eq.${encodeURIComponent(recordId)}&reporter_id=eq.${encodeURIComponent(current.sub)}&limit=1`, { method: "GET" });
    const existRows = await existResp.json();
    if (existRows.length > 0) { sendJson(res, 400, { error: "你已经举报过该记录" }); return; }

    // 获取记录发布者
    const recResp = await supabaseFetch(config, `/rest/v1/${TABLE}?id=eq.${encodeURIComponent(recordId)}&select=owner_id&limit=1`, { method: "GET" });
    const recRows = await recResp.json();
    if (!recRows[0]) { sendJson(res, 404, { error: "记录不存在" }); return; }
    const ownerId = recRows[0]?.owner_id;

    // 记录举报（使用 UUID 避免高并发下时间戳冲突）
    await supabaseFetch(config, `/rest/v1/shiyun_reports`, {
      method: "POST",
      body: JSON.stringify({ id: generateUuid(), record_id: recordId, reporter_id: current.sub, reason }),
    });

    if (ownerId) {
      // 扣除信用分（使用乐观锁防止并发覆盖，最低为0）
      await updateUserWithLock(ownerId, (owner) => {
        const currentCredit = typeof owner.credit_score === "number" ? owner.credit_score : 0;
        const newCredit = Math.max(0, currentCredit - 20);
        return { credit_score: newCredit };
      });
    }
    sendJson(res, 200, { ok: true });
  } catch (error) { sendJson(res, 500, { ok: false, error: "举报操作失败" }); }
}
