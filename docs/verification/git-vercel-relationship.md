# Git、Vercel 与正式域名关系核查

核查时间：2026-07-12。仅只读检查，未 commit、push、bind、deploy。

## 桌面求职优化版

- 是独立文件副本。
- 无 `.git` 目录或 worktree `.git` 文件，不属于 Git 仓库，因此没有分支、remote 或未提交状态。
- 无 `.vercel/project.json`，未发现本地 Vercel Project 绑定。
- 有 `vercel.json`，它只描述路由/函数配置，不能单独证明项目绑定或自动部署。
- 第二轮副本已移除 `package.json` 中的 `vercel --prod` 快捷脚本，降低误触风险。
- 因此，仅修改该副本不会自动影响 `shixun.xyz`。

## Trae 原项目（只读核查）

- `D:\Trae_Solo_Project\拾寻` 是 Git 仓库；当前分支 `main`。
- remote：`origin = https://github.com/Destiny-AX/campus-lost-found-ai-matcher.git`。
- 工作区存在未跟踪文件，本轮未修改。
- 存在 `.vercel/project.json`，Project 名为 `shiyun-lost-found`；具体 Project/Org ID 不写入交付文档。
- 未发现 GitHub Actions / GitLab CI 配置；发现 Vercel 本地绑定文件和历史部署说明。
- “Trae Git 仓库 → Vercel Project → shixun.xyz”关系高度可能，但生产分支、Git 集成开关、域名映射和 Deploy Hook 无法仅凭本地文件完全确认，必须在 Vercel Dashboard 核对。

## 后续安全流程

1. 先独立审核本 ZIP。
2. 在 Trae 仓库新建干净分支，逐文件选择性合并；不要覆盖 `.env`、`.vercel` 或生产配置。
3. 检查 diff、运行 check/smoke；明确保留真实环境变量名和数据库适配。
4. push 非生产分支，确认 Vercel 生成 Preview URL；若项目把所有分支自动生产部署，先在 Dashboard 调整。
5. 在 Preview 使用隔离 Key/数据库做黑盒验收。
6. Preview 通过后再按正式发布流程合并生产分支。

可能误触生产的操作：向生产分支 push、执行 `vercel --prod`、调用 Deploy Hook、修改 Project/域名绑定、在生产环境执行迁移。以上操作本轮均未执行。
