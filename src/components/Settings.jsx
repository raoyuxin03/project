import { useState } from 'react'
import {
  getAixorasBaseUrl,
  getAixorasImageApiKey,
  getAixorasImageModel,
  getAixorasVideoApiKey,
  getApiKey,
  getBaseUrl,
  getChange2ProBaseUrl,
  getChange2ProImageApiKey,
  getChange2ProImageModel,
  getImageProvider,
  IMAGE_PROVIDER_OPTIONS,
  setAixorasBaseUrl,
  setAixorasImageApiKey,
  setAixorasImageModel,
  setAixorasVideoApiKey,
  setApiKey,
  setBaseUrl,
  setChange2ProBaseUrl,
  setChange2ProImageApiKey,
  setChange2ProImageModel,
  setImageProvider,
} from '../api'

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey())
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl())
  const [aixorasBaseUrl, setAixorasBaseUrlState] = useState(getAixorasBaseUrl())
  const [image2ApiKey, setImage2ApiKeyState] = useState(getAixorasImageApiKey())
  const [seedanceApiKey, setSeedanceApiKeyState] = useState(getAixorasVideoApiKey())
  const [aixorasImageModel, setAixorasImageModelState] = useState(getAixorasImageModel())
  const [imageProvider, setImageProviderState] = useState(getImageProvider())
  const [change2ProBaseUrl, setChange2ProBaseUrlState] = useState(getChange2ProBaseUrl())
  const [change2ProImageApiKey, setChange2ProImageApiKeyState] = useState(getChange2ProImageApiKey())
  const [change2ProImageModel, setChange2ProImageModelState] = useState(getChange2ProImageModel())
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setApiKey(apiKey.trim())
    setBaseUrl(baseUrl.trim())
    setAixorasBaseUrl(aixorasBaseUrl.trim())
    setAixorasImageApiKey(image2ApiKey.trim())
    setAixorasVideoApiKey(seedanceApiKey.trim())
    setAixorasImageModel(aixorasImageModel.trim())
    setImageProvider(imageProvider)
    setChange2ProBaseUrl(change2ProBaseUrl.trim())
    setChange2ProImageApiKey(change2ProImageApiKey.trim())
    setChange2ProImageModel(change2ProImageModel.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">设置</h2>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300">Agnes API</h3>
        <div>
          <label className="mb-2 block text-sm text-gray-400">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKeyState(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            从 <a href="https://platform.agnes-ai.com" target="_blank" className="text-purple-400 hover:underline">platform.agnes-ai.com</a> 获取 API Key。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">API Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrlState(e.target.value)}
            placeholder="/api-proxy"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            本地开发默认使用 /api-proxy，由 Vite 转发到 https://apihub.agnes-ai.com，避免浏览器 CORS。
          </p>
        </div>

        <div className="pt-5">
          <h3 className="text-sm font-semibold text-gray-300">Aixoras 接口</h3>
          <p className="mt-1 text-xs text-gray-500">
            图片栏可以在 Aixoras Image2 和 Change2Pro 之间切换；视频栏仍使用 Seedance。不同渠道的 API Key 分开保存，避免串用额度或权限。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">默认图片渠道</label>
          <select
            value={imageProvider}
            onChange={e => setImageProviderState(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
          >
            {IMAGE_PROVIDER_OPTIONS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}{provider.badge ? ` · ${provider.badge}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            图片栏也可以临时切换渠道；这里保存的是默认选项。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Aixoras Base URL</label>
          <input
            type="text"
            value={aixorasBaseUrl}
            onChange={e => setAixorasBaseUrlState(e.target.value)}
            placeholder="/aixoras-proxy"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            建议保持 /aixoras-proxy。也可以填写 https://api.aixoras.com/v1，系统会自动兼容。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Image2 图片 API Key</label>
          <input
            type="password"
            value={image2ApiKey}
            onChange={e => setImage2ApiKeyState(e.target.value)}
            placeholder="Image2 / gpt-image token"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            只用于图片栏的文生图和参考图生图，对应 /v1/images/generations 与 /v1/images/edits。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Image2 图片模型</label>
          <input
            type="text"
            value={aixorasImageModel}
            onChange={e => setAixorasImageModelState(e.target.value)}
            placeholder="gpt-image-2-2k"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            图片栏默认使用 gpt-image-2-2k；如果 Aixoras 后台模型名变化，可以在这里直接改。
          </p>
        </div>

        <div className="pt-5">
          <h3 className="text-sm font-semibold text-gray-300">Change2Pro 图片中转站</h3>
          <p className="mt-1 text-xs text-gray-500">
            对应你截图里的 https://api.change2pro.com。默认走本地 /change2pro-proxy 转发，避免浏览器 CORS。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Change2Pro Base URL</label>
          <input
            type="text"
            value={change2ProBaseUrl}
            onChange={e => setChange2ProBaseUrlState(e.target.value)}
            placeholder="/change2pro-proxy"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            建议保持 /change2pro-proxy；也可以填写 https://api.change2pro.com/v1，系统会自动兼容。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Change2Pro 图片 API Key</label>
          <input
            type="password"
            value={change2ProImageApiKey}
            onChange={e => setChange2ProImageApiKeyState(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            只用于图片栏的 Change2Pro 生图渠道。不要把截图里的 Key 写进代码，粘贴到这里保存即可。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Change2Pro 图片模型</label>
          <input
            type="text"
            value={change2ProImageModel}
            onChange={e => setChange2ProImageModelState(e.target.value)}
            placeholder="gpt-5.5"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            默认按截图使用 gpt-5.5；如果中转站后台给的是 gpt-image-2-2k 或其他生图模型名，可以在这里改。
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Seedance 视频 API Key</label>
          <input
            type="password"
            value={seedanceApiKey}
            onChange={e => setSeedanceApiKeyState(e.target.value)}
            placeholder="Seedance / video token"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            只用于视频栏的 Seedance / Aixoras 付费视频模型。图片生成不会读取这个 key。
          </p>
        </div>

        <button
          onClick={handleSave}
          className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700"
        >
          {saved ? '已保存 ✓' : '保存设置'}
        </button>
      </div>

      <div className="mt-8 space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">使用说明</h3>
        <ul className="space-y-2 text-xs text-gray-400">
          <li>1. Agnes 聊天/原生视频使用上方 Agnes API Key。</li>
          <li>2. 图片栏可以选择 Aixoras Image2 或 Change2Pro，两边 API Key 分开保存。</li>
          <li>3. Change2Pro Responses 对应 /v1/responses + image_generation，更贴近你截图里的 wire_api = responses。</li>
          <li>4. 视频栏的 Seedance / Aixoras 模型使用 Seedance 视频 API Key。</li>
          <li>5. 不确定 Base URL 时保持 /aixoras-proxy 或 /change2pro-proxy，不要直接在浏览器里暴露跨域请求。</li>
        </ul>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h3 className="text-sm font-medium text-gray-300">视频生成注意事项</h3>
        <ul className="space-y-2 text-xs text-gray-400">
          <li>• 视频生成优先使用 task_id 查询状态：/v1/videos/{'{task_id}'}，没有 task_id 时才回退到 video_id 查询。</li>
          <li>• 如果直接填 https://apihub.agnes-ai.com 后请求失败，请改回 /api-proxy。</li>
          <li>• 视频提交成功后会进入 queued 状态，需要等待处理。</li>
          <li>• 帧数必须为 8n+1，例如 33、65、97、121。</li>
          <li>• 推荐帧率：24 fps。</li>
          <li>• 选择 Seedance / Aixoras 模型时，会使用单独配置的 Seedance 视频 API Key。</li>
        </ul>
      </div>
    </div>
  )
}
