# AI工作台

本地 AI 创作工作台，支持聊天、图片生成、视频生成、素材资产和无限画布。图片渠道可切换 Aixoras Image2 / Change2Pro，视频渠道可使用 Aixoras Seedance。

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
