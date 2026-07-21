# 合并前依赖审计

执行时间：2026-07-13。

## 结论

业务、API、本地服务和测试共扫描 15 个 JavaScript 文件，所有模块引用均为 Node.js 内置模块或相对路径，外部模块引用为 0。package.json 不再包含依赖条目，package-lock.json 为 lockfileVersion 3，仅包含根项目 1 个 package。

## 删除项

| 包 | 删除理由 |
|---|---|
| vercel | CLI/部署工具；业务运行、Functions 源码及本地测试均未引用，Vercel 平台构建不要求把 CLI 放入运行依赖 |
| fontkit | 字体处理工具；业务与测试未引用 |
| linebreak | 排版辅助工具；业务与测试未引用 |
| pptxgenjs | PPT 生成工具；不属于应用运行或验收链路 |
| prismjs | 代码高亮工具；页面和测试未引用 |
| skia-canvas | 原生 Canvas/截图依赖；现有页面截图是静态资产，业务和测试未引用 |

此前 skia-canvas 的 ECONNRESET 发生在其 prebuild.mjs download --or-compile 阶段，是无关原生依赖下载失败，不是拾寻业务代码失败。清理后实际 npm install 仅审计根项目，未创建 node_modules，未出现原生包下载。

机器输出：dependency-reference-scan.json、npm-ls-output.json、merge-final-npm-install-output.txt。
