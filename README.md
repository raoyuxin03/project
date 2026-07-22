# AI创作工作台

一个面向 AI 图片与视频创作的本地优先工作台，把对话、提示词辅助、图片生成、视频生成、素材管理和无限画布集中在同一套界面中。

项目支持接入 Agnes、Aixoras Image2、Change2Pro 与 Seedance 等模型服务，并通过统一的素材引用和任务流程，减少在多个平台之间反复切换的成本。API Key 仅保存在当前浏览器中，不写入源码。

## 主要功能

- AI 对话与图片、视频提示词辅助
- 多参考图图片生成与结果下载
- 文生视频、图生视频及多模态参考视频生成
- 本地素材资产管理与复用
- 实验性无限画布，用于组织创作素材和节点
- 独立设置页，统一管理模型、接口地址和 API Key

## 本地运行

```bash
npm install
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 设置

在应用的“设置”页填写：

- Agnes API Key：聊天和 Agnes 原生能力。
- Aixoras Image2 API Key：图片栏 Aixoras Image2。
- Change2Pro 图片 API Key：图片栏 Change2Pro Image API / Responses。
- Seedance 视频 API Key：视频栏 Seedance / Aixoras。

API Key 只保存在浏览器 localStorage，不写入源码。

## 免费部署

推荐用 Vercel 免费部署，因为本项目不只是纯静态页面，还依赖这些同域代理：

- `/api-proxy`
- `/aixoras-proxy`
- `/change2pro-proxy`
- `/media-download-proxy`
- `/public-upload/*`

Vercel 配置已经写在 `vercel.json`，下载代理函数在 `api/media-download-proxy.js`。

部署步骤：

1. 把项目推到 GitHub。
2. 打开 Vercel，选择“Import Git Repository”。
3. Framework Preset 选 Vite。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。

GitHub Pages 也可以免费托管 Vite 静态页面，但不能运行本项目需要的代理函数，线上生成和原图下载更容易失败。

## 构建检查

```bash
npm run build
npm run lint
```
