"use strict";

// 临时迁移 API：清空 Supabase 中的旧数据，让代码回退到新的北京种子数据
// 部署后调用一次即可，然后删除此文件
// GET /api/migrate-city?action=clean

const {
  getSupabaseConfig,
  supabaseFetch,
  sendJson,
  getCurrentUser,
  safeErrorText,
} = require("./_shared");

const RECORDS_TABLE = "lost_found_records";
const POINTS_TABLE = "shiyun_custody_points";

module.exports = async function handler(req, res) {
  try {
    // 仅登录用户可执行（临时迁移工具，用完即删）
    const current = getCurrentUser(req);
    if (!current) {
      sendJson(res, 401, { error: "请先登录" });
      return;
    }

    const config = getSupabaseConfig();
    if (!config) {
      sendJson(res, 200, {
        ok: true,
        message: "未配置 Supabase，使用内存数据，无需迁移",
      });
      return;
    }

    const results = {
      records_deleted: 0,
      points_deleted: 0,
      errors: [],
    };

    // 清空记录表
    try {
      const delRecordsRes = await supabaseFetch(
        config,
        `/rest/v1/${RECORDS_TABLE}?id=neq.${encodeURIComponent("never_match")}`,
        { method: "DELETE" },
      );
      if (delRecordsRes.ok) {
        // 获取删除计数（Supabase 返回的 content-range 头）
        const range = delRecordsRes.headers.get("content-range") || "";
        const match = range.match(/\/(\d+)/);
        results.records_deleted = match ? parseInt(match[1], 10) : "unknown";
      } else {
        results.errors.push(`records 表删除失败: HTTP ${delRecordsRes.status}`);
      }
    } catch (e) {
      results.errors.push(`records 表异常: ${safeErrorText(e.message)}`);
    }

    // 清空代保管点表
    try {
      const delPointsRes = await supabaseFetch(
        config,
        `/rest/v1/${POINTS_TABLE}?id=neq.${encodeURIComponent("never_match")}`,
        { method: "DELETE" },
      );
      if (delPointsRes.ok) {
        const range = delPointsRes.headers.get("content-range") || "";
        const match = range.match(/\/(\d+)/);
        results.points_deleted = match ? parseInt(match[1], 10) : "unknown";
      } else {
        results.errors.push(`points 表删除失败: HTTP ${delPointsRes.status}`);
      }
    } catch (e) {
      results.errors.push(`points 表异常: ${safeErrorText(e.message)}`);
    }

    sendJson(res, 200, {
      ok: true,
      message: "迁移完成，下次查询将使用新的北京种子数据",
      results,
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "迁移失败",
      detail: safeErrorText(error.message),
    });
  }
};
