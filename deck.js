"use strict";

const PptxGenJS = require("pptxgenjs");
const path = require("path");
const {
  autoFontSize,
  calcTextBox,
  warnIfSlideHasOverlaps,
  warnIfSlideElementsOutOfBounds,
} = require("./pptxgenjs_helpers");

const pptx = new PptxGenJS();

// ==================== 全局主题设置 ====================
pptx.layout = "LAYOUT_WIDE"; // 16:9
pptx.author = "拾寻项目组";
pptx.title = "拾寻 · 城市拾遗网络";
pptx.subject = "城市级泛公共物联网络演示";

pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "F8F9FB" },
  objects: [
    {
      rect: { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "F8F9FB" } },
    },
    {
      text: {
        text: "拾寻 · 城市拾遗网络",
        options: {
          x: 0.4,
          y: 0.25,
          w: 4,
          h: 0.35,
          fontSize: 11,
          fontFace: "Microsoft YaHei",
          color: "8B929D",
        },
      },
    },
    {
      line: {
        x: 0.4,
        y: 6.85,
        w: 12.17,
        h: 0,
        line: { color: "E1E4E8", pt: 0.5 },
      },
    },
    {
      text: {
        text: "拾寻项目组 · 创新方案演示",
        options: {
          x: 0.4,
          y: 6.92,
          w: 4,
          h: 0.25,
          fontSize: 9,
          fontFace: "Microsoft YaHei",
          color: "A7ADB6",
        },
      },
    },
  ],
});

// 常用颜色与字体
const COLORS = {
  primary: "2563EB",
  primaryLight: "3B82F6",
  primaryDark: "1D4ED8",
  accentPurple: "7C3AED",
  accentCyan: "06B6D4",
  accentTeal: "14B8A6",
  accentOrange: "F59E0B",
  textMain: "1F2937",
  textSub: "6B7280",
  textLight: "9CA3AF",
  bgCard: "FFFFFF",
  bgLight: "F1F5F9",
  border: "E5E7EB",
  gradientStart: "2563EB",
  gradientEnd: "7C3AED",
};

const FONT = "Microsoft YaHei";
const FONT_EN = "Arial";

// 当前程序实际数据（可在生成前按需修改）
const SCENE_RECORDS = 40;
const SCENE_MATCHES = 20;

// ==================== 辅助函数 ====================
function addTitle(slide, title, subtitle = "") {
  const titleBox = autoFontSize(title, FONT, {
    x: 0.4,
    y: 0.75,
    w: 12.5,
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: COLORS.textMain,
    mode: "shrink",
    minFontSize: 24,
    maxFontSize: 36,
  });
  slide.addText(title, {
    ...titleBox,
    fontFace: FONT,
    color: COLORS.textMain,
    align: "left",
    valign: "mid",
  });

  let contentY = titleBox.y + titleBox.h + 0.35;

  if (subtitle) {
    const subBox = calcTextBox(14, {
      text: subtitle,
      w: 12.5,
      fontFace: FONT,
      color: COLORS.textSub,
    });
    const subY = titleBox.y + titleBox.h + 0.12;
    slide.addText(subtitle, {
      x: 0.4,
      y: subY,
      w: 12.5,
      h: subBox.h,
      fontSize: 14,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
    contentY = subY + subBox.h + 0.35;
  }

  return contentY;
}

function addCard(slide, opts) {
  const {
    x,
    y,
    w,
    h,
    title,
    body,
    iconText = "",
    titleSize = 16,
    bodySize = 12,
    fill = COLORS.bgCard,
    line = COLORS.border,
    titleColor = COLORS.textMain,
    bodyColor = COLORS.textSub,
    iconBg = COLORS.primary,
    iconColor = "FFFFFF",
  } = opts;

  // 卡片背景
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: line, pt: 0.5 },
    rectRadius: 0.08,
  });

  // 图标圆圈
  const iconR = 0.28;
  const iconX = x + 0.25;
  const iconY = y + 0.25;
  slide.addShape("ellipse", {
    x: iconX,
    y: iconY,
    w: iconR * 2,
    h: iconR * 2,
    fill: { color: iconBg },
  });
  const iconBox = autoFontSize(iconText, FONT_EN, {
    x: iconX,
    y: iconY,
    w: iconR * 2,
    h: iconR * 2,
    fontSize: 16,
    color: iconColor,
    mode: "shrink",
    minFontSize: 10,
  });
  slide.addText(iconText, {
    ...iconBox,
    fontFace: FONT_EN,
    color: iconColor,
    align: "center",
    valign: "mid",
  });

  // 标题
  const titleH = 0.35;
  slide.addText(title, {
    x: x + 0.2,
    y: iconY + iconR * 2 + 0.15,
    w: w - 0.4,
    h: titleH,
    fontSize: titleSize,
    fontFace: FONT,
    color: titleColor,
    bold: true,
    align: "left",
    valign: "mid",
  });

  // 正文
  if (body) {
    const bodyY = iconY + iconR * 2 + 0.15 + titleH + 0.08;
    const bodyH = Math.max(0.1, h - (bodyY - y) - 0.2);
    const bodyBox = autoFontSize(body, FONT, {
      x: x + 0.2,
      y: bodyY,
      w: w - 0.4,
      h: bodyH,
      fontSize: bodySize,
      color: bodyColor,
      mode: "shrink",
      minFontSize: 9,
    });
    slide.addText(body, {
      ...bodyBox,
      fontFace: FONT,
      color: bodyColor,
      align: "left",
      valign: "top",
    });
  }
}

