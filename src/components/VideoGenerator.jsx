import { useState, useRef } from 'react'
import {
  generateVideo,
  getApiKey,
  getVideoStatus,
  getVideoStatusByVideoId,
  VIDEO_POLL_INITIAL_DELAY_MS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_TIMEOUT_MS,
} from '../api'
import { addHistory } from '../store'
import {
  extractQueuePosition,
  extractVideoCreateIds,
  extractVideoError,
  extractVideoProgress,
  extractVideoStatus,
  extractVideoUrl,
  isFatalPollingError,
  isRetryablePollingError,
  isVideoStatusFailure,
  isVideoStatusSuccess,
  summarizeVideoResponse,
} from '../videoResponse'
import {
  VIDEO_DURATION_PRESETS,
  VIDEO_FRAME_RATES,
  VIDEO_RESOLUTIONS,
  findDurationPreset,
  formatVideoDuration,
  framesFromDuration,
  normalizeVideoFrames,
} from '../videoOptions'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${seconds}秒`
  return `${minutes}分${rest}秒`
}

function nextPollDelay(errorCount) {
  return Math.min(VIDEO_POLL_INTERVAL_MS + errorCount * 5000, 30000)
}

const VIDEO_INPUT_MODES = [
  { value: 'text', label: '文生视频', description: '只使用提示词生成画面' },
  { value: 'image', label: '图生视频', description: '单张图片作为起始参考' },
  { value: 'multi-image', label: '多图参考', description: '多张图片共同约束主体和风格' },
  { value: 'keyframes', label: '首尾帧', description: '第一张到最后一张做关键帧过渡' },
]

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024

function parseImageUrls(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function summarizeImageSource(source) {
  if (!source) return source
  if (source.startsWith('data:')) return `${source.slice(0, 48)}...`
  return source
}

function summarizeSourceImages(images) {
  return images.map(summarizeImageSource)
}

function readImageFile(file, index) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error(`${file.name} 不是图片文件`))
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return Promise.reject(new Error(`${file.name} 超过 10MB，建议压缩后再上传`))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({
      id: `upload-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      url: String(reader.result),
    })
    reader.onerror = () => reject(new Error(`${file.name} 读取失败`))
    reader.readAsDataURL(file)
  })
}

function getInputModeLabel(value) {
  return VIDEO_INPUT_MODES.find((mode) => mode.value === value)?.label || value
}

