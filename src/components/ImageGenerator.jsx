import { useState } from 'react'
import { generateImage, generateImageCompat } from '../api'
import { addHistory } from '../store'

const SIZES = [
  { label: '1:1 (1024x1024)', value: '1024x1024' },
  { label: '9:16 竖图 (1024x1792)', value: '1024x1792' },
  { label: '16:9 横图 (1792x1024)', value: '1792x1024' },
]

const MODES = [
  { id: 'txt2img', label: '文生图' },
  { id: 'img2img', label: '图生图' },
  { id: 'multi', label: '多图合成' },
]

export default function ImageGenerator({ onGenerated }) {
  const [mode, setMode] = useState('txt2img')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [, setRefImage] = useState(null)
  const [multiImages, setMultiImages] = useState([])

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('请输入描述'); return }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      let res
      try {
        res = await generateImage({ prompt: prompt.trim(), size })
      } catch {
        res = await generateImageCompat({ prompt: prompt.trim(), size })
      }

      const images = res.data?.images || res.data?.url || res.images || res.data || []
      const urls = Array.isArray(images) ? images : [images]
      // 提取 URL 字符串，处理对象格式
      const extractUrl = (item) => {
        if (typeof item === 'string') return item
        if (item?.url) return item.url
        if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
        return null
      }
      const resultUrl = extractUrl(urls[0])
      setResult(urls)
      addHistory({ type: 'image', prompt: prompt.trim(), status: 'completed', result: resultUrl })
      onGenerated?.()
    } catch (e) {
      setError(e.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">图片生成</h2>

      {/* 模式选择 */}
      <div className="flex gap-2">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* API Key 提示 */}
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
        请先在「设置」页面配置 API Key
      </div>

      {/* 参考图上传 (图生图/多图合成) */}
      {mode === 'img2img' && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">参考图片</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setRefImage(e.target.files[0])}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
          />
        </div>
      )}

      {mode === 'multi' && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">参考图片（多张）</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => setMultiImages(Array.from(e.target.files))}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
          />
          {multiImages.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">已选择 {multiImages.length} 张图片</p>
          )}
        </div>
      )}

      {/* Prompt 输入 */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">图片描述 (Prompt)</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="输入图片描述，例如：一只可爱的柴犬在樱花树下睡觉，温暖的阳光，柔和的粉色花瓣飘落"
          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>

      {/* 图片尺寸 */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">图片尺寸</label>
        <select
          value={size}
          onChange={e => setSize(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          {SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            生成中...
          </>
        ) : '生成图片'}
      </button>

      {/* 错误信息 */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 生成结果 */}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            图片生成成功！共 {result.length} 张
          </p>
          <div className="grid gap-4">
            {result.map((item, i) => {
              const imgUrl = typeof item === 'string' ? item : item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
              return (
                <div key={i} className="rounded-lg overflow-hidden border border-gray-800">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`Generated ${i}`}
                      className="w-full"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-48 items-center justify-center text-gray-500 text-sm bg-gray-900"
                    style={{ display: imgUrl ? 'none' : 'flex' }}
                  >
                    图片加载失败
                  </div>
                  <div className="p-3 flex gap-2">
                    {imgUrl && (
                      <a
                        href={imgUrl}
                        download="agnes-image.png"
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs text-white"
                      >
                        下载
                      </a>
                    )}
                    <button
                      onClick={() => {
                        const copyUrl = typeof item === 'string' ? item : item?.url || ''
                        navigator.clipboard.writeText(copyUrl)
                        alert('链接已复制')
                      }}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                    >
                      复制链接
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