function addNumberCard(slide, opts) {
  const { x, y, w, h, number, unit, label, desc, fill = "EEF2FF", numberColor = COLORS.primary } = opts;
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: "FFFFFF", pt: 0 },
    rectRadius: 0.08,
  });
  const numText = `${number}${unit || ""}`;
  const numY = y + 0.18;
  const numH = 0.62;
  const numBox = autoFontSize(numText, FONT_EN, {
    x: x + 0.2,
    y: numY,
    w: w - 0.4,
    h: numH,
    fontSize: 44,
    bold: true,
    color: numberColor,
    mode: "shrink",
    minFontSize: 24,
  });
  slide.addText(numText, {
    ...numBox,
    fontFace: FONT_EN,
    color: numberColor,
    bold: true,
    align: "left",
    valign: "mid",
  });
  const labelY = numY + numH + 0.08;
  const labelH = 0.3;
  slide.addText(label, {
    x: x + 0.2,
    y: labelY,
    w: w - 0.4,
    h: labelH,
    fontSize: 14,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "left",
    valign: "mid",
  });
  if (desc) {
    const descY = labelY + labelH + 0.06;
    const descH = Math.max(0.15, y + h - 0.12 - descY);
    slide.addText(desc, {
      x: x + 0.2,
      y: descY,
      w: w - 0.4,
      h: descH,
      fontSize: 11,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
  }
}

function addProcessStep(slide, opts) {
  const { x, y, w, h, step, title, desc, color = COLORS.primary } = opts;
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.bgCard },
    line: { color: COLORS.border, pt: 0.5 },
    rectRadius: 0.08,
  });
  // 顶部彩色条
  slide.addShape("rect", {
    x,
    y,
    w,
    h: 0.06,
    fill: { color: color },
  });
  const stepBox = autoFontSize(step, FONT_EN, {
    x: x + 0.2,
    y: y + 0.2,
    w: 0.6,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: color,
    mode: "shrink",
  });
  slide.addText(step, {
    ...stepBox,
    fontFace: FONT_EN,
    color: color,
    bold: true,
    align: "left",
    valign: "mid",
  });
  slide.addText(title, {
    x: x + 0.2,
    y: y + 0.65,
    w: w - 0.4,
    h: 0.4,
    fontSize: 16,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "left",
    valign: "mid",
  });
  if (desc) {
    slide.addText(desc, {
      x: x + 0.2,
      y: y + 1.1,
      w: w - 0.4,
      h: h - 1.3,
      fontSize: 12,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
  }
}

function addArrow(slide, x, y, w, color = COLORS.primary) {
  slide.addShape("rightArrow", {
    x,
    y,
    w,
    h: 0.15,
    fill: { color: color },
    line: { color: color, pt: 0 },
  });
}

function imgPath(rel) {
  return path.join(__dirname, rel);
}

function addSimpleTable(slide, rows, opts) {
  const { x, y, w, colW, headerFill = COLORS.primary, headerColor = "FFFFFF", fontSize = 11 } = opts;
  const data = rows.map((row, r) =>
    row.map((cell, c) => ({
      text: cell,
      options: {
        fontFace: FONT,
        fontSize,
        color: r === 0 ? headerColor : COLORS.textMain,
        bold: r === 0,
        fill: r === 0 ? headerFill : "FFFFFF",
        valign: "mid",
        align: c === 0 ? "left" : "left",
        margin: [0.08, 0.06],
      },
    }))
  );
  slide.addTable(data, {
    x,
    y,
    w,
    colW,
    border: { pt: 0.5, color: COLORS.border },
    autoPage: false,
    fontFace: FONT,
  });
}

// ==================== 第1页：封面 ====================
{
  const slide = pptx.addSlide();
  // 深蓝色背景
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { color: "0F172A" },
  });
  // 装饰：城市剪影（用简单矩形模拟）
  const buildings = [
    { x: 0.5, w: 0.35, h: 2.2 },
    { x: 1.0, w: 0.45, h: 3.0 },
    { x: 1.6, w: 0.3, h: 1.8 },
    { x: 2.0, w: 0.5, h: 2.6 },
    { x: 2.7, w: 0.4, h: 2.0 },
    { x: 3.3, w: 0.35, h: 2.8 },
    { x: 3.9, w: 0.5, h: 2.2 },
    { x: 4.6, w: 0.3, h: 1.9 },
    { x: 5.0, w: 0.4, h: 2.5 },
    { x: 5.6, w: 0.45, h: 2.1 },
    { x: 6.2, w: 0.35, h: 3.2 },
    { x: 6.8, w: 0.4, h: 2.4 },
    { x: 7.4, w: 0.3, h: 1.7 },
    { x: 7.9, w: 0.5, h: 2.9 },
    { x: 8.6, w: 0.35, h: 2.0 },
    { x: 9.1, w: 0.4, h: 2.6 },
    { x: 9.7, w: 0.45, h: 2.2 },
    { x: 10.4, w: 0.3, h: 1.8 },
    { x: 10.9, w: 0.5, h: 3.0 },
    { x: 11.6, w: 0.35, h: 2.3 },
    { x: 12.1, w: 0.4, h: 1.9 },
  ];
  // 将城市剪影整体压缩，避免与日期文字重叠并控制在幻灯片底部以内
  const SKYLINE_SCALE = 0.6;
  const SKYLINE_BASE = 7.5;
  buildings.forEach((b) => {
    const h = b.h * SKYLINE_SCALE;
    slide.addShape("rect", {
      x: b.x,
      y: SKYLINE_BASE - h,
      w: b.w,
      h,
      fill: { color: "1E293B" },
    });
  });

  // 主标题
  slide.addText("拾寻 · 城市拾遗网络", {
    x: 0.8,
    y: 2.3,
    w: 11.5,
    h: 1.0,
    fontSize: 48,
    fontFace: FONT,
    color: "FFFFFF",
    bold: true,
    align: "center",
    valign: "mid",
  });
  // 分隔线
  slide.addShape("rect", {
    x: 5.5,
    y: 3.45,
    w: 1.8,
    h: 0.04,
    fill: { color: COLORS.primaryLight },
  });
  // 副标题
  slide.addText("构建城市级泛公共物联网络，让每一次遗失都有重逢的可能", {
    x: 1.5,
    y: 3.65,
    w: 10.0,
    h: 0.6,
    fontSize: 18,
    fontFace: FONT,
    color: "CBD5E1",
    align: "center",
    valign: "mid",
  });
  // 标签
  slide.addShape("roundRect", {
    x: 4.3,
    y: 4.5,
    w: 4.3,
    h: 0.55,
    fill: { color: "1E3A8A" },
    line: { color: "3B82F6", pt: 1 },
    rectRadius: 0.28,
  });
  slide.addText("用科技编织温情纽带 · 重塑城市失物招领新生态", {
    x: 4.3,
    y: 4.5,
    w: 4.3,
    h: 0.55,
    fontSize: 13,
    fontFace: FONT,
    color: "FFFFFF",
    align: "center",
    valign: "mid",
  });
  // 日期（上移至城市剪影上方，避免重叠）
  slide.addText("2026年6月", {
    x: 5.5,
    y: 5.05,
    w: 2.0,
    h: 0.3,
    fontSize: 12,
    fontFace: FONT,
    color: "94A3B8",
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第2页：目录 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "目录 CONTENTS", "从市场痛点挖掘到技术架构落地，构建完整的城市失物招领解决方案体系");

  const sections = [
    {
      num: "01",
      title: "项目背景与市场痛点",
      desc: "深度剖析城市失物招领的严峻现状，直击传统模式信息碎片化、流转无规范的核心痛点，确立构建城市级泛公共物联网络的长远愿景。",
      color: COLORS.primary,
    },
    {
      num: "02",
      title: "产品介绍与核心功能",
      desc: "演示从遗失上报、智能匹配、找回确认到安全归还的完整业务闭环，依托AI算法实现精准物主匹配，搭建完善的信用体系保障双方权益。",
      color: COLORS.accentPurple,
    },
    {
      num: "03",
      title: "技术架构与未来展望",
      desc: "解析Serverless无服务器架构的轻量化部署优势，复盘项目阶段性落地成果，探索物联网硬件结合大数据分析的下一代产品迭代方向。",
      color: COLORS.accentCyan,
    },
  ];

  const cardW = 3.8;
  const cardH = 2.6;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY;

  sections.forEach((sec, i) => {
    const x = startX + i * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: COLORS.bgCard },
      line: { color: COLORS.border, pt: 0.5 },
      rectRadius: 0.08,
    });
    // 左侧色条
    slide.addShape("rect", {
      x,
      y,
      w: 0.06,
      h: cardH,
      fill: { color: sec.color },
    });
    // 序号圆圈
    slide.addShape("ellipse", {
      x: x + 0.25,
      y: y + 0.3,
      w: 0.6,
      h: 0.6,
      fill: { color: sec.color },
    });
    slide.addText(sec.num, {
      x: x + 0.25,
      y: y + 0.3,
      w: 0.6,
      h: 0.6,
      fontSize: 18,
      fontFace: FONT_EN,
      color: "FFFFFF",
      bold: true,
      align: "center",
      valign: "mid",
    });
    slide.addText(sec.title, {
      x: x + 0.2,
      y: y + 1.05,
      w: cardW - 0.4,
      h: 0.45,
      fontSize: 17,
      fontFace: FONT,
      color: COLORS.textMain,
      bold: true,
      align: "left",
      valign: "mid",
    });
    slide.addText(sec.desc, {
      x: x + 0.2,
      y: y + 1.55,
      w: cardW - 0.4,
      h: 0.85,
      fontSize: 11,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
  });

  // 底部标语
  slide.addText("闭环 · 智能 · 可信", {
    x: 4.0,
    y: 5.1,
    w: 5.0,
    h: 0.55,
    fontSize: 28,
    fontFace: FONT,
    color: COLORS.primary,
    bold: true,
    align: "center",
    valign: "mid",
  });
  slide.addText("以技术驱动失物招领行业升级，打造全流程智能化、规范化的公共服务新范式", {
    x: 2.0,
    y: 5.65,
    w: 9.0,
    h: 0.4,
    fontSize: 13,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第3页：痛点 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "城市日均遗失数万件，找回却靠运气", "城市失物招领面临三大核心痛点，传统模式难以解决信息互通与信任问题");

  const cards = [
    {
      icon: "1",
      title: "传统模式低效",
      body: "依赖线下招领处、公告栏、社交媒体等零散渠道，信息分散且覆盖面狭窄，物品匹配流程繁琐，整体找回效率处于极低水平。",
      color: COLORS.primary,
    },
    {
      icon: "2",
      title: "信息孤岛严重",
      body: "拾物者与失主之间缺乏统一、高效的沟通桥梁，双方信息传递存在壁垒，供需信息难以实现精准互通与快速对接。",
      color: COLORS.accentPurple,
    },
    {
      icon: "3",
      title: "信任机制缺失",
      body: "线上沟通存在身份难以确认、信息不透明等安全风险，易产生物品归属误解，甚至滋生诈骗行为，用户权益无保障。",
      color: COLORS.accentCyan,
    },
  ];

  const cardW = 3.8;
  const cardH = 2.5;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY;

  cards.forEach((c, i) => {
    addCard(slide, {
      x: startX + i * (cardW + gap),
      y,
      w: cardW,
      h: cardH,
      title: c.title,
      body: c.body,
      iconText: c.icon,
      iconBg: c.color,
      titleSize: 17,
      bodySize: 12,
    });
  });

  // 底部大数据（整体下移，避免与上方卡片重叠）
  slide.addText("数万", {
    x: 4.5,
    y: 5.15,
    w: 2.2,
    h: 0.9,
    fontSize: 56,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "right",
    valign: "mid",
  });
  slide.addText("件/天", {
    x: 6.7,
    y: 5.4,
    w: 1.2,
    h: 0.45,
    fontSize: 18,
    fontFace: FONT,
    color: COLORS.textMain,
    align: "left",
    valign: "mid",
  });
  slide.addText("城市日均遗失物品估算，传统模式下找回率不足5%，钥匙、证件、数码产品为高频遗失物", {
    x: 2.0,
    y: 6.1,
    w: 9.0,
    h: 0.35,
    fontSize: 13,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第4页：定位 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "构建城市级泛公共物联网络");

  const cards = [
    {
      icon: "A",
      title: "项目定位：全域物联网络",
      body: "「拾寻」并非单一的校园工具，而是面向未来的城市级泛公共物联网络。它打破了传统失物招领的地域与场景限制，致力于连接城市中每一个公共节点，打造开放、共享的物品管理基础设施。",
      color: COLORS.primary,
    },
    {
      icon: "B",
      title: "核心理念：打破信息壁垒",
      body: "利用数字化技术手段，高效连接城市中的每一个“遗失”与“拾获”行为。消除信息不对称，构建高效流转、安全可信、便捷易用的物品找回生态，让失物回归变得简单、透明且有保障。",
      color: COLORS.accentPurple,
    },
    {
      icon: "C",
      title: "场景落地：中传示范样本",
      body: "本次演示以中国传媒大学为核心筛选场景，展示高密度人员区域的运作模式。该模式可快速复制并适配任何城市区域，无论是校园、商圈还是社区，都能无缝接入物联网络体系。",
      color: COLORS.accentCyan,
    },
  ];

  const cardW = 3.8;
  const cardH = 3.3;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY;

  cards.forEach((c, i) => {
    addCard(slide, {
      x: startX + i * (cardW + gap),
      y,
      w: cardW,
      h: cardH,
      title: c.title,
      body: c.body,
      iconText: c.icon,
      iconBg: c.color,
      titleSize: 16,
      bodySize: 11,
    });
  });

  // 底部流程
  const steps = ["信息汇聚", "全域连接", "精准匹配", "信用背书", "生态闭环"];
  const stepY = 5.25;
  const stepStartX = 1.2;
  const stepW = 1.6;
  const stepGap = 0.5;
  steps.forEach((s, i) => {
    const x = stepStartX + i * (stepW + stepGap);
    slide.addText(s, {
      x,
      y: stepY,
      w: stepW,
      h: 0.45,
      fontSize: 13,
      fontFace: FONT,
      color: COLORS.textMain,
      align: "center",
      valign: "mid",
    });
    if (i < steps.length - 1) {
      addArrow(slide, x + stepW + 0.05, stepY + 0.15, stepGap - 0.1, COLORS.primaryLight);
    }
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第5页：城市级服务能力全景演示 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(
    slide,
    "城市级服务能力全景演示",
    "城市级平台 · 传媒大学粒度演示（以传媒大学为筛选场景示例）"
  );

  const shots = [
    { file: "期末作业/项目截图/01_首页.png", label: "城市级海量吞吐能力" },
    { file: "期末作业/项目截图/02_发布表单.png", label: "地理围栏与精准检索" },
    { file: "期末作业/项目截图/04_个人中心.png", label: "多场景无缝适配切换" },
  ];
  const shotW = 3.8;
  const shotH = 2.0;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY;

  shots.forEach((s, i) => {
    const x = startX + i * (shotW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: shotW,
      h: shotH,
      fill: { color: "FFFFFF" },
      line: { color: COLORS.border, pt: 0.5 },
      rectRadius: 0.08,
    });
    slide.addImage({
      path: imgPath(s.file),
      x: x + 0.08,
      y: y + 0.08,
      w: shotW - 0.16,
      h: shotH - 0.52,
      sizing: "contain",
    });
    slide.addText(s.label, {
      x,
      y: y + shotH - 0.42,
      w: shotW,
      h: 0.35,
      fontSize: 13,
      fontFace: FONT,
      color: COLORS.textMain,
      bold: true,
      align: "center",
      valign: "mid",
    });
  });

  // 底部 4 个功能卡片
  const funcs = [
    { icon: "🔍", title: "失物招领检索", desc: "AI 多维度模糊匹配" },
    { icon: "🛡️", title: "实名认证准入", desc: "双向实名握手解锁" },
    { icon: "🤖", title: "智能匹配推荐", desc: "7 维加权精准撮合" },
    { icon: "📦", title: "代保管点网络", desc: "无接触安全交接" },
  ];
  const fW = 2.85;
  const fH = 1.15;
  const fGap = 0.25;
  const fStartX = 0.55;
  const fY = y + shotH + 0.25;
  funcs.forEach((f, i) => {
    const x = fStartX + i * (fW + fGap);
    slide.addShape("roundRect", {
      x,
      y: fY,
      w: fW,
      h: fH,
      fill: { color: "FFFFFF" },
      line: { color: COLORS.border, pt: 0.5 },
      rectRadius: 0.08,
    });
    slide.addText(f.icon, {
      x: x + 0.15,
      y: fY + 0.22,
      w: 0.5,
      h: 0.5,
      fontSize: 20,
      align: "center",
      valign: "mid",
    });
    slide.addText(f.title, {
      x: x + 0.7,
      y: fY + 0.18,
      w: fW - 0.85,
      h: 0.35,
      fontSize: 13,
      fontFace: FONT,
      color: COLORS.textMain,
      bold: true,
      align: "left",
      valign: "mid",
    });
    slide.addText(f.desc, {
      x: x + 0.7,
      y: fY + 0.55,
      w: fW - 0.85,
      h: 0.4,
      fontSize: 10,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第6页：完整闭环 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(
    slide,
    "打造失物招领的完整闭环",
    "在“认领审核”后新增“找回确认”环节，双方确认才生效，杜绝单方误操作"
  );

  const cards = [
    {
      icon: "1",
      title: "发布与智能匹配",
      body: "失主或拾主发布物品信息，系统依托AI自动提取特征标签，进行多维度智能匹配。根据物品类型、地点、时间等核心要素快速推送结果，让信息对接更精准高效。",
      color: COLORS.primary,
    },
    {
      icon: "2",
      title: "认领与找回确认",
      body: "匹配成功后双方线上沟通，核对物品细节与特征。拾到者点击“已归还”，失主确认“已收到”，双方确认才生效，有效规避冒领与纠纷，保障信息与财产安全。",
      color: COLORS.accentPurple,
    },
    {
      icon: "3",
      title: "激励与生态闭环",
      body: "物品成功找回后，系统自动发放社区积分奖励（拾到者+10分，失主+5分）。积分可兑换权益，以正向激励带动社区互助热情，构建“发布-匹配-认领-确认-激励”的良性生态。",
      color: COLORS.accentCyan,
    },
  ];

  const cardW = 3.8;
  const cardH = 2.55;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY;

  cards.forEach((c, i) => {
    addCard(slide, {
      x: startX + i * (cardW + gap),
      y,
      w: cardW,
      h: cardH,
      title: c.title,
      body: c.body,
      iconText: c.icon,
      iconBg: c.color,
      titleSize: 17,
      bodySize: 11,
    });
  });

  // 底部流程
  const steps = ["信息发布", "AI智能匹配", "线上认领核验", "找回确认", "积分激励互助"];
  const stepY = 5.05;
  const stepStartX = 0.55;
  const stepW = 1.8;
  const stepGap = 0.45;
  steps.forEach((s, i) => {
    const x = stepStartX + i * (stepW + stepGap);
    slide.addText(s, {
      x,
      y: stepY,
      w: stepW,
      h: 0.45,
      fontSize: 12,
      fontFace: FONT,
      color: COLORS.textMain,
      align: "center",
      valign: "mid",
    });
    if (i < steps.length - 1) {
      addArrow(slide, x + stepW + 0.05, stepY + 0.15, stepGap - 0.1, COLORS.primaryLight);
    }
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第7页：AI 智能匹配 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "AI 智能匹配：让重逢更精准", "多模态融合匹配引擎，结合文本结构化与图片语义识别，实现 7 维加权精准撮合");

  // 顶部核心引擎横幅
  const bannerH = 0.85;
  slide.addShape("roundRect", {
    x: 0.4,
    y: contentY,
    w: 12.5,
    h: bannerH,
    fill: { color: "EEF2FF" },
    line: { color: COLORS.primaryLight, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("🧠", {
    x: 0.65,
    y: contentY + 0.17,
    w: 0.45,
    h: 0.45,
    fontSize: 22,
    align: "center",
    valign: "mid",
  });
  slide.addText("核心引擎：多模态融合匹配", {
    x: 1.2,
    y: contentY,
    w: 4.5,
    h: bannerH,
    fontSize: 16,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "left",
    valign: "mid",
  });
  slide.addText("通过文本结构化提取关键特征，结合图片语义识别分析内容，对物品类别、属性、场景进行多维度相似度加权计算。", {
    x: 5.8,
    y: contentY,
    w: 6.8,
    h: bannerH,
    fontSize: 11,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "left",
    valign: "mid",
  });

  const cards = [
    {
      icon: "A",
      title: "文本结构化提取",
      body: "智能解析用户输入的自然语言，精准提取物品类型、颜色特征、遗失/拾取地点、时间节点等关键信息，构建结构化数据基础。",
      color: COLORS.primary,
    },
    {
      icon: "B",
      title: "图片语义识别技术",
      body: "利用深度学习模型分析上传图片内容，提取视觉关键特征，支持“文本+图片”多模态交叉验证，让物品匹配突破纯文字限制。",
      color: COLORS.accentPurple,
    },
    {
      icon: "C",
      title: "多维度加权评分",
      body: "系统自动拆解匹配维度，对类别、颜色、地点、时间、文本、图像、语义等 7 个核心要素赋予不同权重，清晰展示各维度匹配详情。",
      color: COLORS.accentCyan,
    },
  ];

  const cardW = 3.8;
  const cardH = 2.0;
  const gap = 0.25;
  const startX = 0.4;
  const y = contentY + bannerH + 0.25;

  cards.forEach((c, i) => {
    addCard(slide, {
      x: startX + i * (cardW + gap),
      y,
      w: cardW,
      h: cardH,
      title: c.title,
      body: c.body,
      iconText: c.icon,
      iconBg: c.color,
      titleSize: 16,
      bodySize: 11,
    });
  });

  // 底部匹配示例
  const exampleY = y + cardH + 0.25;
  slide.addShape("roundRect", {
    x: 0.4,
    y: exampleY,
    w: 12.5,
    h: 1.0,
    fill: { color: "F5F3FF" },
    line: { color: COLORS.accentPurple, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("85% 综合匹配度示例 | 类别100% · 颜色100% · 地点100% · 时间95% · 文本78% · 图像92% · 语义88%", {
    x: 0.6,
    y: exampleY + 0.1,
    w: 12.1,
    h: 0.4,
    fontSize: 14,
    fontFace: FONT,
    color: COLORS.accentPurple,
    bold: true,
    align: "center",
    valign: "mid",
  });
  slide.addText("AI 自动解释匹配逻辑：物品基础属性高度一致，地点信息完全重合，图片视觉特征匹配度极高，文本描述因简略导致部分维度分值略低。", {
    x: 0.6,
    y: exampleY + 0.5,
    w: 12.1,
    h: 0.4,
    fontSize: 11,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第8页：核心功能（安全与信任闭环） ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(
    slide,
    "核心功能：构建安全与信任闭环",
    "实名认证 + 双向确认 + 信用积分 + 代保管网络，保障每一次交易真实可信"
  );

  const nums = [
    { number: "10+5", unit: "", label: "双向激励信用体系", desc: "拾到者确认归还获10分，失主确认收到获5分，建立永久信用档案激励诚信。", fill: "EEF2FF", color: COLORS.primary },
    { number: "100", unit: "%", label: "强制实名认证准入", desc: "平台严格执行用户实名认证机制，绑定身份信息，从源头保障交易安全可靠。", fill: "F5F3FF", color: COLORS.accentPurple },
    { number: "2", unit: "重", label: "交易闭环双重确认", desc: "独创“已归还”与“已收到”双向确认流程，有效规避功能滥用，确保每笔交易真实完成。", fill: "ECFEFF", color: COLORS.accentCyan },
    { number: "N+", unit: "", label: "官方安全代保管网络", desc: "接入校园保安亭、图书馆、便利店、智能柜等官方/合作点位，提供安全中立的物品交接点。", fill: "F0FDF4", color: COLORS.accentTeal },
  ];

  const nW = 2.9;
  const nH = 1.85;
  const nGap = 0.22;
  const nStartX = 0.4;
  const nY = contentY;
  nums.forEach((n, i) => {
    addNumberCard(slide, {
      x: nStartX + i * (nW + nGap),
      y: nY,
      w: nW,
      h: nH,
      number: n.number,
      unit: n.unit,
      label: n.label,
      desc: n.desc,
      fill: n.fill,
      numberColor: n.color,
    });
  });

  // 底部三个说明卡片
  const bottomCards = [
    {
      title: "信用档案可视化",
      body: "用户可随时查看个人信用积分明细与历史履约记录，积分等级直接关联平台权限，形成正向循环的诚信生态。",
      color: COLORS.primary,
    },
    {
      title: "城市身份强绑定",
      body: "对接实名认证系统，确保注册用户身份信息真实有效。验证过程加密处理，保障用户隐私数据安全无泄露。",
      color: COLORS.accentPurple,
    },
    {
      title: "全域托管点位覆盖",
      body: "地图可视化展示代保管网点，支持一键导航与网点预约，解决用户时空错配难题，提升物品找回成功率。",
      color: COLORS.accentCyan,
    },
  ];
  const bW = 3.3;
  const bH = 1.55;
  const bGap = 0.25;
  const bStartX = 0.4;
  const bY = nY + nH + 0.2;
  bottomCards.forEach((c, i) => {
    addCard(slide, {
      x: bStartX + i * (bW + bGap),
      y: bY,
      w: bW,
      h: bH,
      title: c.title,
      body: c.body,
      iconText: "✓",
      iconBg: c.color,
      titleSize: 14,
      bodySize: 10,
    });
  });

  // 右侧 checklist
  const checks = [
    "信息自由发布",
    "AI 智能匹配推送",
    "实名认证机制",
    "双向确认闭环",
    "信用积分激励",
    "全终端消息触达",
    "代保管点网络",
  ];
  const checklistX = 10.85;
  slide.addShape("roundRect", {
    x: checklistX,
    y: bY,
    w: 2.2,
    h: 1.75,
    fill: { color: "FFFFFF" },
    line: { color: COLORS.border, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("安全机制补充：", {
    x: checklistX + 0.15,
    y: bY + 0.1,
    w: 1.9,
    h: 0.25,
    fontSize: 11,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "left",
    valign: "mid",
  });
  checks.forEach((txt, i) => {
    slide.addText("✓ " + txt, {
      x: checklistX + 0.15,
      y: bY + 0.37 + i * 0.17,
      w: 1.9,
      h: 0.17,
      fontSize: 9,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "mid",
    });
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第13页：Serverless 7大API模块 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "拥抱 Serverless 无服务器时代", "零服务器运维，按需执行，自动弹性扩缩容，当前免费额度内零成本运行");

  const layers = [
    {
      icon: "🖥️",
      title: "前端交互层",
      desc: "原生 HTML/CSS/JS 构建单页应用，极致响应式适配多终端，剔除冗余框架，毫秒级加载。",
      color: COLORS.primary,
    },
    {
      icon: "⚡",
      title: "后端服务层",
      desc: "Vercel Serverless Functions 部署核心 API，代码按需执行、弹性扩缩，零服务器运维成本。",
      color: COLORS.accentPurple,
    },
    {
      icon: "🗄️",
      title: "云端数据层",
      desc: "Supabase PostgreSQL 全托管数据库，自带 RESTful API 与实时订阅，简化开发维护。",
      color: COLORS.accentCyan,
    },
    {
      icon: "🧠",
      title: "AI 智能能力层",
      desc: "集成 SiliconFlow API，提供高精度文本提取、图片语义识别与智能内容分析能力。",
      color: COLORS.accentTeal,
    },
  ];

  const lW = 5.9;
  const lH = 2.15;
  const lGapX = 0.5;
  const lGapY = 0.25;
  const lStartX = 0.4;
  const lStartY = contentY;

  layers.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = lStartX + col * (lW + lGapX);
    const y = lStartY + row * (lH + lGapY);
    slide.addShape("roundRect", {
      x,
      y,
      w: lW,
      h: lH,
      fill: { color: l.color },
      rectRadius: 0.12,
    });
    slide.addText(l.icon, {
      x: x + 0.25,
      y: y + 0.3,
      w: 0.6,
      h: 0.6,
      fontSize: 28,
      align: "center",
      valign: "mid",
    });
    slide.addText(l.title, {
      x: x + 1.0,
      y: y + 0.3,
      w: lW - 1.25,
      h: 0.5,
      fontSize: 18,
      fontFace: FONT,
      color: "FFFFFF",
      bold: true,
      align: "left",
      valign: "mid",
    });
    slide.addText(l.desc, {
      x: x + 0.25,
      y: y + 0.95,
      w: lW - 0.5,
      h: 1.1,
      fontSize: 12,
      fontFace: FONT,
      color: "E2E8F0",
      align: "left",
      valign: "top",
    });
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第10页：全栈技术架构表 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "全栈技术架构：轻量高效、安全可控", "前后端分离 + Serverless + 云端数据库 + AI 外部对接的云原生方案");

  const rows = [
    ["技术层级", "核心技术方案", "方案价值与优势"],
    ["前端交互层", "原生 HTML/CSS/JS 单页应用", "采用纯原生技术栈实现响应式设计，完美适配移动端与桌面端，摒弃复杂编译构建流程，实现毫秒级页面加载。"],
    ["后端服务层", "Vercel Serverless Functions", "部署 7 个核心云函数 API，实现按需执行、弹性伸缩，无需投入服务器运维成本。"],
    ["数据存储层", "Supabase PostgreSQL", "全托管云端数据库，内置 REST API 与实时数据订阅能力，搭配行级安全（RLS）策略，确保数据访问安全。"],
    ["智能能力层", "SiliconFlow API 赋能", "集成先进的文本结构化提取与图片语义识别能力，为物品信息匹配提供 AI 技术支撑。"],
    ["文件存储层", "Supabase Storage 对象存储", "提供高可用的云端文件存储服务，自动生成安全的图片访问 URL，支持文件的上传、管理与权限控制。"],
    ["安全认证层", "JWT Token 无状态认证", "采用行业标准的 JWT 认证方案，实现无状态的身份校验，有效保障前后端通信安全与用户身份合法性。"],
  ];

  addSimpleTable(slide, rows, {
    x: 0.4,
    y: contentY,
    w: 12.5,
    colW: [2.2, 3.4, 6.9],
    fontSize: 11,
  });

  slide.addText("技术架构在开发效率、运行成本、系统安全与智能体验上实现全方位平衡，构建稳定可靠的城市拾遗服务底座。", {
    x: 0.4,
    y: 6.25,
    w: 12.5,
    h: 0.45,
    fontSize: 12,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第11页：7大后端 API 模块清单 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "Serverless 架构核心：7 大后端 API 模块清单", "模块化云函数设计，实现业务解耦、弹性扩容与零运维成本");

  const rows = [
    ["API 访问路径", "核心功能分类", "业务逻辑与实现细节"],
    ["/api/records", "核心业务处理", "物品增删改查、认领受理及找回确认，负责遗失/拾获信息的全生命周期管理。"],
    ["/api/auth", "用户身份认证", "账号注册、密码登录、实名认证流程，为平台交互提供可信的身份鉴权保障。"],
    ["/api/structured-input", "AI 语义结构化提取", "调用人工智能服务，对用户输入的自然语言描述进行解析，自动提取物品特征、地点、时间等结构化信息。"],
    ["/api/analyze-image", "AI 图像语义分析", "对接图像识别模型，对用户上传的物品照片进行深度语义分析，自动识别物品类型、品牌、特征标签。"],
    ["/api/upload-image", "云端资源存储", "处理多媒体文件传输，将用户上传的图片安全存储至云对象存储服务，并生成可访问的 CDN 链接。"],
    ["/api/notify", "实时消息通知", "基于 8 秒轮询策略实现轻量级实时通信，向用户推送认领进度、匹配结果及系统提醒。"],
    ["/api/custody", "代保管点管理", "提供校园/城市代保管点的增删改查管理接口，构建线下实体网络与线上平台的联动支撑。"],
  ];

  addSimpleTable(slide, rows, {
    x: 0.4,
    y: contentY,
    w: 12.5,
    colW: [2.5, 2.8, 7.2],
    fontSize: 11,
  });

  slide.addText("基于 Serverless 的模块化 API 设计，实现了业务解耦、弹性扩容与零运维成本，为系统稳定性与扩展性提供坚实保障。", {
    x: 0.4,
    y: 6.25,
    w: 12.5,
    h: 0.45,
    fontSize: 12,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第12页：技术架构图解析 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "技术架构图解析", "三层分离：前端展示层 / 后端业务逻辑层 / 数据存储层完全解耦");

  // 分层高度与间距（自顶向下紧凑排布，层间留白需容纳连接箭头）
  const userH = 0.6;
  const vercelH = 1.4;
  const dataH = 1.0;
  const gap = 0.3;

  // 用户层
  const userY = contentY;
  slide.addShape("roundRect", {
    x: 0.4,
    y: userY,
    w: 12.5,
    h: userH,
    fill: { color: "EEF2FF" },
    line: { color: COLORS.primaryLight, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("用户层（客户端）", {
    x: 0.55,
    y: userY,
    w: 3,
    h: userH,
    fontSize: 13,
    fontFace: FONT,
    color: COLORS.primary,
    bold: true,
    align: "left",
    valign: "mid",
  });
  slide.addText("桌面端浏览器        移动端浏览器        未来：微信小程序", {
    x: 4.0,
    y: userY,
    w: 8.5,
    h: userH,
    fontSize: 12,
    fontFace: FONT,
    color: COLORS.textMain,
    align: "left",
    valign: "mid",
  });

  // 连接箭头
  const arrow1Y = userY + userH + gap / 2;
  addArrow(slide, 5.8, arrow1Y, 1.6, COLORS.primaryLight);

  // Vercel 平台层
  const vercelY = userY + userH + gap;
  slide.addShape("roundRect", {
    x: 0.4,
    y: vercelY,
    w: 12.5,
    h: vercelH,
    fill: { color: "F5F3FF" },
    line: { color: COLORS.accentPurple, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("Vercel 云平台", {
    x: 0.55,
    y: vercelY,
    w: 3,
    h: 0.4,
    fontSize: 13,
    fontFace: FONT,
    color: COLORS.accentPurple,
    bold: true,
    align: "left",
    valign: "mid",
  });
  const boxY = vercelY + 0.42;
  const boxH = vercelH - 0.52;
  slide.addShape("roundRect", {
    x: 0.75,
    y: boxY,
    w: 5.5,
    h: boxH,
    fill: { color: "FFFFFF" },
    line: { color: COLORS.border, pt: 0.5 },
    rectRadius: 0.06,
  });
  slide.addText("前端静态托管\nHTML / CSS / JS", {
    x: 0.75,
    y: boxY,
    w: 5.5,
    h: boxH,
    fontSize: 12,
    fontFace: FONT,
    color: COLORS.textMain,
    align: "center",
    valign: "mid",
  });
  slide.addShape("roundRect", {
    x: 7.05,
    y: boxY,
    w: 5.5,
    h: boxH,
    fill: { color: "FFFFFF" },
    line: { color: COLORS.border, pt: 0.5 },
    rectRadius: 0.06,
  });
  slide.addText("Serverless Functions（7 个云函数 API）\nrecords · auth · structured-input · analyze-image · upload-image · notify · custody", {
    x: 7.05,
    y: boxY,
    w: 5.5,
    h: boxH,
    fontSize: 10,
    fontFace: FONT,
    color: COLORS.textMain,
    align: "center",
    valign: "mid",
  });

  // 连接箭头
  const arrow2Y = vercelY + vercelH + gap / 2;
  addArrow(slide, 5.8, arrow2Y, 1.6, COLORS.primaryLight);

  // 数据/AI 层
  const dataY = vercelY + vercelH + gap;
  const dataBoxes = [
    { x: 0.55, title: "Supabase PostgreSQL", desc: "物品记录 / 用户数据 / 认领记录 / 找回确认 / 消息通知 / 代保管点 / 行级安全 RLS" },
    { x: 4.7, title: "Supabase Storage", desc: "物品图片 / 头像 / 访问 URL" },
    { x: 8.85, title: "SiliconFlow AI 引擎", desc: "文本结构化提取 / 图片语义识别 / 多模态匹配" },
  ];
  dataBoxes.forEach((box) => {
    slide.addShape("roundRect", {
      x: box.x,
      y: dataY,
      w: 3.9,
      h: dataH,
      fill: { color: "ECFEFF" },
      line: { color: COLORS.accentCyan, pt: 0.5 },
      rectRadius: 0.08,
    });
    slide.addText(box.title, {
      x: box.x + 0.15,
      y: dataY + 0.1,
      w: 3.6,
      h: 0.32,
      fontSize: 12,
      fontFace: FONT,
      color: COLORS.accentCyan,
      bold: true,
      align: "left",
      valign: "mid",
    });
    slide.addText(box.desc, {
      x: box.x + 0.15,
      y: dataY + 0.42,
      w: 3.6,
      h: dataH - 0.52,
      fontSize: 10,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "top",
    });
  });

  // 底部总结
  const summaryY = dataY + dataH + gap;
  slide.addText("分层解耦 · 高弹性架构：全托管云原生架构实现四层解耦，保障系统高可用与灵活扩展，降低运维成本。", {
    x: 0.4,
    y: summaryY,
    w: 12.5,
    h: 0.35,
    fontSize: 11,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第13页：技术架构核心优势 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "技术架构核心优势，赋能项目高效落地", "在运维效率、成本控制、安全合规及开发协同等维度实现全方位突破");

  const rows = [
    ["核心维度", "传统技术方案痛点", "我们的技术架构优势"],
    ["服务器运维", "需采购配置、部署监控，运维成本高昂", "零服务器运维，专注业务无需关注底层维护"],
    ["资源弹性能力", "资源固定配置，高峰易宕机低谷易浪费", "极致弹性扩缩容，自动适配流量峰谷变化"],
    ["项目成本控制", "预付资源费用，闲置时成本无法有效降低", "按需计费享免费额度，初创期可零成本运行"],
    ["团队开发协同", "前后端耦合度高，接口不清晰迭代效率低", "前后端分离架构，接口清晰实现团队高效并行"],
    ["数据安全保障", "权限管控粗放，身份认证机制存在安全隐患", "RLS 行级安全 + JWT 认证，筑牢企业级安全防线"],
    ["技术栈选型", "依赖闭源技术，易被厂商锁定且扩展受限", "全主流开源技术栈，自主可控无厂商锁定风险"],
  ];

  addSimpleTable(slide, rows, {
    x: 0.4,
    y: contentY,
    w: 12.5,
    colW: [2.2, 5.0, 5.3],
    fontSize: 11,
  });

  slide.addText("我们的技术架构在运维效率、成本控制、安全合规及开发协同等维度实现全方位突破，为项目可持续发展奠定坚实基础。", {
    x: 0.4,
    y: 6.2,
    w: 12.5,
    h: 0.45,
    fontSize: 12,
    fontFace: FONT,
    color: COLORS.textSub,
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第14页：传媒大学场景演示示例 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(
    slide,
    `传媒大学场景演示示例，${SCENE_RECORDS}条记录 ${SCENE_MATCHES}对高置信匹配落地`,
    "以传媒大学为筛选场景，验证城市级平台在高密度人员区域的运作模式"
  );

  const nums = [
    { number: String(SCENE_RECORDS), unit: "", label: "场景示例记录总数", desc: "覆盖真实丢失与拾获场景，数据来源真实有效。", fill: "EEF2FF", color: COLORS.primary },
    { number: String(SCENE_MATCHES), unit: "", label: "成功匹配对数", desc: "AI 智能匹配精准撮合，综合匹配度 ≥80%，效率显著提升。", fill: "F5F3FF", color: COLORS.accentPurple },
    { number: "100", unit: "%", label: "核心流程测试覆盖", desc: "功能测试覆盖发布、匹配、认领、找回确认等核心流程。", fill: "ECFEFF", color: COLORS.accentCyan },
    { number: "闭环", unit: "", label: "全流程信用闭环", desc: "实名 + 信用积分 + 双向确认，构建可信拾遗生态。", fill: "F0FDF4", color: COLORS.accentTeal },
  ];

  const nW = 2.9;
  const nH = 1.85;
  const nGap = 0.22;
  const nStartX = 0.4;
  const nY = contentY;
  nums.forEach((n, i) => {
    addNumberCard(slide, {
      x: nStartX + i * (nW + nGap),
      y: nY,
      w: nW,
      h: nH,
      number: n.number,
      unit: n.unit,
      label: n.label,
      desc: n.desc,
      fill: n.fill,
      numberColor: n.color,
    });
  });

  // 底部说明卡片
  const bottomCards = [
    {
      title: "基础信息服务体系",
      body: "支持失物与招领信息便捷发布，响应式布局适配多端，实现全终端无缝访问。",
      color: COLORS.primary,
    },
    {
      title: "AI 智能匹配与安全",
      body: "AI 特征匹配精准推送，实名认证保障可信，“双方确认”规避冒领风险。",
      color: COLORS.accentPurple,
    },
    {
      title: "生态运营与管理",
      body: "信用积分激励正向行为，城市/校园代保管点暂存物品，实时消息通知形成闭环。",
      color: COLORS.accentCyan,
    },
  ];
  const bW = 3.3;
  const bH = 1.55;
  const bGap = 0.25;
  const bStartX = 0.4;
  const bY = nY + nH + 0.2;
  bottomCards.forEach((c, i) => {
    addCard(slide, {
      x: bStartX + i * (bW + bGap),
      y: bY,
      w: bW,
      h: bH,
      title: c.title,
      body: c.body,
      iconText: "✓",
      iconBg: c.color,
      titleSize: 14,
      bodySize: 10,
    });
  });

  // 右侧 checklist
  const checks = [
    "信息自由发布",
    "AI 智能匹配推送",
    "实名认证机制",
    "双向确认闭环",
    "信用积分激励",
    "全终端消息触达",
  ];
  const checklistX = 10.85;
  slide.addShape("roundRect", {
    x: checklistX,
    y: bY,
    w: 2.2,
    h: 1.6,
    fill: { color: "FFFFFF" },
    line: { color: COLORS.border, pt: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText("能力清单：", {
    x: checklistX + 0.15,
    y: bY + 0.1,
    w: 1.9,
    h: 0.25,
    fontSize: 11,
    fontFace: FONT,
    color: COLORS.textMain,
    bold: true,
    align: "left",
    valign: "mid",
  });
  checks.forEach((txt, i) => {
    slide.addText("✓ " + txt, {
      x: checklistX + 0.15,
      y: bY + 0.37 + i * 0.18,
      w: 1.9,
      h: 0.18,
      fontSize: 10,
      fontFace: FONT,
      color: COLORS.textSub,
      align: "left",
      valign: "mid",
    });
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第15页：未来展望 ====================
{
  const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  const contentY = addTitle(slide, "未来展望：小程序、AI 与区块链的持续迭代升级", "从单一 Web 应用向多端生态与可信溯源演进");

  const cards = [
    {
      icon: "📱",
      title: "微信小程序版",
      body: "降低用户使用门槛，无需下载安装即可使用，依托微信成熟的社交与流量生态，实现用户的快速触达与获取。",
      color: COLORS.primary,
    },
    {
      icon: "🖼️",
      title: "图片识别增强",
      body: "支持多图匹配与批量上传操作，优化算法模型提升图片语义识别的准确度，让失物的视觉信息匹配更加精准可靠。",
      color: COLORS.accentPurple,
    },
    {
      icon: "🗺️",
      title: "地图可视化",
      body: "开发遗失热点热力图功能，直观展示各区域遗失物品的密度分布情况，辅助用户快速定位查找方向。",
      color: COLORS.accentCyan,
    },
    {
      icon: "🔗",
      title: "区块链存证",
      body: "将失物认领的全过程关键记录上链存证，利用区块链技术确保数据不可篡改、可追溯，增强平台公信力。",
      color: COLORS.accentTeal,
    },
  ];

  const cW = 5.9;
  const cH = 2.15;
  const cGapX = 0.5;
  const cGapY = 0.25;
  const cStartX = 0.4;
  const cStartY = contentY;

  cards.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = cStartX + col * (cW + cGapX);
    const y = cStartY + row * (cH + cGapY);
    slide.addShape("roundRect", {
      x,
      y,
      w: cW,
      h: cH,
      fill: { color: c.color },
      rectRadius: 0.12,
    });
    slide.addText(c.icon, {
      x: x + 0.25,
      y: y + 0.3,
      w: 0.6,
      h: 0.6,
      fontSize: 28,
      align: "center",
      valign: "mid",
    });
    slide.addText(c.title, {
      x: x + 1.0,
      y: y + 0.3,
      w: cW - 1.25,
      h: 0.5,
      fontSize: 18,
      fontFace: FONT,
      color: "FFFFFF",
      bold: true,
      align: "left",
      valign: "mid",
    });
    slide.addText(c.body, {
      x: x + 0.25,
      y: y + 0.95,
      w: cW - 0.5,
      h: 1.1,
      fontSize: 12,
      fontFace: FONT,
      color: "E2E8F0",
      align: "left",
      valign: "top",
    });
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 第16页：感谢聆听 ====================
{
  const slide = pptx.addSlide();
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { color: "0F172A" },
  });

  // 城市剪影装饰（压低高度，避免遮挡文字与二维码）
  const buildings = [
    { x: 0.5, w: 0.35, h: 2.2 },
    { x: 1.0, w: 0.45, h: 3.0 },
    { x: 1.6, w: 0.3, h: 1.8 },
    { x: 2.0, w: 0.5, h: 2.6 },
    { x: 2.7, w: 0.4, h: 2.0 },
    { x: 3.3, w: 0.35, h: 2.8 },
    { x: 3.9, w: 0.5, h: 2.2 },
    { x: 4.6, w: 0.3, h: 1.9 },
    { x: 5.0, w: 0.4, h: 2.5 },
    { x: 5.6, w: 0.45, h: 2.1 },
    { x: 6.2, w: 0.35, h: 3.2 },
    { x: 6.8, w: 0.4, h: 2.4 },
    { x: 7.4, w: 0.3, h: 1.7 },
    { x: 7.9, w: 0.5, h: 2.9 },
    { x: 8.6, w: 0.35, h: 2.0 },
    { x: 9.1, w: 0.4, h: 2.6 },
    { x: 9.7, w: 0.45, h: 2.2 },
    { x: 10.4, w: 0.3, h: 1.8 },
    { x: 10.9, w: 0.5, h: 3.0 },
    { x: 11.6, w: 0.35, h: 2.3 },
    { x: 12.1, w: 0.4, h: 1.9 },
  ];
  const skylineMaxH = 0.8;
  const rawMaxH = Math.max(...buildings.map((b) => b.h));
  const skylineScale = skylineMaxH / rawMaxH;
  buildings.forEach((b) => {
    const h = b.h * skylineScale;
    slide.addShape("rect", {
      x: b.x,
      y: 7.5 - h,
      w: b.w,
      h,
      fill: { color: "1E293B" },
    });
  });

  slide.addText("拾寻 · 城市拾遗网络", {
    x: 5.0,
    y: 1.4,
    w: 3.5,
    h: 0.35,
    fontSize: 12,
    fontFace: FONT,
    color: "94A3B8",
    align: "center",
    valign: "mid",
  });
  slide.addText("感谢聆听", {
    x: 3.5,
    y: 1.85,
    w: 6.5,
    h: 1.0,
    fontSize: 52,
    fontFace: FONT,
    color: "FFFFFF",
    bold: true,
    align: "center",
    valign: "mid",
  });
  slide.addShape("rect", {
    x: 5.8,
    y: 3.0,
    w: 1.8,
    h: 0.04,
    fill: { color: COLORS.primaryLight },
  });
  slide.addText("拾寻 · 让重逢更简单", {
    x: 3.5,
    y: 3.15,
    w: 6.5,
    h: 0.45,
    fontSize: 16,
    fontFace: FONT,
    color: "CBD5E1",
    align: "center",
    valign: "mid",
  });

  // 二维码
  slide.addText("https://shixun-lost-found.vercel.app", {
    x: 3.5,
    y: 3.75,
    w: 6.5,
    h: 0.35,
    fontSize: 12,
    fontFace: FONT,
    color: "94A3B8",
    align: "center",
    valign: "mid",
  });
  slide.addImage({
    path: imgPath("images/qrcode.png"),
    x: 5.4,
    y: 4.15,
    w: 2.1,
    h: 2.1,
    sizing: "contain",
  });

  slide.addText("期待与您的每一次相遇", {
    x: 3.5,
    y: 6.35,
    w: 6.5,
    h: 0.3,
    fontSize: 11,
    fontFace: FONT,
    color: "64748B",
    align: "center",
    valign: "mid",
  });

  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

// ==================== 输出文件 ====================
const outputPath = path.join(__dirname, "拾寻 · 城市拾遗网络_优化版.pptx");
pptx
  .writeFile({ fileName: outputPath })
  .then(() => {
    console.log("✅ 已生成优化版 PPT:", outputPath);
  })
  .catch((err) => {
    console.error("❌ 生成 PPT 失败:", err);
    process.exit(1);
  });