export default function VideoGenerator({ onGenerated }) {
  const [prompt, setPrompt] = useState('')
  const [inputMode, setInputMode] = useState('text')
  const [imageUrl, setImageUrl] = useState('')
  const [multiImageUrls, setMultiImageUrls] = useState('')
  const [startFrameUrl, setStartFrameUrl] = useState('')
  const [endFrameUrl, setEndFrameUrl] = useState('')
  const [uploadedImages, setUploadedImages] = useState([])
  const [numFrames, setNumFrames] = useState(121)
  const [frameRate, setFrameRate] = useState(24)
  const [durationPreset, setDurationPreset] = useState('5')
  const [resolution, setResolution] = useState('720x1280')
  const [seed, setSeed] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [videoMeta, setVideoMeta] = useState(null)
  const pollingRef = useRef(null)
  const hasApiKey = Boolean(getApiKey().trim())

  const handleDurationChange = (value) => {
    setDurationPreset(value)
    const preset = findDurationPreset(value)
    if (preset) {
      setNumFrames(framesFromDuration(preset.seconds, frameRate))
    }
  }

  const handleFrameRateChange = (value) => {
    const nextFrameRate = Number(value)
    setFrameRate(nextFrameRate)
    const preset = findDurationPreset(durationPreset)
    if (preset) {
      setNumFrames(framesFromDuration(preset.seconds, nextFrameRate))
    }
  }

  const handleNumFramesChange = (value) => {
    setDurationPreset('custom')
    setNumFrames(normalizeVideoFrames(value))
  }

  const handleReferenceUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    try {
      const references = await Promise.all(files.map(readImageFile))
      setUploadedImages((current) => [...current, ...references])
      setError('')
    } catch (e) {
      setError(e.message || '参考图读取失败')
    }
  }

  const removeUploadedImage = (imageId) => {
    setUploadedImages((current) => current.filter((image) => image.id !== imageId))
  }

  const buildVideoInputs = () => {
    const uploadedUrls = uploadedImages.map((image) => image.url)

    if (inputMode === 'image') {
      const url = imageUrl.trim() || uploadedUrls[0]
      if (!url) throw new Error('请上传 1 张图生视频参考图，或填写参考图 URL')
      return {
        requestInputs: { image: url },
        sourceImages: [url],
        mode: undefined,
      }
    }

    if (inputMode === 'multi-image') {
      const urls = [...parseImageUrls(multiImageUrls), ...uploadedUrls]
      if (urls.length < 1) throw new Error('多图参考需要至少 1 张图片，请上传图片或填写 URL')
      return {
        requestInputs: { images: urls },
        sourceImages: urls,
        mode: undefined,
      }
    }

    if (inputMode === 'keyframes') {
      const urls = [
        startFrameUrl.trim() || uploadedUrls[0],
        endFrameUrl.trim() || uploadedUrls[1],
      ].filter(Boolean)
      if (urls.length < 1) throw new Error('首尾帧需要参考图，请上传图片或填写 URL')
      return {
        requestInputs: { images: urls, mode: 'keyframes' },
        sourceImages: urls,
        mode: 'keyframes',
      }
    }

    return {
      requestInputs: {},
      sourceImages: [],
      mode: undefined,
    }
  }

  const buildParameterSummary = ({ finalPrompt, sourceImages, mode }) => ({
    status: 'creating',
    prompt: finalPrompt,
    parameters: {
      inputMode,
      inputModeLabel: getInputModeLabel(inputMode),
      sourceImages: summarizeSourceImages(sourceImages),
      mode,
      size: resolution,
      numFrames: normalizeVideoFrames(numFrames),
      frameRate,
      duration: formatVideoDuration(normalizeVideoFrames(numFrames), frameRate),
      seed: seed || undefined,
      negativePrompt: negativePrompt.trim() || undefined,
    },
  })

  const pollStatus = async ({ videoId, taskId, finalPrompt, sourceImages, mode }) => {
    const sourceImageSummary = summarizeSourceImages(sourceImages)
    setStatus('视频已提交，正在排队处理...')
    setVideoMeta({
      videoId,
      taskId,
      prompt: finalPrompt,
      parameters: {
        inputMode,
        inputModeLabel: getInputModeLabel(inputMode),
        sourceImages: sourceImageSummary,
        mode,
      },
    })
    const startedAt = Date.now()
    let errorCount = 0

    await wait(VIDEO_POLL_INITIAL_DELAY_MS)

    const poll = async () => {
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs > VIDEO_POLL_TIMEOUT_MS) {
        setError(
          taskId
            ? `轮询超时（${formatElapsed(VIDEO_POLL_TIMEOUT_MS)}）。已使用 task_id 查询：${taskId}，可稍后重试。`
            : `轮询超时（${formatElapsed(VIDEO_POLL_TIMEOUT_MS)}）。创建响应没有返回 task_id，只能回退到 video_id 查询。`,
        )
        setStatus('')
        setLoading(false)
        return
      }

      try {
        const res = taskId ? await getVideoStatus(taskId) : await getVideoStatusByVideoId(videoId)
        const videoStatus = extractVideoStatus(res)
        const videoUrl = extractVideoUrl(res)
        const providerError = extractVideoError(res)
        const progress = extractVideoProgress(res)
        const queuePosition = extractQueuePosition(res)
        errorCount = 0

        setVideoMeta({
          videoId,
          taskId,
          status: videoStatus || 'unknown',
          progress,
          queuePosition,
          prompt: finalPrompt,
          parameters: {
            inputMode,
            inputModeLabel: getInputModeLabel(inputMode),
            sourceImages: sourceImageSummary,
            mode,
          },
          lastResponse: summarizeVideoResponse(res, 700),
        })

        if (videoUrl && (!videoStatus || isVideoStatusSuccess(videoStatus))) {
          setResult(videoUrl)
          setStatus('视频生成完成！')
          setLoading(false)
          addHistory({
            type: 'video',
            prompt: prompt.trim(),
            finalPrompt,
            status: 'completed',
          result: videoUrl,
          videoId,
          taskId,
          inputMode,
          sourceImages: sourceImageSummary,
        })
          onGenerated?.()
          return
        }

        if (isVideoStatusFailure(videoStatus)) {
          setError(providerError || '视频生成失败')
          setStatus('')
          setLoading(false)
          return
        }

        let progressInfo = `视频生成中... 已等待 ${formatElapsed(elapsedMs)}`
        if (progress) progressInfo += ` | 进度: ${progress}`
        if (queuePosition) progressInfo += ` | 队列位置: ${queuePosition}`
        if (videoId) progressInfo += ` | video_id: ${videoId}`
        setStatus(progressInfo)
        pollingRef.current = setTimeout(poll, VIDEO_POLL_INTERVAL_MS)
      } catch (e) {
        errorCount += 1
        setVideoMeta({
          videoId,
          taskId,
          httpStatus: e.status || '',
          lastPollError: e.message || '查询失败',
          retryable: isRetryablePollingError(e),
          prompt: finalPrompt,
          parameters: {
            inputMode,
            inputModeLabel: getInputModeLabel(inputMode),
            sourceImages: sourceImageSummary,
            mode,
          },
        })

        if (isFatalPollingError(e)) {
          setError(e.message || '视频查询失败')
          setStatus('')
          setLoading(false)
          return
        }

        const retryDelay = nextPollDelay(errorCount)
        const suffix = isRetryablePollingError(e)
          ? `Agnes 网关繁忙，${Math.round(retryDelay / 1000)}秒后自动重试`
          : `最近查询失败，${Math.round(retryDelay / 1000)}秒后自动重试`
        setStatus(`视频生成中... 已等待 ${formatElapsed(elapsedMs)} | ${suffix}：${e.message || '未知错误'}`)
        pollingRef.current = setTimeout(poll, retryDelay)
      }
    }

    poll()
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('请输入描述'); return }
    let videoInputs
    try {
      videoInputs = buildVideoInputs()
    } catch (e) {
      setError(e.message || '视频输入不完整')
      return
    }

    if (pollingRef.current) clearTimeout(pollingRef.current)
    setLoading(true)
    setError('')
    setResult(null)
    setVideoMeta(null)
    setStatus('正在提交视频任务，最多等待 120 秒返回 video_id...')

    try {
      const finalPrompt = prompt.trim()
      const params = {
        prompt: finalPrompt,
        num_frames: normalizeVideoFrames(numFrames),
        frame_rate: frameRate,
        size: resolution,
      }
      if (seed) params.seed = parseInt(seed)
      if (negativePrompt.trim()) params.negative_prompt = negativePrompt.trim()
      Object.assign(params, videoInputs.requestInputs)
      setVideoMeta(buildParameterSummary({
        finalPrompt,
        sourceImages: videoInputs.sourceImages,
        mode: videoInputs.mode,
      }))

      const res = await generateVideo(params)
      const ids = extractVideoCreateIds(res)
      setVideoMeta({
        videoId: ids.videoId,
        taskId: ids.taskId,
        prompt: finalPrompt,
        parameters: buildParameterSummary({
          finalPrompt,
          sourceImages: videoInputs.sourceImages,
          mode: videoInputs.mode,
        }).parameters,
        createResponse: summarizeVideoResponse(res, 700),
      })

      if (ids.directUrl) {
        setResult(ids.directUrl)
        setStatus('视频生成完成！')
        setLoading(false)
        addHistory({
          type: 'video',
          prompt: prompt.trim(),
          finalPrompt,
          status: 'completed',
          result: ids.directUrl,
          videoId: ids.videoId,
          taskId: ids.taskId,
          inputMode,
          sourceImages: summarizeSourceImages(videoInputs.sourceImages),
        })
        onGenerated?.()
      } else if (ids.videoId || ids.taskId) {
        pollStatus({
          videoId: ids.videoId,
          taskId: ids.taskId,
          finalPrompt,
          sourceImages: videoInputs.sourceImages,
          mode: videoInputs.mode,
        })
      } else {
        setError(`未获取到视频 ID 或结果。创建响应：${summarizeVideoResponse(res, 500)}`)
        setStatus('')
        setLoading(false)
      }
    } catch (e) {
      setError(e.message || '生成失败')
      setStatus('')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">视频生成</h2>

      {!hasApiKey && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
          请先在「设置」页面配置 API Key
        </div>
      )}

      {/* Prompt 输入 */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">视频描述 (Prompt)</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="输入视频描述，例如：一只小猫咪在阳光下伸懒腰，毛发随风飘动"
          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>

      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-300">视频输入</h3>
          <p className="mt-1 text-xs text-gray-500">Agnes Video v2.0 支持文生视频、单图图生视频、多图参考和首尾帧模式。</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {VIDEO_INPUT_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setInputMode(mode.value)}
              className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                inputMode === mode.value
                  ? 'border-purple-400 bg-purple-500/15 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="block text-sm font-medium">{mode.label}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">{mode.description}</span>
            </button>
          ))}
        </div>

        {inputMode !== 'text' && (
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-300">上传参考图</p>
                <p className="mt-1 text-[10px] leading-4 text-gray-600">
                  支持本地图片。图生视频使用第一张；多图参考会合并所有上传图；首尾帧默认使用前两张。
                </p>
              </div>
              <label className="shrink-0 cursor-pointer rounded-md bg-gray-800 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReferenceUpload}
                  className="hidden"
                />
              </label>
            </div>
            {uploadedImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {uploadedImages.map((image, index) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                    <img src={image.url} alt={image.name} className="aspect-square w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-gray-950/80 px-1.5 py-0.5 text-[10px] text-gray-200">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(image.id)}
                      className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-gray-200 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {inputMode === 'image' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">参考图 URL（可选，优先于上传图）</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="可填写图片 URL；留空则使用第一张上传图"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {inputMode === 'multi-image' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">多图参考 URL（每行一张，可和上传图混用）</label>
            <textarea
              value={multiImageUrls}
              onChange={e => setMultiImageUrls(e.target.value)}
              placeholder={'https://example.com/reference-1.png\nhttps://example.com/reference-2.png'}
              className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        )}

        {inputMode === 'keyframes' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">开始帧 URL（可选）</label>
              <input
                type="url"
                value={startFrameUrl}
                onChange={e => setStartFrameUrl(e.target.value)}
                placeholder="留空则使用第 1 张上传图"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">结束帧 URL（可选）</label>
              <input
                type="url"
                value={endFrameUrl}
                onChange={e => setEndFrameUrl(e.target.value)}
                placeholder="留空则使用第 2 张上传图"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 生成参数 */}
      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">生成参数</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">时长</label>
            <select
              value={durationPreset}
              onChange={e => handleDurationChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {VIDEO_DURATION_PRESETS.map(preset => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
              <option value="custom">自定义帧数</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1">
              实际约 {formatVideoDuration(numFrames, frameRate)}，发送 {normalizeVideoFrames(numFrames)} 帧
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">帧数 (num_frames)</label>
            <input
              type="number"
              value={numFrames}
              onChange={e => handleNumFramesChange(e.target.value)}
              min={9}
              max={441}
              step={8}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">必须为 8n+1，最大 441</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">帧率 (frame_rate)</label>
            <select
              value={frameRate}
              onChange={e => handleFrameRateChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {VIDEO_FRAME_RATES.map(r => (
                <option key={r} value={r}>{r} fps {r === 24 ? '(推荐)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">分辨率 (size)</label>
            <select
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {VIDEO_RESOLUTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">随机种子 (seed)</label>
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              placeholder="留空则随机"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">相同 seed 可复现结果</p>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">负面提示词 (negative_prompt)</label>
          <textarea
            value={negativePrompt}
            onChange={e => setNegativePrompt(e.target.value)}
            placeholder="不想出现在视频里的内容，可留空"
            className="w-full h-20 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>
      </div>

      {/* Video ID 显示 */}
      {videoMeta && (videoMeta.videoId || videoMeta.taskId) && (
        <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          {videoMeta.videoId && (
            <p className="text-xs text-gray-400">Video ID: <span className="text-gray-300 font-mono">{videoMeta.videoId}</span></p>
          )}
          {videoMeta.taskId && (
            <p className="mt-1 text-xs text-gray-400">Task ID: <span className="text-gray-300 font-mono">{videoMeta.taskId}</span></p>
          )}
        </div>
      )}

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
            处理中...
          </>
        ) : '生成视频'}
      </button>

      {/* 状态信息 */}
      {status && !result && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{status}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {videoMeta && (
        <details className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-xs text-gray-400">
          <summary className="cursor-pointer text-gray-300">视频调试信息</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(videoMeta, null, 2)}
          </pre>
        </details>
      )}

      {/* 生成结果 */}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            视频生成完成！
          </p>
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <video src={result} controls className="w-full" />
            <div className="p-3 flex gap-2">
              <a
                href={result}
                download="agnes-video.mp4"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs text-white"
              >
                下载视频
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
              >
                复制链接
              </button>
              <button
                onClick={() => {
                  setResult(null)
                  setStatus('')
                  setVideoMeta(null)
                }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
              >
                重新生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
