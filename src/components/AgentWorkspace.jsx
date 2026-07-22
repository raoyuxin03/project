import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  chatCompletion,
  editImageByProvider,
  fetchAixorasMediaBlob,
  generateImageByProvider,
  generateVideo,
  getImageAuthorizedHeaders,
  getImageModel,
  getImageProvider,
  getImageProviderOption,
  getApiKey,
  getBaseUrl,
  getVideoStatusByVideoId,
  getVideoStatus,
  setImageProvider,
  uploadPublicMedia,
  IMAGE_PROVIDER_OPTIONS,
  VIDEO_POLL_INITIAL_DELAY_MS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_TIMEOUT_MS,
  VIDEO_MODEL_OPTIONS,
} from '../api'
import { deleteSavedAsset, getSavedAssets, saveSavedAsset, saveSavedAssets } from '../assetStore'
import { addHistory, getSavedCanvasGraph, getSavedScript, saveCanvasGraph, saveScript } from '../store'
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

const STARTER_MESSAGES = [
  {
    role: 'assistant',
    content: '可以直接聊天，也可以上传参考图后生成图片或视频。',
  },
]

const WORKFLOW_MODES = [
  { value: 'chat', label: '聊天', description: 'Agnes 2.0 Flash' },
  { value: 'image', label: '图片', description: '文生图 / 图生图' },
  { value: 'video', label: '视频', description: '文生视频 / 图生视频' },
]

const WORKSPACE_PANELS = [
  { value: 'canvas', label: '连线画布' },
  { value: 'script', label: '剧本' },
]

const ASSET_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
]

const CANVAS_NODE_TEMPLATES = [
  { value: 'role', label: '角色', icon: '人' },
  { value: 'scene', label: '场景', icon: '景' },
  { value: 'video', label: '视频', icon: '▶' },
  { value: 'image', label: '图片', icon: '图' },
  { value: 'text', label: '文本', icon: '文' },
  { value: 'audio', label: '音频', icon: '音' },
]

const ASSET_URL_TYPES = [
  { value: 'image', label: '图片 URL' },
  { value: 'video', label: '视频 URL' },
  { value: 'audio', label: '音频 URL' },
]

const SIZE_OPTIONS = [
  { label: '方图 1:1', value: '1:1' },
  { label: '竖图 9:16', value: '9:16' },
  { label: '横图 16:9', value: '16:9' },
  { label: '小红书 3:4', value: '3:4' },
  { label: '横图 4:3', value: '4:3' },
]

const VIDEO_INPUT_MODES = [
  { value: 'text', label: '文生视频', description: '仅使用提示词' },
  { value: 'image', label: '单图图生视频', description: '当前引用图或选中图片' },
  { value: 'multi-image', label: '多图参考', description: '两张或更多参考图' },
  { value: 'keyframes', label: '首尾帧', description: '前两张作为首尾帧' },
]

const SEEDANCE_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '1:1', label: '1:1 方形' },
  { value: '4:3', label: '4:3 横屏' },
  { value: '3:4', label: '3:4 竖屏' },
  { value: '21:9', label: '21:9 宽银幕' },
]
const SEEDANCE_DURATION_OPTIONS = Array.from({ length: 15 }, (_, index) => {
  const seconds = index + 1
  return { value: String(seconds), label: `${seconds} 秒` }
})
const SEEDANCE_RESOLUTION_OPTIONS = VIDEO_MODEL_OPTIONS
  .filter((model) => isAixorasVideoProvider(model.provider))
  .map((model) => ({
    value: model.id,
    label: `${model.resolution || '默认'} · ${model.badge || 'Aixoras'} · ${model.label.replace(/^即梦\s*/, '').replace(/^Seedance\s*/, '')}`,
  }))
const SEEDANCE_IMAGE_REFERENCE_LIMIT = 9
const SEEDANCE_VIDEO_REFERENCE_LIMIT = 3
const SEEDANCE_AUDIO_REFERENCE_LIMIT = 3

const MAX_MENTION_REFERENCES = 8

const CHAT_SYSTEM_PROMPT =
  '你是 AI工作台创作助手。用中文清晰、直接地回答用户，也可以帮助整理图片提示词、视频提示词、分镜、参考图使用方案和下一步创作操作。'

const AIXORAS_REFERENCE_URL_ERROR =
  'Seedance / Aixoras 参考素材需要公网图片、视频或音频 URL。已尝试自动转换本地/粘贴素材，但没有拿到可用 URL；请改用更小的文件，或导入可公开访问的媒体 URL。'

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REFERENCE_IMAGE_DIMENSION = 1920
const MAX_VIDEO_REFERENCE_IMAGE_DIMENSION = 1920
const MAX_VIDEO_REFERENCE_IMAGE_RETRY_DIMENSION = 1280
const MAX_LOCAL_ASSET_BYTES = 120 * 1024 * 1024
const SEEDANCE_MOTION_GUIDE_SHORT_EDGE = 720
const SEEDANCE_MOTION_GUIDE_MAX_SECONDS = 4
const SEEDANCE_MOTION_GUIDE_FPS = 24

function isAixorasVideoProvider(provider) {
  return provider === 'aixoras' || provider === 'aixoras-chat'
}

function getNowMs() {
  return Date.now()
}

function getVideoModeLabel(value) {
  return VIDEO_INPUT_MODES.find((mode) => mode.value === value)?.label || value
}

function getAspectRatioOutputHint(aspectRatio, resolution) {
  const ratio = String(aspectRatio || '16:9')
  const orientation = ratio === '9:16' || ratio === '3:4'
    ? '竖屏'
    : ratio === '16:9' || ratio === '4:3' || ratio === '21:9'
      ? '横屏'
      : '方形'
  const composition = orientation === '竖屏'
    ? '保持竖屏全身或七分身穿搭构图，不要输出横屏，不要裁成半身，不要左右黑边。'
    : '严格保持所选画幅，不要自动改成其他比例，不要加黑边。'

  return `输出硬约束：成片必须是 ${ratio} ${orientation}，清晰度 ${resolution || '所选清晰度'}。${composition}`
}

function getSeedanceReferencePriorityHint() {
  return '参考优先级：图片参考是人物、服装、背景、光线和画质的主锚点；视频参考只作为动作节奏参考，忽略视频中的人物长相、服装、背景、字幕、贴纸、小人图、水印和 logo。'
}

function normalizeMentionText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function getMentionReferenceTypeName(reference) {
  if (reference?.type === 'video') return '视频'
  if (reference?.type === 'audio') return '音频'
  return '图片'
}

function getPromptReferenceMentionLabel(reference, index) {
  if (reference?.mentionLabel) return reference.mentionLabel
  return `${getMentionReferenceTypeName(reference)}${index + 1}`
}

function getInlineMentionId(reference) {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `mention-${getNowMs()}-${randomPart}-${reference?.id || 'reference'}`
}

function getMentionPreviewLabel(reference, index) {
  const label = normalizeMentionText(reference?.name || reference?.prompt || reference?.finalPrompt || getPromptReferenceMentionLabel(reference, index))
    .replace(/^上传参考图[:：]\s*/, '')
    .replace(/^粘贴参考图[:：]\s*/, '')
    .replace(/^粘贴视频[:：]\s*/, '')
    .replace(/^粘贴音频[:：]\s*/, '')
    .replace(/^上传视频[:：]\s*/, '')
    .replace(/^上传音频[:：]\s*/, '')
    .replace(/^提示词引用图[:：]\s*/, '')
  return label.slice(0, 24) || '参考素材'
}

function getAssetMentionFromInput(value, cursor) {
  const beforeCursor = value.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex < 0) return null

  const query = beforeCursor.slice(atIndex + 1)
  if (query.length > 40 || /[\s，。；;：:,、）)】\]]/.test(query)) return null

  return {
    open: true,
    query,
    start: atIndex,
    end: cursor,
  }
}

function matchesPromptReferenceMention(reference, index, query) {
  if (!query) return true
  const target = normalizeMentionText(`${getPromptReferenceMentionLabel(reference, index)} ${reference?.name || ''} ${reference?.prompt || ''}`).toLowerCase()
  return target.includes(query.toLowerCase())
}

function createInlineMentionPreview(reference) {
  const source = getAssetReferenceUrl(reference)

  if (reference?.type === 'video') {
    const video = document.createElement('video')
    video.src = source
    video.muted = true
    video.playsInline = true
    video.className = 'h-7 w-7 rounded object-cover ring-1 ring-white/15'
    return video
  }

  if (reference?.type === 'audio') {
    const audio = document.createElement('span')
    audio.className = 'flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] ring-1 ring-white/15'
    audio.textContent = '音'
    return audio
  }

  const image = document.createElement('img')
  image.src = source
  image.alt = ''
  image.className = 'h-7 w-7 rounded object-cover ring-1 ring-white/15'
  return image
}

function createInlineMentionNode(reference, index) {
  const token = document.createElement('span')
  const label = `@${getPromptReferenceMentionLabel(reference, index)}`
  token.contentEditable = 'false'
  token.dataset.mentionToken = 'true'
  token.dataset.referenceId = reference.id
  token.dataset.mentionId = getInlineMentionId(reference)
  token.dataset.label = label
  token.className = 'inline-flex max-w-[220px] items-center gap-1.5 rounded-md bg-slate-700 px-1.5 py-1 text-sm font-semibold text-white shadow-sm align-middle'

  const text = document.createElement('span')
  text.className = 'truncate'
  text.textContent = label

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.dataset.removeMention = 'true'
  remove.className = 'flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white'
  remove.setAttribute('aria-label', '移除 @ 引用')
  remove.textContent = '×'

  token.append(createInlineMentionPreview(reference), text, remove)
  return token
}

function getMentionReferenceLookup(references) {
  const lookup = new Map()
  references.forEach((reference, index) => {
    lookup.set(getPromptReferenceMentionLabel(reference, index), { reference, index })
  })
  return lookup
}

function replaceReferenceMentionsInTextNode(textNode, references, { moveCaret = false } = {}) {
  const text = textNode?.nodeValue || ''
  if (!text || !/@(?:图片|视频|音频)\d+/.test(text)) return 0

  const lookup = getMentionReferenceLookup(references)
  const fragment = document.createDocumentFragment()
  const pattern = /@((?:图片|视频|音频)\d+)/g
  let lastIndex = 0
  let replacedCount = 0
  let lastInsertedNode = null
  let match

  while ((match = pattern.exec(text))) {
    const [rawMention, label] = match
    const found = lookup.get(label)

    if (match.index > lastIndex) {
      const textPart = document.createTextNode(text.slice(lastIndex, match.index))
      fragment.append(textPart)
    }

    if (found) {
      const token = createInlineMentionNode(found.reference, found.index)
      fragment.append(token)
      lastInsertedNode = token
      replacedCount += 1
    } else {
      const textPart = document.createTextNode(rawMention)
      fragment.append(textPart)
      lastInsertedNode = textPart
    }

    lastIndex = match.index + rawMention.length
  }

  if (!replacedCount) return 0

  if (lastIndex < text.length) {
    const textPart = document.createTextNode(text.slice(lastIndex))
    fragment.append(textPart)
    lastInsertedNode = textPart
  }

  const parent = textNode.parentNode
  if (!parent) return 0
  parent.replaceChild(fragment, textNode)

  if (moveCaret && lastInsertedNode) {
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStartAfter(lastInsertedNode)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  return replacedCount
}

function autoLinkReferenceMentions(root, references) {
  if (!root) return 0
  const textNodes = []

  const visit = (node) => {
    if (node.nodeType === 3) {
      textNodes.push(node)
      return
    }

    if (node.nodeType !== 1) return
    if (node.dataset?.mentionToken) return

    node.childNodes.forEach(visit)
  }

  root.childNodes.forEach(visit)
  return textNodes.reduce((count, node) => (
    count + replaceReferenceMentionsInTextNode(node, references)
  ), 0)
}

function getEditorPlainText(root) {
  if (!root) return ''

  const collect = (node) => {
    if (node.nodeType === 3) return node.nodeValue || ''
    if (node.nodeType !== 1) return ''

    const element = node
    if (element.dataset?.mentionToken) return ` ${element.dataset.label || ''} `
    if (element.dataset?.removeMention) return ''
    if (element.nodeName === 'BR') return '\n'

    let text = ''
    element.childNodes.forEach((child) => {
      text += collect(child)
    })
    if (['DIV', 'P'].includes(element.nodeName)) text += '\n'
    return text
  }

  return collect(root).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n')
}

function insertTextAtSelection(text) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  return node
}

function summarizeImageSource(source) {
  if (!source) return source
  if (source.startsWith('data:')) return `${source.slice(0, 48)}...`
  return source
}

function summarizeSourceImages(images) {
  return images.map(summarizeImageSource)
}

function getSeedanceReferenceGroups(assets) {
  const groups = {
    images: [],
    videos: [],
    audios: [],
    other: [],
  }

  assets.forEach((asset) => {
    if (asset?.type === 'image') groups.images.push(asset)
    else if (asset?.type === 'video') groups.videos.push(asset)
    else if (asset?.type === 'audio') groups.audios.push(asset)
    else groups.other.push(asset)
  })

  return groups
}

function getSeedanceLimitedReferences(assets) {
  const groups = getSeedanceReferenceGroups(assets)
  return [
    ...groups.images.slice(0, SEEDANCE_IMAGE_REFERENCE_LIMIT),
    ...groups.videos.slice(0, SEEDANCE_VIDEO_REFERENCE_LIMIT),
    ...groups.audios.slice(0, SEEDANCE_AUDIO_REFERENCE_LIMIT),
  ]
}

function getAssetTypeReferenceName(asset) {
  if (asset?.type === 'video') return '视频'
  if (asset?.type === 'audio') return '音频'
  return '图'
}

function isDataImageSource(source) {
  return typeof source === 'string' && source.startsWith('data:image/')
}

function isLocalMediaSource(source) {
  return typeof source === 'string' && /^(data|blob):/i.test(source)
}

function isRemoteMediaSource(source) {
  return typeof source === 'string' && /^https?:\/\//i.test(source)
}

function isRemoteImageSource(source) {
  return isRemoteMediaSource(source)
}

function getVideoImageInput(source) {
  if (isDataImageSource(source)) {
    return source.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
  }
  return source
}

function resizeImageDataUrl(dataUrl, { maxDimension, quality }) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      if (!width || !height) {
        resolve(dataUrl)
        return
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')

      if (!context) {
        resolve(dataUrl)
        return
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

function normalizeImageDataUrl(dataUrl) {
  return resizeImageDataUrl(dataUrl, {
    maxDimension: MAX_REFERENCE_IMAGE_DIMENSION,
    quality: 0.92,
  })
}

function normalizeVideoImageDataUrl(dataUrl, retry = false) {
  return resizeImageDataUrl(dataUrl, {
    maxDimension: retry ? MAX_VIDEO_REFERENCE_IMAGE_RETRY_DIMENSION : MAX_VIDEO_REFERENCE_IMAGE_DIMENSION,
    quality: retry ? 0.78 : 0.9,
  })
}

function getMimeFileExtension(type) {
  const cleanType = String(type || '').toLowerCase().split(';')[0]
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/opus': 'opus',
  }
  return extensions[cleanType] || cleanType.split('/')[1]?.replace(/[^a-z0-9]+/g, '') || 'bin'
}

function getFallbackMimeType(asset) {
  if (asset?.type === 'video') return 'video/mp4'
  if (asset?.type === 'audio') return 'audio/mpeg'
  if (asset?.type === 'image') return 'image/jpeg'
  return 'application/octet-stream'
}

function getSafeUploadName(fileName, extension, fallback = 'reference-media') {
  const baseName = String(fileName || fallback)
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return `${baseName || fallback}.${extension || 'bin'}`
}

async function mediaSourceToFile(source, fileName, fallbackType = 'application/octet-stream') {
  const response = await fetch(source)
  const blob = await response.blob()
  const type = blob.type || fallbackType
  const extension = getMimeFileExtension(type)
  const safeName = getSafeUploadName(fileName, extension)
  return new File([blob], safeName, { type })
}

async function dataUrlToFile(dataUrl, fileName, fallbackType = 'image/jpeg') {
  return mediaSourceToFile(dataUrl, fileName, fallbackType)
}

async function imageReferenceToFile(reference, index) {
  const source = getAssetReferenceUrl(reference)
  if (!source) throw new Error('参考图没有可用地址。')

  const fallbackName = reference?.name || `image2-reference-${index + 1}`
  const blob = await fetchOriginalAssetBlob(source)
  const type = blob.type || 'image/png'
  const extension = getMimeFileExtension(type)
  const safeName = getSafeUploadName(fallbackName, extension, `image2-reference-${index + 1}`)
  return new File([blob], safeName, { type })
}

function getDownloadBaseName(asset, index, fallback = 'agnes-image') {
  const rawName = asset?.name || asset?.prompt || asset?.finalPrompt || `${fallback}-${index + 1}`
  return String(rawName)
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || `${fallback}-${index + 1}`
}

function triggerDownload(url, fileName) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function normalizeDownloadSource(source) {
  if (!source) return ''
  const cleanSource = String(source).trim()
  if (cleanSource.startsWith('data:') || cleanSource.startsWith('blob:') || cleanSource.startsWith('/')) return cleanSource

  try {
    const parsed = new URL(cleanSource)
    if (parsed.hostname === 'api.aixoras.com') {
      return `/aixoras-proxy${parsed.pathname}${parsed.search}`
    }
    if (parsed.hostname === 'api.change2pro.com') {
      return `/change2pro-proxy${parsed.pathname}${parsed.search}`
    }
    if (parsed.hostname === 'apihub.agnes-ai.com') {
      return `/api-proxy${parsed.pathname}${parsed.search}`
    }
  } catch {
    return cleanSource
  }

  return cleanSource
}

function getDownloadProxySource(source) {
  const cleanSource = String(source || '').trim()
  if (!/^https?:\/\//i.test(cleanSource)) return ''
  return `/media-download-proxy?url=${encodeURIComponent(cleanSource)}`
}

function getDownloadHeaders(source) {
  if (source.startsWith('/aixoras-proxy')) {
    return getImageAuthorizedHeaders('aixoras')
  }

  if (source.startsWith('/change2pro-proxy')) {
    return getImageAuthorizedHeaders('change2pro-images')
  }

  if (source.startsWith('/api-proxy')) {
    const token = getApiKey().trim()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return {}
}

async function fetchOriginalAssetBlob(source) {
  const directSource = normalizeDownloadSource(source)
  const proxySource = getDownloadProxySource(source)
  const attempts = [directSource, proxySource].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index)
  let lastError = null

  for (const attemptSource of attempts) {
    try {
      const response = await fetch(attemptSource, { headers: getDownloadHeaders(attemptSource) })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.blob()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('无法读取原图文件')
}

async function downloadAssetOriginal(asset, index) {
  const source = getAssetPlaybackUrl(asset)
  if (!source) throw new Error('没有可下载的原图地址。')

  const blob = await fetchOriginalAssetBlob(source)
  const type = blob.type || getFallbackMimeType(asset)
  const extension = getMimeFileExtension(type)
  const fileName = `${getDownloadBaseName(asset, index, 'agnes-image')}.${extension}`
  const objectUrl = URL.createObjectURL(new Blob([blob], { type }))

  try {
    triggerDownload(objectUrl, fileName)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
  }
}

function getSupportedVideoRecorderType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return ''
  }

  return [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function getMotionGuideDimensions(sourceWidth, sourceHeight) {
  const portrait = sourceHeight >= sourceWidth
  const ratio = portrait
    ? sourceHeight / Math.max(1, sourceWidth)
    : sourceWidth / Math.max(1, sourceHeight)
  const longEdge = Math.round(SEEDANCE_MOTION_GUIDE_SHORT_EDGE * Math.min(Math.max(ratio, 1), 16 / 9))

  return portrait
    ? { width: SEEDANCE_MOTION_GUIDE_SHORT_EDGE, height: longEdge }
    : { width: longEdge, height: SEEDANCE_MOTION_GUIDE_SHORT_EDGE }
}

function getCoverCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight, insetRatio = 0) {
  const insetX = sourceWidth * insetRatio
  const insetY = sourceHeight * insetRatio
  const availableWidth = Math.max(1, sourceWidth - insetX * 2)
  const availableHeight = Math.max(1, sourceHeight - insetY * 2)
  const sourceRatio = availableWidth / availableHeight
  const targetRatio = targetWidth / targetHeight

  if (sourceRatio > targetRatio) {
    const width = availableHeight * targetRatio
    return {
      sx: insetX + (availableWidth - width) / 2,
      sy: insetY,
      sw: width,
      sh: availableHeight,
    }
  }

  const height = availableWidth / targetRatio
  return {
    sx: insetX,
    sy: insetY + (availableHeight - height) / 2,
    sw: availableWidth,
    sh: height,
  }
}

function waitForMediaEvent(element, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      element.removeEventListener(eventName, handleEvent)
      element.removeEventListener('error', handleError)
    }
    const handleEvent = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('视频参考读取失败，已改用原始文件上传。'))
    }

    element.addEventListener(eventName, handleEvent, { once: true })
    element.addEventListener('error', handleError, { once: true })
  })
}

async function createSeedanceMotionGuideFile(source, asset, index) {
  const recorderType = getSupportedVideoRecorderType()
  const canRecord = recorderType
    && typeof document !== 'undefined'
    && typeof requestAnimationFrame === 'function'

  if (!canRecord) {
    return mediaSourceToFile(source, asset.name || asset.prompt || `seedance-video-${index + 1}`, getFallbackMimeType(asset))
  }

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const metadataReady = waitForMediaEvent(video, 'loadedmetadata')
  video.src = source

  try {
    await metadataReady
  } catch {
    return mediaSourceToFile(source, asset.name || asset.prompt || `seedance-video-${index + 1}`, getFallbackMimeType(asset))
  }

  const sourceWidth = video.videoWidth || 720
  const sourceHeight = video.videoHeight || 1280
  const { width, height } = getMotionGuideDimensions(sourceWidth, sourceHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context || typeof canvas.captureStream !== 'function') {
    return mediaSourceToFile(source, asset.name || asset.prompt || `seedance-video-${index + 1}`, getFallbackMimeType(asset))
  }

  const stream = canvas.captureStream(SEEDANCE_MOTION_GUIDE_FPS)
  const chunks = []
  const recorder = new MediaRecorder(stream, {
    mimeType: recorderType,
    videoBitsPerSecond: 2200000,
  })
  const finished = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data)
    }
    recorder.onerror = () => reject(new Error('动作参考清洗失败，已改用原始文件上传。'))
    recorder.onstop = () => resolve()
  })
  const crop = getCoverCropRect(sourceWidth, sourceHeight, width, height, 0.08)
  const maxSeconds = Math.min(
    Number.isFinite(video.duration) && video.duration > 0 ? video.duration : SEEDANCE_MOTION_GUIDE_MAX_SECONDS,
    SEEDANCE_MOTION_GUIDE_MAX_SECONDS,
  )

  const drawFrame = () => {
    context.fillStyle = '#f5f5f5'
    context.fillRect(0, 0, width, height)
    context.filter = 'grayscale(1) contrast(1.12) brightness(1.04)'
    context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
    context.filter = 'none'
  }

  try {
    video.currentTime = 0
    drawFrame()
    recorder.start(250)
    await video.play()
    await new Promise((resolve) => {
      const startedAt = video.currentTime
      const tick = () => {
        drawFrame()
        if (video.ended || video.paused || video.currentTime - startedAt >= maxSeconds) {
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    video.pause()
    recorder.stop()
    await finished
  } catch {
    stream.getTracks().forEach((track) => track.stop())
    return mediaSourceToFile(source, asset.name || asset.prompt || `seedance-video-${index + 1}`, getFallbackMimeType(asset))
  }

  stream.getTracks().forEach((track) => track.stop())
  if (!chunks.length) {
    return mediaSourceToFile(source, asset.name || asset.prompt || `seedance-video-${index + 1}`, getFallbackMimeType(asset))
  }

  const type = recorderType.split(';')[0] || 'video/webm'
  const extension = getMimeFileExtension(type)
  const safeName = getSafeUploadName(asset.name || asset.prompt || `seedance-motion-guide-${index + 1}`, extension)
  return new File(chunks, safeName, { type })
}

function getAssetTypeFromName(name) {
  const cleanName = String(name || '').split(/[?#]/)[0].toLowerCase()
  if (/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/.test(cleanName)) return 'image'
  if (/\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg)$/.test(cleanName)) return 'video'
  if (/\.(mp3|wav|m4a|aac|ogg|oga|flac|opus)$/.test(cleanName)) return 'audio'
  return ''
}

function getUrlAssetType(url) {
  try {
    const parsedUrl = new URL(url)
    return getAssetTypeFromName(parsedUrl.pathname)
  } catch {
    return getAssetTypeFromName(url)
  }
}

function getClipboardFiles(clipboardData) {
  const itemFiles = Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean)
  const directFiles = Array.from(clipboardData?.files || [])
  const seen = new Set()

  return [...itemFiles, ...directFiles].filter((file) => {
    const key = `${file.name || ''}:${file.type || ''}:${file.size || 0}:${file.lastModified || 0}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readImageFile(file, index) {
  if (getFileAssetType(file) !== 'image') {
    return Promise.reject(new Error(`${file.name} 不是图片文件`))
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return Promise.reject(new Error(`${file.name} 超过 10MB，建议压缩后再上传`))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      void normalizeImageDataUrl(String(reader.result))
        .then((url) => resolve({
          id: `upload-${getNowMs()}-${index}-${file.name || 'clipboard-image'}`,
          name: file.name || `剪贴板图片 ${index + 1}`,
          url,
          createdAt: new Date().toISOString(),
        }))
        .catch(() => resolve({
          id: `upload-${getNowMs()}-${index}-${file.name || 'clipboard-image'}`,
          name: file.name || `剪贴板图片 ${index + 1}`,
          url: String(reader.result),
          createdAt: new Date().toISOString(),
        }))
    }
    reader.onerror = () => reject(new Error(`${file.name || '图片'} 读取失败`))
    reader.readAsDataURL(file)
  })
}

async function readImageFileAsPublicUrl(file, index) {
  if (getFileAssetType(file) !== 'image') {
    throw new Error(`${file.name} 不是图片文件`)
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`${file.name} 超过 10MB，建议压缩后再上传`)
  }

  const localImage = await readImageFile(file, index)
  const normalizedDataUrl = await normalizeVideoImageDataUrl(localImage.url, false)
  const uploadFile = await dataUrlToFile(normalizedDataUrl, file.name || `seedance-reference-${index + 1}`)
  const publicUrl = await uploadPublicMedia(uploadFile)
  return {
    id: `public-upload-${getNowMs()}-${index}-${file.name || 'clipboard-image'}`,
    name: file.name || `公网参考图 ${index + 1}`,
    url: publicUrl,
    createdAt: new Date().toISOString(),
    publicUrl,
    originalLocalUrl: localImage.url,
    publicizedMaxDimension: MAX_VIDEO_REFERENCE_IMAGE_DIMENSION,
  }
}

function getFileAssetType(file) {
  const mimeType = String(file?.type || '')
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return getAssetTypeFromName(file?.name)
}

function getRemoteMediaAssetFromText(text) {
  const url = String(text || '').trim()
  if (!/^https?:\/\/\S+$/i.test(url)) return null

  const type = getUrlAssetType(url)
  if (!['video', 'audio'].includes(type)) return null

  return { type, url }
}

function getMediaReferenceLabel(assets) {
  const groups = getSeedanceReferenceGroups(assets)
  return [
    groups.images.length ? `${groups.images.length} 图` : '',
    groups.videos.length ? `${groups.videos.length} 视频` : '',
    groups.audios.length ? `${groups.audios.length} 音频` : '',
  ].filter(Boolean).join(' / ') || `${assets.length} 个素材`
}

function readAssetFile(file, index) {
  const type = getFileAssetType(file)
  if (!type || !['image', 'video', 'audio'].includes(type)) {
    return Promise.reject(new Error(`${file.name} 暂不支持，请上传图片、视频或音频文件`))
  }
  if (file.size > MAX_LOCAL_ASSET_BYTES) {
    return Promise.reject(new Error(`${file.name} 超过 120MB，建议压缩后再上传`))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({
      id: `asset-${getNowMs()}-${index}-${file.name || type}`,
      type,
      url: String(reader.result),
      prompt: file.name || `本地${getAssetTypeLabel({ type })} ${index + 1}`,
      finalPrompt: 'Local uploaded asset',
      createdAt: new Date().toISOString(),
      source: 'upload',
    })
    reader.onerror = () => reject(new Error(`${file.name || '文件'} 读取失败`))
    reader.readAsDataURL(file)
  })
}

function isLikelyImageBase64(value) {
  const text = String(value || '').trim()
  return text.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(text)
}

function normalizeExtractedImageValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^data:image\//i.test(text)) return text
  if (/^https?:\/\//i.test(text)) return text
  return isLikelyImageBase64(text) ? `data:image/png;base64,${text}` : ''
}

function extractImageUrls(response) {
  const urls = []
  const visited = new Set()

  const visit = (value, key = '', depth = 0) => {
    if (value === null || value === undefined || depth > 8) return

    if (typeof value === 'string') {
      const normalized = normalizeExtractedImageValue(value)
      if (normalized && (key || /^https?:|^data:image\//i.test(normalized))) urls.push(normalized)
      return
    }

    if (typeof value !== 'object' || visited.has(value)) return
    visited.add(value)

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key, depth + 1))
      return
    }

    for (const imageKey of ['url', 'image_url', 'b64_json', 'result']) {
      if (Object.prototype.hasOwnProperty.call(value, imageKey)) {
        visit(value[imageKey], imageKey, depth + 1)
      }
    }

    Object.entries(value).forEach(([entryKey, entryValue]) => {
      if (['url', 'image_url', 'b64_json', 'result'].includes(entryKey)) return
      visit(entryValue, entryKey, depth + 1)
    })
  }

  visit(response)
  return [...new Set(urls)]
}

function extractText(response) {
  return response?.choices?.[0]?.message?.content || response?.data?.choices?.[0]?.message?.content || ''
}

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

function isZeroLikeProgress(progress) {
  const value = String(progress || '').trim().toLowerCase()
  return value === '' || value === '0' || value === '0%' || value === '0.0' || value === '0.00'
}

function referenceLabel(reference, index) {
  const typeName = getAssetTypeReferenceName(reference)
  return reference.name ? `引用${typeName} ${index + 1}: ${reference.name}` : `引用${typeName} ${index + 1}`
}

function createPromptReferenceAsset(reference, index) {
  return {
    id: `prompt-reference-${reference.id}`,
    type: reference.type || 'image',
    url: getAssetReferenceUrl(reference),
    prompt: referenceLabel(reference, index),
    finalPrompt: reference.finalPrompt || 'Prompt reference media',
    createdAt: reference.createdAt,
    source: 'prompt-reference',
  }
}

function formatSeedanceReferenceMap(assets) {
  if (!assets.length) return ''

  const typeCounts = {}
  return assets
    .map((asset) => {
      const typeName = getAssetTypeReferenceName(asset)
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1
      const label = normalizeMentionText(asset.prompt || asset.finalPrompt || asset.name || `reference ${typeCounts[typeName]}`)
      return `输入${typeName}${typeCounts[typeName]} = ${label}`
    })
    .join('；')
}

function getAssetTypeLabel(asset) {
  if (asset?.type === 'video') return '视频'
  if (asset?.type === 'audio') return '音频'
  if (asset?.type === 'text') return '文本'
  return asset?.source === 'upload' ? '上传图' : '图片'
}

function getAssetPlaybackUrl(asset) {
  return asset?.playableUrl || asset?.url || ''
}

function getAssetReferenceUrl(asset) {
  return asset?.publicUrl || asset?.remoteUrl || asset?.url || ''
}

function getLocalAssetSource(asset) {
  return [
    asset?.originalLocalUrl,
    asset?.playableUrl,
    asset?.localUrl,
    asset?.url,
  ].find(isLocalMediaSource) || ''
}

function dedupeReferenceAssets(assets) {
  const seen = new Set()
  return assets.filter((asset) => {
    const key = `${asset?.type || 'image'}:${getAssetReferenceUrl(asset) || asset?.id || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getDefaultNodePosition(asset, index) {
  if (asset.type === 'video') return { x: 760, y: 120 + index * 160 }
  if (asset.type === 'audio') return { x: 620, y: 120 + index * 160 }
  if (asset.source === 'upload' || asset.source === 'prompt-reference') return { x: 80, y: 120 + index * 170 }
  return { x: 420, y: 120 + index * 170 }
}

function createAssetNode(asset, index) {
  return {
    id: `node-${asset.id}-${getNowMs()}`,
    type: 'assetNode',
    position: getDefaultNodePosition(asset, index),
    data: {
      nodeKind: ['image', 'video', 'audio'].includes(asset.type) ? asset.type : 'image',
      label: asset.prompt || getAssetTypeLabel(asset),
      assetId: asset.id,
      asset,
    },
  }
}

function createCanvasNode(nodeKind, index) {
  const template = CANVAS_NODE_TEMPLATES.find((item) => item.value === nodeKind)
  return {
    id: `node-${nodeKind}-${getNowMs()}-${index}`,
    type: 'assetNode',
    position: { x: 80 + (index % 3) * 240, y: 120 + Math.floor(index / 3) * 190 },
    data: {
      nodeKind,
      label: template?.label || '节点',
    },
  }
}

function toSerializableNode(node) {
  if (node.id === 'script-main') {
    return {
      ...node,
      data: { scriptNode: true },
    }
  }

  return {
    ...node,
    data: {
      nodeKind: node.data?.nodeKind,
      label: node.data?.label,
      assetId: node.data?.assetId,
    },
  }
}

function getCleanSavedGraph(savedGraph) {
  const nodes = (savedGraph.nodes || []).filter((node) => !String(node.id || '').startsWith('asset-'))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = (savedGraph.edges || []).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  return { nodes, edges }
}

function AssetPreview({ asset, controls = false, className = 'h-full w-full object-cover' }) {
  if (!asset) return null

  if (asset.type === 'video') {
    return <video src={getAssetPlaybackUrl(asset)} controls={controls} muted={!controls} className={className} />
  }

  if (asset.type === 'audio') {
    const audioClassName = /(^|\s)(h-|min-h-|aspect-)/.test(className)
      ? className.replace(/\s*object-cover\s*/g, ' ')
      : `${className.replace(/\s*object-cover\s*/g, ' ')} min-h-28`
    return (
      <div className={`flex flex-col items-center justify-center gap-3 bg-slate-100 px-3 text-center ${audioClassName}`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-500 shadow-sm">
          音频
        </span>
        {controls && <audio src={getAssetPlaybackUrl(asset)} controls className="w-full" />}
      </div>
    )
  }

  return <img src={asset.url} alt={asset.prompt || ''} className={className} />
}

function AssetFlowNode({ data }) {
  const asset = data.asset
  const nodeKind = data.nodeKind || asset?.type || 'image'
  const label = data.label || asset?.prompt || getAssetTypeLabel(asset)

  return (
    <div className="w-[168px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-400" />
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <span className="truncate text-[11px] font-semibold text-slate-500">{asset ? getAssetTypeLabel(asset) : label}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <div className="bg-slate-50 p-2">
        <div className="overflow-hidden rounded-xl bg-slate-100">
          {asset?.type === 'video' ? (
            <video src={getAssetPlaybackUrl(asset)} className="aspect-video w-full object-cover" muted />
          ) : asset?.type === 'image' ? (
            <img src={asset.url} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-2xl font-semibold text-slate-300">
              {CANVAS_NODE_TEMPLATES.find((item) => item.value === nodeKind)?.icon || '节'}
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-3">
        <p className="line-clamp-2 text-xs leading-5 text-slate-700">{label || '未命名节点'}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-violet-500" />
    </div>
  )
}

function ScriptFlowNode({ data }) {
  const text = data.scriptText?.trim()

  return (
    <div className="w-[190px] rounded-2xl border border-amber-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
      <div className="border-b border-amber-100 px-3 py-2">
        <p className="text-xs font-semibold text-amber-700">剧本</p>
      </div>
      <div className="px-3 py-3">
        <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-slate-600">
          {text || '在剧本页粘贴故事、分镜或角色设定。'}
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-amber-500" />
    </div>
  )
}

const FLOW_NODE_TYPES = {
  assetNode: AssetFlowNode,
  scriptNode: ScriptFlowNode,
}

export default function AgentWorkspace({ onGenerated, onNavigate, view = 'creator' }) {
  const isCreatorView = view === 'creator'
  const isCanvasView = view === 'canvas'
  const isAssetsView = view === 'assets'
  const savedGraph = useMemo(() => getCleanSavedGraph(getSavedCanvasGraph()), [])
  const [messages, setMessages] = useState(STARTER_MESSAGES)
  const [input, setInput] = useState('')
  const [workflowMode, setWorkflowMode] = useState('video')
  const [workspacePanel, setWorkspacePanel] = useState('canvas')
  const [promptReferences, setPromptReferences] = useState([])
  const [imageSize, setImageSize] = useState('1:1')
  const [imageProviderId, setImageProviderIdState] = useState(getImageProvider())
  const [videoSize, setVideoSize] = useState('720x1280')
  const [videoInputMode, setVideoInputMode] = useState('image')
  const [videoModelId, setVideoModelId] = useState(VIDEO_MODEL_OPTIONS[0]?.id || 'agnes-video-v2.0')
  const [seedanceDuration, setSeedanceDuration] = useState('5')
  const [seedanceAspectRatio, setSeedanceAspectRatio] = useState('16:9')
  const [confirmPaidSeedance, setConfirmPaidSeedance] = useState(false)
  const [videoDurationPreset, setVideoDurationPreset] = useState('5')
  const [videoNumFrames, setVideoNumFrames] = useState(121)
  const [videoFrameRate, setVideoFrameRate] = useState(24)
  const [videoSeed, setVideoSeed] = useState('')
  const [videoNegativePrompt, setVideoNegativePrompt] = useState('')
  const [videoReferenceIds, setVideoReferenceIds] = useState([])
  const [imageReferenceIds, setImageReferenceIds] = useState([])
  const [assets, setAssets] = useState([])
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [optimizingPrompt, setOptimizingPrompt] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)
  const [imagePreviewAssets, setImagePreviewAssets] = useState([])
  const [downloadingAssetId, setDownloadingAssetId] = useState('')
  const [previewAsset, setPreviewAsset] = useState(null)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [showReferencePicker, setShowReferencePicker] = useState(false)
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false)
  const [assetMention, setAssetMention] = useState({ open: false, query: '', start: 0, end: 0 })
  const [assetMentionPosition, setAssetMentionPosition] = useState(null)
  const [inlineMentions, setInlineMentions] = useState([])
  const [assetFilter, setAssetFilter] = useState('all')
  const [assetUrl, setAssetUrl] = useState('')
  const [assetUrlType, setAssetUrlType] = useState('image')
  const [assetUrlTitle, setAssetUrlTitle] = useState('')
  const [recoveringAssetId, setRecoveringAssetId] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [scriptText, setScriptText] = useState(() => getSavedScript())
  const [nodes, setNodes, onNodesChange] = useNodesState(savedGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(savedGraph.edges)
  const videoPollRunRef = useRef(0)
  const seedancePromptEditorRef = useRef(null)

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) || null,
    [assets, selectedId],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  )

  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'image'),
    [assets],
  )

  const mediaAssets = useMemo(
    () => assets.filter((asset) => ['image', 'video', 'audio'].includes(asset.type)),
    [assets],
  )

  const filteredAssets = useMemo(
    () => assetFilter === 'all' ? assets : assets.filter((asset) => asset.type === assetFilter),
    [assetFilter, assets],
  )

  const selectedVideoReferences = useMemo(
    () => videoReferenceIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset) => ['image', 'video', 'audio'].includes(asset?.type)),
    [assets, videoReferenceIds],
  )

  const promptReferenceAssets = useMemo(
    () => promptReferences.map(createPromptReferenceAsset),
    [promptReferences],
  )

  const selectedImageReferences = useMemo(
    () => imageReferenceIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset) => asset?.type === 'image'),
    [assets, imageReferenceIds],
  )

  const selectedVideoModel = useMemo(
    () => VIDEO_MODEL_OPTIONS.find((option) => option.id === videoModelId) || VIDEO_MODEL_OPTIONS[0],
    [videoModelId],
  )
  const selectedImageProvider = useMemo(
    () => getImageProviderOption(imageProviderId),
    [imageProviderId],
  )
  const selectedImageModel = getImageModel(imageProviderId)

  const isSeedanceModel = isAixorasVideoProvider(selectedVideoModel?.provider)
  const selectedVideoInputReferences = useMemo(
    () => isSeedanceModel
      ? selectedVideoReferences
      : selectedVideoReferences.filter((asset) => asset.type === 'image'),
    [isSeedanceModel, selectedVideoReferences],
  )
  const videoReferenceAssets = useMemo(
    () => isSeedanceModel ? mediaAssets : imageAssets,
    [imageAssets, isSeedanceModel, mediaAssets],
  )
  const usesInlineImagePrompt = workflowMode === 'image'
  const usesInlineVideoPrompt = workflowMode === 'video'
  const usesInlinePrompt = usesInlineImagePrompt || usesInlineVideoPrompt
  const showAssetMention = assetMention.open && usesInlinePrompt

  const referenceTrayItems = useMemo(() => {
    const typeCounts = { image: 0, video: 0, audio: 0 }
    const createTrayItem = (kind, reference, asset) => {
      const mediaType = asset?.type || reference?.type || 'image'
      typeCounts[mediaType] = (typeCounts[mediaType] || 0) + 1
      const mentionLabel = `${getMentionReferenceTypeName({ type: mediaType })}${typeCounts[mediaType]}`
      const normalizedReference = {
        ...(reference || asset),
        id: reference?.id || asset?.id,
        type: mediaType,
        url: getAssetReferenceUrl(asset || reference),
        mentionLabel,
      }
      const normalizedAsset = {
        ...(asset || normalizedReference),
        type: mediaType,
        url: getAssetReferenceUrl(asset || reference),
        mentionLabel,
      }

      return {
        key: `${kind}-${normalizedReference.id}`,
        kind,
        reference: normalizedReference,
        asset: normalizedAsset,
        mentionLabel,
      }
    }

    const promptItems = promptReferences.map((reference, index) => (
      createTrayItem('prompt', reference, createPromptReferenceAsset(reference, index))
    ))

    if (workflowMode === 'image') {
      const promptUrls = new Set(promptItems.map((item) => getAssetReferenceUrl(item.asset)))
      const selectedItems = selectedImageReferences
        .filter((asset) => !promptUrls.has(getAssetReferenceUrl(asset)))
        .map((asset) => createTrayItem('asset', asset, asset))

      return [...promptItems, ...selectedItems]
    }

    if (workflowMode !== 'video') return promptItems

    const promptUrls = new Set(promptItems.map((item) => getAssetReferenceUrl(item.asset)))
    const selectedItems = selectedVideoReferences
      .filter((asset) => !promptUrls.has(getAssetReferenceUrl(asset)))
      .map((asset) => createTrayItem('asset', asset, asset))

    return [...promptItems, ...selectedItems]
  }, [promptReferences, selectedImageReferences, selectedVideoReferences, workflowMode])

  const mentionableReferences = useMemo(
    () => referenceTrayItems.map((item) => item.reference),
    [referenceTrayItems],
  )

  const inlineMentionReferences = useMemo(
    () => inlineMentions
      .map((mention) => {
        const index = mentionableReferences.findIndex((reference) => reference.id === mention.referenceId)
        const reference = mentionableReferences[index]
        return reference ? { reference, index, mentionId: mention.mentionId } : null
      })
      .filter(Boolean),
    [inlineMentions, mentionableReferences],
  )

  const inlineMentionReferenceAssets = useMemo(() => {
    return inlineMentionReferences
      .map(({ reference, index, mentionId }) => ({
        ...createPromptReferenceAsset(reference, index),
        id: `prompt-reference-${reference.id}-${mentionId}`,
        mentionId,
      }))
  }, [inlineMentionReferences])

  const imageGenerationReferences = useMemo(
    () => dedupeReferenceAssets([
      ...(inlineMentionReferenceAssets.length ? inlineMentionReferenceAssets : promptReferenceAssets),
      ...selectedImageReferences,
    ]).filter((asset) => asset.type === 'image'),
    [inlineMentionReferenceAssets, promptReferenceAssets, selectedImageReferences],
  )

  const seedanceReferences = useMemo(
    () => dedupeReferenceAssets([
      ...(inlineMentionReferenceAssets.length ? inlineMentionReferenceAssets : promptReferenceAssets),
      ...selectedVideoReferences,
    ]),
    [inlineMentionReferenceAssets, promptReferenceAssets, selectedVideoReferences],
  )

  const seedanceLocalReferenceCount = useMemo(
    () => isSeedanceModel
      ? seedanceReferences.filter((asset) => getAssetReferenceUrl(asset) && !isRemoteMediaSource(getAssetReferenceUrl(asset))).length
      : 0,
    [isSeedanceModel, seedanceReferences],
  )

  const seedanceReferenceGroups = useMemo(
    () => getSeedanceReferenceGroups(seedanceReferences),
    [seedanceReferences],
  )

  const seedancePreflightIssue = useMemo(() => {
    if (!isSeedanceModel) return ''
    const seconds = Number(seedanceDuration)
    if (!input.trim()) return '请先填写视频提示词。'
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 15) return 'Seedance / Aixoras 时长需要选择 1 到 15 秒的整数秒。'
    if (seedanceReferences.length < 1) return '请先添加至少 1 个参考素材。'
    if (seedanceReferenceGroups.images.length > SEEDANCE_IMAGE_REFERENCE_LIMIT) return `Seedance / Aixoras 最多支持 ${SEEDANCE_IMAGE_REFERENCE_LIMIT} 张参考图。`
    if (seedanceReferenceGroups.videos.length > SEEDANCE_VIDEO_REFERENCE_LIMIT) return `Seedance / Aixoras 最多支持 ${SEEDANCE_VIDEO_REFERENCE_LIMIT} 段参考视频。`
    if (seedanceReferenceGroups.audios.length > SEEDANCE_AUDIO_REFERENCE_LIMIT) return `Seedance / Aixoras 最多支持 ${SEEDANCE_AUDIO_REFERENCE_LIMIT} 段参考音频。`
    if (!confirmPaidSeedance) return '请先勾选确认使用付费 Seedance / Aixoras 模型。'
    return ''
  }, [
    confirmPaidSeedance,
    input,
    isSeedanceModel,
    seedanceDuration,
    seedanceReferenceGroups,
    seedanceReferences.length,
  ])

  const assetMentionOptions = useMemo(() => {
    if (!showAssetMention) return []

    return mentionableReferences
      .map((reference, index) => ({ reference, index }))
      .filter(({ reference, index }) => matchesPromptReferenceMention(reference, index, assetMention.query))
      .slice(0, MAX_MENTION_REFERENCES)
  }, [assetMention.query, mentionableReferences, showAssetMention])

  const videoReferenceCount = videoInputMode === 'image'
    ? (promptReferenceAssets.length || (selectedAsset?.type === 'image' ? 1 : 0))
    : promptReferenceAssets.length + selectedVideoInputReferences.length

  const canGenerateVideo = !busy && !optimizingPrompt && (
    isSeedanceModel
      ? !seedancePreflightIssue
      : videoInputMode === 'text'
      ? Boolean(input.trim())
      : videoInputMode === 'image'
      ? Boolean(promptReferenceAssets[0] || selectedAsset?.type === 'image')
      : Boolean(input.trim()) && videoReferenceCount >= 1
  )

  const canGenerateImage = !busy && !optimizingPrompt && Boolean(input.trim() || imageGenerationReferences.length)
  const canSendChat = !busy && !optimizingPrompt && Boolean(input.trim())
  const canUseSelectedAssetAsVideoReference = Boolean(
    selectedAsset && (
      selectedAsset.type === 'image'
      || (isSeedanceModel && ['video', 'audio'].includes(selectedAsset.type))
    ),
  )

  const pushMessage = (message) => {
    setMessages((current) => [...current, message])
  }

  useEffect(() => {
    let mounted = true
    void getSavedAssets().then((savedAssets) => {
      if (!mounted) return
      setAssets(savedAssets)
      if (savedAssets[0]) setSelectedId(savedAssets[0].id)
      setAssetsLoaded(true)
    })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    saveScript(scriptText)
  }, [scriptText])

  useEffect(() => {
    if (!previewAsset) return undefined

    const handlePreviewKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewAsset(null)
      }
    }

    window.addEventListener('keydown', handlePreviewKeyDown)
    return () => window.removeEventListener('keydown', handlePreviewKeyDown)
  }, [previewAsset])

  useEffect(() => {
    if (!assetsLoaded) return

    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.id === 'script-main') {
          return { ...node, data: { ...node.data, scriptText } }
        }

        const asset = assets.find((item) => item.id === node.data?.assetId)
        return {
          ...node,
          data: {
            ...node.data,
            assetId: node.data?.assetId,
            asset,
          },
        }
      })
    })
  }, [assets, assetsLoaded, scriptText, setNodes])

  useEffect(() => {
    if (!assetsLoaded) return

    saveCanvasGraph({
      nodes: nodes.map(toSerializableNode),
      edges,
    })
  }, [nodes, edges, assetsLoaded])

  const onConnect = useCallback((connection) => {
    setEdges((currentEdges) => addEdge({
      ...connection,
      type: 'smoothstep',
      style: { stroke: '#64748b', strokeWidth: 1.8 },
    }, currentEdges))
  }, [setEdges])

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id)
    if (node.data?.assetId) setSelectedId(node.data.assetId)
  }, [])

  const saveAsset = (asset) => {
    setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)])
    setSelectedId(asset.id)
    void saveSavedAsset(asset)
  }

  const saveAssets = (nextAssets) => {
    setAssets((current) => [
      ...nextAssets,
      ...current.filter((item) => !nextAssets.some((asset) => asset.id === item.id)),
    ])
    if (nextAssets[0]) setSelectedId(nextAssets[0].id)
    void saveSavedAssets(nextAssets)
  }

  const addAssetNodeToCanvas = (asset) => {
    const node = createAssetNode(asset, nodes.length)
    const nextNodes = [...nodes, node]
    setNodes(nextNodes)
    saveCanvasGraph({
      nodes: nextNodes.map(toSerializableNode),
      edges,
    })
    setSelectedId(asset.id)
    setSelectedNodeId(node.id)
    onNavigate?.('canvas')
  }

  const addTemplateNodeToCanvas = (nodeKind) => {
    const node = createCanvasNode(nodeKind, nodes.length)
    setNodes((currentNodes) => [...currentNodes, node])
    setSelectedNodeId(node.id)
  }

  const addPromptReferences = async (files, origin = 'paste') => {
    if (!files.length) return

    try {
      const shouldUsePublicUrl = workflowMode === 'video' && isSeedanceModel
      setStatus(shouldUsePublicUrl
        ? `正在把 ${files.length} 张参考图上传成公网 URL，供 Seedance 读取...`
        : '')
      const uploadedImages = await Promise.all(
        files.map((file, index) => (
          shouldUsePublicUrl
            ? readImageFileAsPublicUrl(file, index)
            : readImageFile(file, index)
        )),
      )
      const references = uploadedImages.map((image) => ({
        ...image,
        origin,
        publicized: shouldUsePublicUrl,
      }))
      setPromptReferences((current) => [...current, ...references])
      saveAssets(references.map((reference, index) => ({
        ...createPromptReferenceAsset(reference, index),
        prompt: `${origin === 'paste' ? '粘贴参考图' : '上传参考图'}${shouldUsePublicUrl ? '（公网 URL）' : ''}：${reference.name || `引用图 ${index + 1}`}`,
        source: shouldUsePublicUrl ? 'public-url' : origin,
      })))
      setError('')
      setStatus(shouldUsePublicUrl ? `已上传 ${references.length} 张公网参考图，可用于 Seedance / Aixoras。` : '')
    } catch (e) {
      setError(e.message || '参考图读取或公网上传失败')
      setStatus('')
    }
  }

  const addMediaReferences = async (files, origin = 'paste') => {
    if (!files.length) return

    try {
      setStatus(`正在导入 ${files.length} 个视频/音频素材...`)
      const createdAssets = await Promise.all(files.map(readAssetFile))
      const mediaAssetsFromPaste = createdAssets
        .filter((asset) => ['video', 'audio'].includes(asset.type))
        .map((asset) => ({
          ...asset,
          source: origin,
          prompt: `${origin === 'paste' ? '粘贴' : '上传'}${getAssetTypeLabel(asset)}：${asset.prompt || getAssetTypeLabel(asset)}`,
        }))

      if (!mediaAssetsFromPaste.length) return

      saveAssets(mediaAssetsFromPaste)
      setVideoReferenceIds((current) => [
        ...current,
        ...mediaAssetsFromPaste.map((asset) => asset.id).filter((id) => !current.includes(id)),
      ])
      setError('')
      setStatus(
        isSeedanceModel
          ? `已粘贴 ${getMediaReferenceLabel(mediaAssetsFromPaste)}，并加入全能参考。本地视频生成时会先转成动作稿，再上传临时公网 URL。`
          : `已粘贴 ${getMediaReferenceLabel(mediaAssetsFromPaste)} 并保存到资产页；视频/音频参考需要切换到 Seedance / Aixoras 使用。`,
      )
    } catch (e) {
      setError(e.message || '视频/音频素材读取失败')
      setStatus('')
    }
  }

  const addRemoteMediaUrlReference = ({ type, url }) => {
    const asset = {
      id: `paste-url-${type}-${getNowMs()}`,
      type,
      url,
      prompt: `粘贴${getAssetTypeLabel({ type })} URL 素材`,
      finalPrompt: 'Pasted URL asset',
      createdAt: new Date().toISOString(),
      source: 'url',
    }
    saveAsset(asset)
    setVideoReferenceIds((current) => (current.includes(asset.id) ? current : [...current, asset.id]))
    setError('')
    setStatus(`已粘贴 ${getAssetTypeLabel(asset)} URL，并加入${isSeedanceModel ? '全能参考' : '视频参考'}。`)
  }

  const handlePromptPaste = (event) => {
    const files = getClipboardFiles(event.clipboardData)
    const imageFiles = files.filter((file) => getFileAssetType(file) === 'image')
    const mediaFiles = files.filter((file) => ['video', 'audio'].includes(getFileAssetType(file)))
    const text = event.clipboardData?.getData('text/plain') || ''
    const remoteMedia = workflowMode === 'video' ? getRemoteMediaAssetFromText(text) : null
    let handled = false

    if (imageFiles.length) {
      void addPromptReferences(imageFiles, 'paste')
      handled = true
    }

    if (workflowMode === 'video' && mediaFiles.length) {
      void addMediaReferences(mediaFiles, 'paste')
      handled = true
    }

    if (remoteMedia) {
      event.preventDefault()
      addRemoteMediaUrlReference(remoteMedia)
      handled = true
    }

    return handled
  }

  const handlePromptReferenceUpload = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setShowUploadMenu(false)
    void addPromptReferences(files, 'upload')
  }

  const removePromptReference = (referenceId) => {
    setPromptReferences((current) => current.filter((reference) => reference.id !== referenceId))
    setInlineMentions((current) => current.filter((mention) => mention.referenceId !== referenceId))
    const editor = seedancePromptEditorRef.current
    if (editor) {
      editor.querySelectorAll('[data-mention-token="true"]').forEach((node) => {
        if (node.dataset.referenceId === referenceId) node.remove()
      })
      syncSeedancePromptEditor()
    }
  }

  const removeVideoReference = (assetId) => {
    setVideoReferenceIds((current) => current.filter((id) => id !== assetId))
    setInlineMentions((current) => current.filter((mention) => mention.referenceId !== assetId))
    const editor = seedancePromptEditorRef.current
    if (editor) {
      editor.querySelectorAll('[data-mention-token="true"]').forEach((node) => {
        if (node.dataset.referenceId === assetId) node.remove()
      })
      syncSeedancePromptEditor()
    }
  }

  const removeImageReference = (assetId) => {
    setImageReferenceIds((current) => current.filter((id) => id !== assetId))
    setInlineMentions((current) => current.filter((mention) => mention.referenceId !== assetId))
    const editor = seedancePromptEditorRef.current
    if (editor) {
      editor.querySelectorAll('[data-mention-token="true"]').forEach((node) => {
        if (node.dataset.referenceId === assetId) node.remove()
      })
      syncSeedancePromptEditor()
    }
  }

  const clearReferenceTray = () => {
    setPromptReferences([])
    setInlineMentions([])
    if (workflowMode === 'video') setVideoReferenceIds([])
    if (workflowMode === 'image') setImageReferenceIds([])
    const editor = seedancePromptEditorRef.current
    if (editor) {
      editor.querySelectorAll('[data-mention-token="true"]').forEach((node) => node.remove())
      syncSeedancePromptEditor()
    }
  }

  const handlePromptInputChange = (event) => {
    const nextValue = event.target.value
    setInput(nextValue)

    if (!usesInlinePrompt) {
      setAssetMention((current) => ({ ...current, open: false }))
      setAssetMentionPosition(null)
      return
    }

    const cursor = event.target.selectionStart ?? nextValue.length
    const nextMention = getAssetMentionFromInput(nextValue, cursor)
    setAssetMention(nextMention || { open: false, query: '', start: cursor, end: cursor })
    setAssetMentionPosition(null)
  }

  const setSeedanceEditorText = (text) => {
    const editor = seedancePromptEditorRef.current
    if (editor) {
      editor.textContent = text || ''
    }
    setInlineMentions([])
    setAssetMention({ open: false, query: '', start: 0, end: 0 })
    setAssetMentionPosition(null)
    setInput(text || '')
  }

  const autoLinkPlainReferenceMentions = () => {
    const editor = seedancePromptEditorRef.current
    if (!editor) return 0
    return autoLinkReferenceMentions(editor, mentionableReferences)
  }

  const syncSeedancePromptEditor = () => {
    const editor = seedancePromptEditorRef.current
    if (!editor) return

    const text = getEditorPlainText(editor)
    setInput(text)
    setInlineMentions(Array.from(editor.querySelectorAll('[data-mention-token="true"]')).map((node) => ({
      mentionId: node.dataset.mentionId,
      referenceId: node.dataset.referenceId,
    })))

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      setAssetMention((current) => ({ ...current, open: false }))
      setAssetMentionPosition(null)
      return
    }

    const range = selection.getRangeAt(0)
    const caretRect = range.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const beforeRange = range.cloneRange()
    beforeRange.selectNodeContents(editor)
    beforeRange.setEnd(range.endContainer, range.endOffset)
    const beforeText = beforeRange.toString()
    const nextMention = getAssetMentionFromInput(beforeText, beforeText.length)
    setAssetMention(nextMention || { open: false, query: '', start: beforeText.length, end: beforeText.length })
    setAssetMentionPosition(nextMention && caretRect
      ? {
        top: Math.max(0, caretRect.bottom - editorRect.top + 8),
        left: Math.min(Math.max(0, caretRect.left - editorRect.left), Math.max(0, editorRect.width - 520)),
      }
      : null)
  }

  const addAssetToPromptReferences = (asset) => {
    if (asset?.type !== 'image') return

    const reference = {
      id: `canvas-${promptReferences.length}-${asset.id}`,
      type: 'image',
      name: asset.prompt || '画布图片',
      url: getAssetReferenceUrl(asset),
      createdAt: asset.createdAt,
      origin: 'canvas',
    }
    setPromptReferences((current) => [...current, reference])
    setShowUploadMenu(false)
  }

  const selectMentionReference = (reference, index) => {
    if (!reference?.url) return

    const editor = seedancePromptEditorRef.current
    if (editor) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (editor.contains(range.commonAncestorContainer)) {
          let node = range.startContainer
          let offset = range.startOffset
          if (node.nodeType !== 3) {
            const textNode = document.createTextNode('')
            range.insertNode(textNode)
            node = textNode
            offset = 0
          }

          const text = node.nodeValue || ''
          const before = text.slice(0, offset)
          const match = before.match(/@([^\s@，。；;：:,、）)】]{0,40})$/)
          if (match) {
            const start = offset - match[0].length
            node.nodeValue = `${text.slice(0, start)}${text.slice(offset)}`
            range.setStart(node, start)
            range.collapse(true)
          }

          const token = createInlineMentionNode(reference, index)
          const space = document.createTextNode('\u00a0')
          range.insertNode(token)
          token.after(space)
          range.setStartAfter(space)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          syncSeedancePromptEditor()
        }
      }
    } else {
      setInput((current) => {
        const start = Math.max(0, Math.min(assetMention.start, current.length))
        const end = Math.max(start, Math.min(assetMention.end, current.length))
        const before = current.slice(0, start)
        const after = current.slice(end)
        const spacer = after && !/^[\s，。；;：:,、）)】\]]/.test(after) ? ' ' : ''
        return `${before}@${getPromptReferenceMentionLabel(reference, index)}${spacer}${after}`
      })
    }
    setAssetMention({ open: false, query: '', start: 0, end: 0 })
    setAssetMentionPosition(null)
    setError('')
  }

  const addSelectedAssetToPromptReferences = () => {
    addAssetToPromptReferences(selectedAsset)
  }

  const addPromptReferenceToCanvas = (reference, index) => {
    const asset = {
      ...createPromptReferenceAsset(reference, index),
      id: `image-reference-${assets.length}-${reference.id}`,
      prompt: `提示词引用图：${reference.name || `引用图 ${index + 1}`}`,
      source: reference.origin || 'prompt-reference',
    }
    saveAsset(asset)
    setError('')
  }

  const handleAssetFileUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    try {
      const createdAssets = await Promise.all(files.map(readAssetFile))
      saveAssets(createdAssets)
      setError('')
      pushMessage({ role: 'assistant', content: `已导入 ${createdAssets.length} 个本地素材，并保存到资产页。` })
    } catch (e) {
      setError(e.message || '素材导入失败')
    }
  }

  const handleAddAssetUrl = () => {
    const url = assetUrl.trim()
    if (!url) {
      setError('请先输入素材 URL。')
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      setError('素材 URL 需要以 http:// 或 https:// 开头。')
      return
    }

    const asset = {
      id: `url-${assetUrlType}-${getNowMs()}`,
      type: assetUrlType,
      url,
      prompt: assetUrlTitle.trim() || `${getAssetTypeLabel({ type: assetUrlType })} URL 素材`,
      finalPrompt: 'URL imported asset',
      createdAt: new Date().toISOString(),
      source: 'url',
    }
    saveAsset(asset)
    setAssetUrl('')
    setAssetUrlTitle('')
    setError('')
  }

  const handleReferenceUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setShowUploadMenu(false)
    if (!files.length) return

    try {
      const shouldUsePublicUrl = workflowMode === 'video' && isSeedanceModel
      setStatus(shouldUsePublicUrl
        ? `正在把 ${files.length} 张参考图上传成公网 URL，供 Seedance 读取...`
        : '')
      const uploadedImages = await Promise.all(
        files.map((file, index) => (
          shouldUsePublicUrl
            ? readImageFileAsPublicUrl(file, index)
            : readImageFile(file, index)
        )),
      )
      const createdAssets = uploadedImages.map((image) => ({
        id: image.id,
        type: 'image',
        url: image.url,
        prompt: `上传参考图${shouldUsePublicUrl ? '（公网 URL）' : ''}：${image.name}`,
        finalPrompt: shouldUsePublicUrl ? 'Public URL reference image' : 'Uploaded reference image',
        createdAt: new Date().toISOString(),
        source: shouldUsePublicUrl ? 'public-url' : 'upload',
      }))

      saveAssets(createdAssets)
      if (workflowMode === 'image') {
        const uploadedIds = createdAssets.map((asset) => asset.id)
        setImageReferenceIds((current) => [
          ...current,
          ...uploadedIds.filter((id) => !current.includes(id)),
        ])
      } else if (workflowMode === 'video' && videoInputMode !== 'image') {
        const uploadedIds = createdAssets.map((asset) => asset.id)
        setVideoReferenceIds((current) => [
          ...current,
          ...uploadedIds.filter((id) => !current.includes(id)),
        ])
      }
      setError('')
      setStatus(shouldUsePublicUrl ? `已上传 ${createdAssets.length} 张公网参考图，可用于 Seedance / Aixoras。` : '')
      pushMessage({ role: 'assistant', content: `已上传 ${createdAssets.length} 张参考图，并保存到资产页。` })
    } catch (e) {
      setError(e.message || '参考图读取或公网上传失败')
      setStatus('')
    }
  }

  const toggleImageReference = (assetId) => {
    setImageReferenceIds((current) => (
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    ))
  }

  const toggleVideoReference = (assetId) => {
    setVideoReferenceIds((current) => (
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    ))
  }

  const removeAsset = (assetId) => {
    setAssets((current) => current.filter((asset) => asset.id !== assetId))
    setImageReferenceIds((current) => current.filter((id) => id !== assetId))
    setVideoReferenceIds((current) => current.filter((id) => id !== assetId))
    if (selectedId === assetId) setSelectedId(null)
    void deleteSavedAsset(assetId)
  }

  const recoverVideoAsset = async (asset) => {
    if (!asset || asset.type !== 'video') return
    const sourceUrl = asset.remoteUrl || asset.url
    if (!sourceUrl) {
      setError('这个视频素材没有可恢复的结果链接。')
      return
    }

    setRecoveringAssetId(asset.id)
    setError('')
    setStatus('正在用 Seedance 视频 API Key 取回视频文件...')

    try {
      const mediaBlob = await fetchAixorasMediaBlob(sourceUrl)
      const playableUrl = URL.createObjectURL(mediaBlob)
      const recoveredAsset = {
        ...asset,
        url: playableUrl,
        playableUrl,
        remoteUrl: sourceUrl,
        mediaFetchError: '',
        recoveredAt: new Date().toISOString(),
      }
      saveAsset(recoveredAsset)
      setStatus('视频文件已取回，可以在资产页播放或下载。')
    } catch (e) {
      setError(e.message || '取回视频文件失败，请确认 Seedance 视频 API Key 仍然有效。')
      setStatus('')
    } finally {
      setRecoveringAssetId('')
    }
  }

  const handleScriptUpload = (event) => {
    const [file] = Array.from(event.target.files || [])
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setScriptText(String(reader.result || ''))
      setWorkspacePanel('script')
      setError('')
    }
    reader.onerror = () => setError('剧本文件读取失败')
    reader.readAsText(file)
  }

  const useScriptAsPrompt = () => {
    const trimmed = scriptText.trim()
    if (!trimmed) {
      setError('请先在剧本页输入内容。')
      return
    }

    setWorkflowMode('video')
    setInput(trimmed.slice(0, 1800))
    if (isSeedanceModel) {
      setSeedanceEditorText(trimmed.slice(0, 1800))
    }
    setError('')
  }

  const structureScriptWithAI = async () => {
    const trimmed = scriptText.trim()
    if (!trimmed || busy || optimizingPrompt) return

    setBusy(true)
    setError('')
    setStatus('正在整理剧本结构...')

    try {
      const response = await chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              '你是短视频剧本策划。把用户剧本文本整理成中文分镜表，包含场次、画面、角色/资产、镜头运动、视频提示词。保留关键信息，输出可直接复制使用的结构化文本。',
          },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.35,
        max_tokens: 1600,
      })
      const answer = extractText(response).trim()
      if (!answer) throw new Error('模型没有返回剧本整理结果')
      setScriptText(answer)
      setWorkspacePanel('script')
      setStatus('剧本已整理，可复制到视频提示词或从画布连到素材。')
    } catch (e) {
      setError(e.message || '剧本整理失败')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const getVideoInputAssets = () => {
    if (isSeedanceModel) {
      if (!input.trim()) {
        throw new Error('Seedance 2.0 需要先输入视频提示词。')
      }
      if (!seedanceReferences.length) {
        throw new Error('Seedance / Aixoras 全能参考需要至少 1 个图片、视频或音频参考。')
      }
      return getSeedanceLimitedReferences(seedanceReferences)
    }

    if (videoInputMode === 'text') {
      if (!input.trim()) {
        throw new Error('文生视频需要先输入视频描述。')
      }
      return []
    }

    if (videoInputMode === 'image') {
      if (promptReferenceAssets[0]) return [promptReferenceAssets[0]]
      if (selectedAsset?.type !== 'image') {
        throw new Error('请先粘贴一张引用图，或在资产页选中一张图片用于图生视频。')
      }
      return [selectedAsset]
    }

    const combinedReferences = [...promptReferenceAssets, ...selectedVideoInputReferences]

    if (combinedReferences.length < 1) {
      throw new Error(videoInputMode === 'keyframes'
        ? '首尾帧模式需要参考图。可以先上传一张角色多视图图测试；如果要严格首尾帧，请上传 2 张。'
        : '多图参考模式需要至少 1 张参考图。')
    }

    if (videoInputMode === 'keyframes') {
      if (combinedReferences.length < 2) {
        throw new Error('首尾帧模式需要 2 张参考图。只有 1 张图时请切换到“单图图生视频”或“多图参考”。')
      }
      return combinedReferences.slice(0, 2)
    }

    return combinedReferences
  }

  const getVideoPromptContextAssets = () => {
    if (isSeedanceModel) return getSeedanceLimitedReferences(seedanceReferences)
    if (videoInputMode === 'text') return []
    if (videoInputMode === 'image') {
      if (promptReferenceAssets[0]) return [promptReferenceAssets[0]]
      return selectedAsset?.type === 'image' ? [selectedAsset] : []
    }

    const combinedReferences = [...promptReferenceAssets, ...selectedVideoInputReferences]
    return videoInputMode === 'keyframes' ? combinedReferences.slice(0, 2) : combinedReferences
  }

  const handleVideoDurationChange = (value) => {
    setVideoDurationPreset(value)
    const preset = findDurationPreset(value)
    if (preset) {
      setVideoNumFrames(framesFromDuration(preset.seconds, videoFrameRate))
    }
  }

  const handleVideoFrameRateChange = (value) => {
    const nextFrameRate = Number(value)
    setVideoFrameRate(nextFrameRate)
    const preset = findDurationPreset(videoDurationPreset)
    if (preset) {
      setVideoNumFrames(framesFromDuration(preset.seconds, nextFrameRate))
    }
  }

  const handleVideoNumFramesChange = (value) => {
    setVideoDurationPreset('custom')
    setVideoNumFrames(normalizeVideoFrames(value))
  }

  const handleVideoModelChange = (value) => {
    const nextModel = VIDEO_MODEL_OPTIONS.find((option) => option.id === value) || VIDEO_MODEL_OPTIONS[0]
    setVideoModelId(nextModel.id)
    setConfirmPaidSeedance(false)
    if (isAixorasVideoProvider(nextModel.provider)) {
      setShowAdvancedPanel(false)
    }
  }

  const handleImageProviderChange = (value) => {
    const nextProvider = getImageProviderOption(value)
    setImageProviderIdState(nextProvider.id)
    setImageProvider(nextProvider.id)
  }

  const handleSendChat = async () => {
    const content = input.trim()
    if (!content || busy) return

    const nextMessages = [...messages, { role: 'user', content, references: promptReferences.map((reference) => ({ ...reference })) }]
    setMessages(nextMessages)
    setInput('')
    setBusy(true)
    setError('')
    setDebugInfo(null)
    setStatus('AI工作台正在回复...')

    try {
      const response = await chatCompletion({
        messages: [
          { role: 'system', content: CHAT_SYSTEM_PROMPT },
          ...nextMessages
            .filter((message) => message.role !== 'system')
            .map((message) => ({ role: message.role, content: message.content })),
        ],
        temperature: 0.7,
        max_tokens: 1400,
      })
      const answer = extractText(response).trim() || '模型没有返回文本内容。'
      pushMessage({ role: 'assistant', content: answer })
      setStatus('')
    } catch (e) {
      setError(e.message || '聊天请求失败')
      setMessages(messages)
      setInput(content)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = () => {
    if (workflowMode === 'chat') {
      void handleSendChat()
      return
    }
    if (workflowMode === 'image') {
      void handleGenerateImage()
      return
    }
    void handleGenerateVideo()
  }

  const handleInputKeyDown = (event) => {
    if (showAssetMention) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAssetMention((current) => ({ ...current, open: false }))
        return
      }

      if (event.key === 'Enter' && !event.shiftKey && assetMentionOptions[0]) {
        event.preventDefault()
        selectMentionReference(assetMentionOptions[0].reference, assetMentionOptions[0].index)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handleGenerateImage = async () => {
    const prompt = input.trim()
    if ((!prompt && !imageGenerationReferences.length) || busy) return

    const referenceSnapshot = imageGenerationReferences.map((reference) => ({ ...reference }))
    const referenceUrls = referenceSnapshot.map((reference) => getAssetReferenceUrl(reference))
    const userMessage = prompt || '使用引用图生成图片'
    const providerLabel = selectedImageProvider.label
    const providerModel = selectedImageModel

    setBusy(true)
    setError('')
    setDebugInfo(null)
    setStatus(referenceUrls.length ? `正在用 ${providerLabel} 基于第 1 张引用图生成图片，通常需要 1-3 分钟...` : `正在用 ${providerLabel} 生成图片，通常需要 1-3 分钟...`)
    pushMessage({ role: 'user', content: userMessage, references: referenceSnapshot })
    setSeedanceEditorText('')

    try {
      const finalPrompt = prompt || 'Create a faithful image variation based on the attached reference image.'
      const imageResponse = referenceSnapshot.length
        ? await editImageByProvider({
            provider: imageProviderId,
            prompt: finalPrompt,
            image: await imageReferenceToFile(referenceSnapshot[0], 0),
            size: imageSize,
          })
        : await generateImageByProvider({
            provider: imageProviderId,
            prompt: finalPrompt,
            size: imageSize,
            aspect_ratio: imageSize,
          })
      const urls = extractImageUrls(imageResponse)

      if (!urls.length) {
        throw new Error('图片生成完成，但没有拿到可用图片地址。')
      }

      const sourceImages = summarizeSourceImages(referenceUrls)
      const createdAssets = urls.map((url, index) => ({
        id: `image-${getNowMs()}-${index}`,
        type: 'image',
        url,
        prompt: userMessage,
        finalPrompt,
        sourceImages,
        provider: imageProviderId,
        providerLabel,
        model: providerModel,
        aspectRatio: imageSize,
        createdAt: new Date().toISOString(),
      }))

      saveAssets(createdAssets)
      setImagePreviewAssets(createdAssets)
      addHistory({
        type: 'image',
        prompt: userMessage,
        finalPrompt,
        status: 'completed',
        result: urls[0],
        sourceImages,
        provider: imageProviderId,
        providerLabel,
        model: providerModel,
      })
      onGenerated?.()

      pushMessage({
        role: 'assistant',
        content: referenceUrls.length
          ? `已用 ${providerLabel} 基于第 1 张引用图生成 ${urls.length} 张图片，并保存到资产页。`
          : `已用 ${providerLabel} 生成 ${urls.length} 张图片，并保存到资产页。`,
      })
      setStatus('')
    } catch (e) {
      const message = e.timeout
        ? `${e.message} ${providerLabel} 图生图可能仍在服务端排队或生成；请稍后重试，或先换更小的参考图/较短提示词。`
        : e.message || '生成图片失败'
      setError(message)
      pushMessage({ role: 'assistant', content: `生成失败：${message}` })
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadImageAsset = async (asset, index) => {
    if (!asset || downloadingAssetId) return

    setDownloadingAssetId(asset.id)
    setError('')
    setStatus('正在下载原图...')

    try {
      await downloadAssetOriginal(asset, index)
      setStatus('原图下载已开始。')
    } catch (e) {
      const message = e.message === 'Failed to fetch'
        ? '下载原图失败：远程图片服务器禁止浏览器直接读取，已尝试本地代理仍失败。请确认本地服务仍在运行。'
        : e.message || '原图下载失败'
      setError(message)
      setStatus('')
    } finally {
      setDownloadingAssetId('')
    }
  }

  const handleDownloadAllImageAssets = async () => {
    if (downloadingAssetId || !imagePreviewAssets.length) return

    setError('')
    setStatus(`正在下载 ${imagePreviewAssets.length} 张原图...`)

    try {
      for (const [index, asset] of imagePreviewAssets.entries()) {
        setDownloadingAssetId(asset.id)
        await downloadAssetOriginal(asset, index)
        await wait(250)
      }
      setStatus('全部原图下载已开始。')
    } catch (e) {
      setError(e.message || '批量下载原图失败')
      setStatus('')
    } finally {
      setDownloadingAssetId('')
    }
  }

  const polishVideoPrompt = async (rawPrompt, sourcePrompt) => {
    try {
      const chat = await chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Rewrite the user idea into one concise English video generation prompt for the selected video model. If reference images are present, preserve their identity, subject, motion, camera movement, lighting, composition, and constraints. Return only the prompt.',
          },
          {
            role: 'user',
            content: `Source image prompt: ${sourcePrompt || 'N/A'}\nVideo request: ${rawPrompt}`,
          },
        ],
        temperature: 0.35,
        max_tokens: 220,
      })
      return extractText(chat).trim() || rawPrompt
    } catch {
      return rawPrompt
    }
  }

  const handleOptimizeVideoPrompt = async () => {
    if (busy || optimizingPrompt || workflowMode !== 'video') return

    const rawPrompt = input.trim()
    const contextAssets = getVideoPromptContextAssets()
    if (!rawPrompt && !contextAssets.length) {
      setError('请先写一句视频描述，或上传参考图后再优化提示词。')
      return
    }

    const sourcePrompt = contextAssets
      .map((asset, index) => `${getAssetTypeReferenceName(asset)} ${index + 1}: ${asset.finalPrompt || asset.prompt}`)
      .join('\n')
    const fallbackPrompt = rawPrompt
      || `Animate ${contextAssets.length} reference media item${contextAssets.length > 1 ? 's' : ''} into a cinematic short video: ${sourcePrompt}`

    setOptimizingPrompt(true)
    setError('')
    setStatus('正在优化视频提示词...')

    try {
      const finalPrompt = await polishVideoPrompt(fallbackPrompt, sourcePrompt)
      if (isSeedanceModel) {
        setSeedanceEditorText(finalPrompt)
      } else {
        setInput(finalPrompt)
      }
      setStatus('视频提示词已优化，可以继续编辑或直接生成。')
    } catch (e) {
      setError(e.message || '优化视频提示词失败')
      setStatus('')
    } finally {
      setOptimizingPrompt(false)
    }
  }

  const markAixorasReferencePublicized = (asset, localUrl, publicUrl, options = {}) => {
    if (!localUrl || !publicUrl || localUrl === publicUrl) return

    const publicizedAt = new Date().toISOString()
    const isMotionGuide = options.kind === 'motion-guide'

    setPromptReferences((current) => current.map((reference) => {
      const referenceUrl = getAssetReferenceUrl(reference)
      const matches = reference.id === asset.id
        || asset.id === `prompt-reference-${reference.id}`
        || referenceUrl === localUrl
        || reference.url === localUrl
        || reference.originalLocalUrl === localUrl

      if (!matches) {
        return reference
      }

      return {
        ...reference,
        url: isMotionGuide ? reference.url : publicUrl,
        publicUrl: isMotionGuide ? reference.publicUrl : publicUrl,
        motionGuideUrl: isMotionGuide ? publicUrl : reference.motionGuideUrl,
        originalLocalUrl: reference.originalLocalUrl || reference.url,
        publicized: true,
        publicizedMaxDimension: options.publicizedMaxDimension || reference.publicizedMaxDimension,
        publicizedAt,
      }
    }))

    setAssets((current) => {
      const updatedAssets = []
      const nextAssets = current.map((item) => {
        const itemUrl = getAssetReferenceUrl(item)
        const matches = item.id === asset.id
          || itemUrl === localUrl
          || item.url === localUrl
          || item.originalLocalUrl === localUrl
        if (!matches) return item

        const updatedAsset = {
          ...item,
          url: isMotionGuide ? item.url : publicUrl,
          publicUrl: isMotionGuide ? item.publicUrl : publicUrl,
          motionGuideUrl: isMotionGuide ? publicUrl : item.motionGuideUrl,
          playableUrl: item.playableUrl || item.url,
          originalLocalUrl: item.originalLocalUrl || item.url,
          publicized: true,
          publicizedMaxDimension: options.publicizedMaxDimension || item.publicizedMaxDimension,
          publicizedAt,
          source: item.source === 'url' ? 'url' : 'public-url',
        }
        updatedAssets.push(updatedAsset)
        return updatedAsset
      })

      if (updatedAssets.length) void saveSavedAssets(updatedAssets)
      return updatedAssets.length ? nextAssets : current
    })
  }

  const publicizeAixorasReferenceAsset = async (asset, index, retry = false) => {
    const referenceUrl = getAssetReferenceUrl(asset)
    const localSource = getLocalAssetSource(asset)
    const desiredImageDimension = retry
      ? MAX_VIDEO_REFERENCE_IMAGE_RETRY_DIMENSION
      : MAX_VIDEO_REFERENCE_IMAGE_DIMENSION

    if (asset.type === 'video' && isRemoteMediaSource(asset.motionGuideUrl)) {
      return {
        ...asset,
        videoInputUrl: asset.motionGuideUrl,
      }
    }

    if (
      isRemoteMediaSource(referenceUrl)
      && asset.type !== 'video'
      && !(asset.type === 'image' && localSource && asset.publicizedMaxDimension !== desiredImageDimension)
    ) {
      return {
        ...asset,
        videoInputUrl: referenceUrl,
      }
    }

    if (isRemoteMediaSource(referenceUrl) && asset.type === 'video' && !localSource) {
      return {
        ...asset,
        videoInputUrl: referenceUrl,
      }
    }

    const sourceForUpload = localSource || referenceUrl

    if (!isLocalMediaSource(sourceForUpload)) {
      throw new Error(AIXORAS_REFERENCE_URL_ERROR)
    }

    const typeName = getMentionReferenceTypeName(asset)
    setStatus(`正在把第 ${index + 1} 个${typeName}参考${asset.type === 'video' ? '清洗为动作参考并' : ''}上传成临时公网 URL...`)
    let uploadFile

    if (asset.type === 'image' && isDataImageSource(sourceForUpload)) {
      const uploadSource = await normalizeVideoImageDataUrl(sourceForUpload, retry)
      uploadFile = await mediaSourceToFile(
        uploadSource,
        asset.name || asset.prompt || `seedance-image-${index + 1}`,
        getFallbackMimeType(asset),
      )
    } else if (asset.type === 'video') {
      uploadFile = await createSeedanceMotionGuideFile(sourceForUpload, asset, index)
    } else {
      uploadFile = await mediaSourceToFile(
        sourceForUpload,
        asset.name || asset.prompt || `seedance-${asset.type || 'media'}-${index + 1}`,
        getFallbackMimeType(asset),
      )
    }
    const publicUrl = await uploadPublicMedia(uploadFile)

    if (!isRemoteMediaSource(publicUrl)) {
      throw new Error(AIXORAS_REFERENCE_URL_ERROR)
    }

    markAixorasReferencePublicized(asset, sourceForUpload, publicUrl, {
      kind: asset.type === 'video' ? 'motion-guide' : 'public-reference',
      publicizedMaxDimension: asset.type === 'image' ? desiredImageDimension : undefined,
    })
    return {
      ...asset,
      url: asset.type === 'video' ? asset.url : publicUrl,
      publicUrl: asset.type === 'video' ? asset.publicUrl : publicUrl,
      motionGuideUrl: asset.type === 'video' ? publicUrl : asset.motionGuideUrl,
      playableUrl: asset.playableUrl || sourceForUpload,
      videoInputUrl: publicUrl,
      originalLocalUrl: asset.originalLocalUrl || sourceForUpload,
      publicized: true,
      publicizedMaxDimension: asset.type === 'image' ? desiredImageDimension : asset.publicizedMaxDimension,
      publicizedAt: new Date().toISOString(),
    }
  }

  const prepareVideoInputAssets = async (videoInputAssets, options = {}) => {
    const { retry = false, provider = 'agnes' } = options
    const preparedAssets = []

    for (let index = 0; index < videoInputAssets.length; index += 1) {
      const asset = videoInputAssets[index]
      const referenceUrl = getAssetReferenceUrl(asset)

      if (isAixorasVideoProvider(provider)) {
        preparedAssets.push(await publicizeAixorasReferenceAsset(asset, index, retry))
        continue
      }

      if (asset.type !== 'image') {
        throw new Error('当前 Agnes 视频模型只支持图片参考；视频或音频参考请切换到 Seedance / Aixoras。')
      }

      if (isRemoteImageSource(referenceUrl)) {
        preparedAssets.push({
          ...asset,
          videoInputUrl: referenceUrl,
        })
        continue
      }

      if (!isDataImageSource(referenceUrl)) {
        throw new Error('视频参考图需要是可访问的图片 URL。')
      }

      setStatus(`正在准备第 ${index + 1} 张参考图，${retry ? '轻量压缩后' : ''}转换成视频接口可识别的 base64...`)
      const normalizedUrl = await normalizeVideoImageDataUrl(referenceUrl, retry)
      const videoInputUrl = provider === 'aixoras' ? normalizedUrl : getVideoImageInput(normalizedUrl)
      const preparedAsset = {
        ...asset,
        id: `prepared-${getNowMs()}-${index}-${asset.id}`,
        url: referenceUrl,
        videoInputUrl,
        sourceImages: summarizeSourceImages([normalizedUrl]),
        preparedFrom: referenceUrl,
        preparedAt: new Date().toISOString(),
      }

      preparedAssets.push(preparedAsset)
    }

    return preparedAssets
  }

  const createVideoTask = async ({ videoInputAssets, finalPrompt, baseParameters, apiMode, retry = false }) => {
    const preparedVideoInputAssets = await prepareVideoInputAssets(videoInputAssets, {
      retry,
      provider: selectedVideoModel.provider,
    })
    const sourceMediaUrls = preparedVideoInputAssets.map((asset) => asset.videoInputUrl || asset.url)
    const sourceMediaSummary = summarizeSourceImages(sourceMediaUrls)
    const seedancePreparedGroups = getSeedanceReferenceGroups(preparedVideoInputAssets)
    const seedanceReferenceUrls = {
      images: seedancePreparedGroups.images.map((asset) => asset.videoInputUrl || asset.url),
      videos: seedancePreparedGroups.videos.map((asset) => asset.videoInputUrl || asset.url),
      audios: seedancePreparedGroups.audios.map((asset) => asset.videoInputUrl || asset.url),
    }
    const videoParametersSummary = {
      ...baseParameters,
      sourceImages: sourceMediaSummary,
      sourceMedia: sourceMediaSummary,
      originalSourceImages: baseParameters.sourceImages,
      compressedReference: retry,
    }
    const baseUrlHint = selectedVideoModel.provider === 'agnes' && getBaseUrl() !== '/api-proxy'
      ? '；当前为直连，超时会自动回退到 /api-proxy'
      : ''
    setStatus(`正在提交${selectedVideoModel.label}${retry ? '（轻量参考图重试）' : ''}任务，等待返回任务 ID${baseUrlHint}...`)
    setDebugInfo({
      status: 'creating',
      prompt: finalPrompt,
      parameters: videoParametersSummary,
    })

    const videoParameters = {
      provider: selectedVideoModel.provider,
      model: selectedVideoModel.model,
      prompt: finalPrompt,
      images: isSeedanceModel ? seedanceReferenceUrls.images : sourceMediaUrls,
      videos: isSeedanceModel ? seedanceReferenceUrls.videos : [],
      audios: isSeedanceModel ? seedanceReferenceUrls.audios : [],
      mode: isSeedanceModel ? undefined : apiMode,
      size: isSeedanceModel ? seedanceAspectRatio : videoSize,
      num_frames: isSeedanceModel ? undefined : normalizeVideoFrames(videoNumFrames),
      frame_rate: isSeedanceModel ? undefined : videoFrameRate,
      duration: isSeedanceModel
        ? Number(seedanceDuration)
        : Math.max(1, Math.round(normalizeVideoFrames(videoNumFrames) / videoFrameRate)),
      resolution: selectedVideoModel.resolution,
      aspect_ratio: isSeedanceModel ? seedanceAspectRatio : undefined,
    }
    if (!isSeedanceModel && videoSeed) videoParameters.seed = parseInt(videoSeed)
    if (!isSeedanceModel && videoNegativePrompt.trim()) videoParameters.negative_prompt = videoNegativePrompt.trim()

    const response = await generateVideo(videoParameters)
    return {
      response,
      sourceImageUrls: sourceMediaUrls,
      sourceImageSummary: sourceMediaSummary,
      sourceMediaUrls,
      sourceMediaSummary,
      videoParametersSummary,
    }
  }

  const pollVideo = async ({ videoId, taskId, finalPrompt, parameters, provider = 'agnes' }) => {
    let lastError = null
    let errorCount = 0
    let pollCount = 0
    const startedAt = getNowMs()
    const pollRunId = videoPollRunRef.current

    if (!videoId && !taskId) {
      throw new Error('视频创建成功，但响应里没有 video_id 或 task_id，无法查询生成结果。')
    }

    setStatus(`视频已提交，等待${isAixorasVideoProvider(provider) ? ' Aixoras / Seedance' : ' Agnes'} 开始处理...${taskId ? ` task_id: ${taskId}` : ` video_id: ${videoId}`}`)
    await wait(VIDEO_POLL_INITIAL_DELAY_MS)

    while (getNowMs() - startedAt <= VIDEO_POLL_TIMEOUT_MS) {
      if (videoPollRunRef.current !== pollRunId) {
        throw new Error('已停止等待视频结果。任务可能仍在 Agnes 后台继续生成。')
      }

      const elapsedMs = getNowMs() - startedAt
      pollCount += 1

      try {
        const attempts = isAixorasVideoProvider(provider)
          ? [
            ...(taskId ? [{ source: 'task_id /v1/video/generations', fetcher: () => getVideoStatus(taskId, { provider: 'aixoras' }) }] : []),
          ]
          : [
            ...(videoId ? [{ source: 'video_id /agnesapi', fetcher: () => getVideoStatusByVideoId(videoId) }] : []),
            ...(taskId ? [{ source: 'task_id /v1/videos fallback', fetcher: () => getVideoStatus(taskId) }] : []),
          ]

        let lastResponse = null
        let responseSource = ''
        let bestProgress = ''
        let bestQueuePosition = ''

        for (const attempt of attempts) {
          try {
            const response = await attempt.fetcher()
            const responseStatus = extractVideoStatus(response)
            const responseUrl = extractVideoUrl(response)
            const responseProgress = extractVideoProgress(response)
            const responseQueuePosition = extractQueuePosition(response)

            if (!lastResponse) {
              lastResponse = response
              responseSource = attempt.source
              bestProgress = responseProgress
              bestQueuePosition = responseQueuePosition
            }

            if (!isZeroLikeProgress(responseProgress)) {
              lastResponse = response
              responseSource = attempt.source
              bestProgress = responseProgress
              bestQueuePosition = responseQueuePosition
            }

            if (responseUrl || isVideoStatusSuccess(responseStatus)) {
              lastResponse = response
              responseSource = attempt.source
              bestProgress = responseProgress
              bestQueuePosition = responseQueuePosition
              break
            }
          } catch (attemptError) {
            lastError = attemptError
          }
        }

        if (!lastResponse) {
          throw lastError || new Error('视频状态查询没有返回可用响应')
        }

        const state = extractVideoStatus(lastResponse)
        const url = extractVideoUrl(lastResponse)
        const providerError = extractVideoError(lastResponse)
        const progress = bestProgress || extractVideoProgress(lastResponse)
        const queuePosition = bestQueuePosition || extractQueuePosition(lastResponse)
        errorCount = 0

        setDebugInfo({
          videoId,
          taskId,
          responseSource,
          pollCount,
          status: state || 'unknown',
          progress,
          queuePosition,
          prompt: finalPrompt,
          parameters,
          lastResponse: summarizeVideoResponse(lastResponse, 700),
        })

        if (url && (!state || isVideoStatusSuccess(state))) {
          return url
        }

        if (isVideoStatusFailure(state)) {
          const error = new Error(providerError || '视频生成失败')
          error.fatal = true
          throw error
        }

        let progressInfo = `视频生成中，已等待 ${formatElapsed(elapsedMs)}`
        if (progress) progressInfo += `，进度 ${progress}`
        if (isZeroLikeProgress(progress) && pollCount >= 3) progressInfo += '，状态接口暂未更新进度'
        if (queuePosition) progressInfo += `，队列位置 ${queuePosition}`
        progressInfo += `，查询: ${responseSource}`
        if (videoId) progressInfo += `，video_id: ${videoId}`
        setStatus(progressInfo)
      } catch (e) {
        if (videoPollRunRef.current !== pollRunId) {
          throw e
        }

        lastError = e
        errorCount += 1
        setDebugInfo({
          videoId,
          taskId,
          httpStatus: e.status || '',
          lastPollError: e.message || '查询失败',
          retryable: isRetryablePollingError(e),
          prompt: finalPrompt,
          parameters,
        })

        if (isFatalPollingError(e)) {
          throw e
        }

        const retryDelay = nextPollDelay(errorCount)
        const retryText = isRetryablePollingError(e) ? 'Agnes 网关繁忙' : '最近查询失败'
        setStatus(
          `视频生成中，已等待 ${formatElapsed(elapsedMs)}。${retryText}，${Math.round(retryDelay / 1000)} 秒后自动重试：${e.message || '未知错误'}`,
        )
        await wait(retryDelay)
        continue
      }

      await wait(VIDEO_POLL_INTERVAL_MS)
    }

    throw new Error(
      taskId
        ? `视频轮询超过 ${formatElapsed(VIDEO_POLL_TIMEOUT_MS)}仍未完成。已使用 task_id 查询：${taskId}。${lastError ? `最近一次错误：${lastError.message}` : ''}`
        : `视频轮询超过 ${formatElapsed(VIDEO_POLL_TIMEOUT_MS)}仍未完成，且只能回退到 video_id 查询。${lastError ? `最近一次错误：${lastError.message}` : ''}`,
    )
  }

  const handleGenerateVideo = async () => {
    if (busy) return

    let videoInputAssets
    try {
      videoInputAssets = getVideoInputAssets()
    } catch (e) {
      setError(e.message || '视频输入不完整')
      return
    }

    if (isSeedanceModel && seedancePreflightIssue) {
      setError(`付费模型预检未通过：${seedancePreflightIssue}`)
      return
    }

    const userPrompt = input.trim()
    const sourcePrompt = videoInputAssets.length
      ? videoInputAssets
        .map((asset, index) => `${getAssetTypeReferenceName(asset)} ${index + 1}: ${asset.finalPrompt || asset.prompt}`)
        .join('\n')
      : ''
    const originalSourceImageUrls = videoInputAssets.map(getAssetReferenceUrl)
    const usedPromptReferences = promptReferences.filter((reference) => originalSourceImageUrls.includes(reference.url))
    const apiMode = isSeedanceModel ? undefined : videoInputMode === 'keyframes' ? 'keyframes' : undefined
    const prompt = userPrompt
      || `Animate ${videoInputAssets.length} reference media item${videoInputAssets.length > 1 ? 's' : ''} into a cinematic short video: ${sourcePrompt}`
    const seedanceReferenceMap = isSeedanceModel ? formatSeedanceReferenceMap(videoInputAssets) : ''
    const seedanceOutputGuard = isSeedanceModel
      ? `${getAspectRatioOutputHint(seedanceAspectRatio, selectedVideoModel.resolution)}\n${getSeedanceReferencePriorityHint()}`
      : ''
    const finalPrompt = isSeedanceModel
      ? `${seedanceOutputGuard}\n\n${prompt}${seedanceReferenceMap ? `\n\n参考输入顺序：${seedanceReferenceMap}` : ''}\n\n参考规则：Aixoras 当前接口会按图片、视频、音频分别提交全能参考；请严格按“输入图/输入视频/输入音频”的顺序理解。参考素材只用来约束角色身份、服装、配色、场景、道具、动作、镜头关系、声音或节奏，不要把参考图本身的拼贴版式、四宫格/九宫格、白底、编号、标题、说明文字、水印、边框直接画进视频；同一张素材如果被 @ 多次，请按多次独立参考理解，不要合并去重。`
      : prompt
    const originalSourceImageSummary = summarizeSourceImages(originalSourceImageUrls)
    const baseVideoParametersSummary = {
      inputMode: isSeedanceModel ? 'omni-reference' : videoInputMode,
      inputModeLabel: isSeedanceModel ? 'Aixoras 全能参考' : getVideoModeLabel(videoInputMode),
      sourceImages: originalSourceImageSummary,
      sourceMedia: originalSourceImageSummary,
      mode: apiMode,
      size: isSeedanceModel ? seedanceAspectRatio : videoSize,
      numFrames: isSeedanceModel ? undefined : normalizeVideoFrames(videoNumFrames),
      frameRate: isSeedanceModel ? undefined : videoFrameRate,
      duration: isSeedanceModel ? `${seedanceDuration} 秒` : formatVideoDuration(normalizeVideoFrames(videoNumFrames), videoFrameRate),
      aspectRatio: isSeedanceModel ? seedanceAspectRatio : undefined,
      referenceDelivery: isSeedanceModel
        ? (seedanceLocalReferenceCount > 0 ? 'auto-public-url' : 'public-url')
        : undefined,
      seed: isSeedanceModel ? undefined : videoSeed || undefined,
      negativePrompt: isSeedanceModel ? undefined : videoNegativePrompt.trim() || undefined,
      provider: selectedVideoModel.provider,
      model: selectedVideoModel.model,
      modelLabel: selectedVideoModel.label,
      resolution: selectedVideoModel.resolution || videoSize,
    }

    setBusy(true)
    videoPollRunRef.current += 1
    setError('')
    setDebugInfo(null)
    setStatus('正在提交视频任务...')
    pushMessage({
      role: 'user',
      content: userPrompt || `用${isSeedanceModel ? 'Aixoras 全能参考' : getVideoModeLabel(videoInputMode)}生成视频`,
      references: usedPromptReferences,
    })

    try {
      let createResult
      try {
        createResult = await createVideoTask({
          videoInputAssets,
          finalPrompt,
          baseParameters: baseVideoParametersSummary,
          apiMode,
        })
      } catch (createError) {
        if (!createError.timeout || !videoInputAssets.some((asset) => isDataImageSource(asset.url))) {
          throw createError
        }

        setStatus('视频提交阶段超过 120 秒未返回，正在用更小的参考图自动重试一次...')
        createResult = await createVideoTask({
          videoInputAssets,
          finalPrompt,
          baseParameters: baseVideoParametersSummary,
          apiMode,
          retry: true,
        })
      }

      const {
        response,
        sourceImageUrls,
        sourceImageSummary,
        videoParametersSummary,
      } = createResult
      const ids = extractVideoCreateIds(response)
      setDebugInfo({
        videoId: ids.videoId,
        taskId: ids.taskId,
        prompt: finalPrompt,
        parameters: videoParametersSummary,
        createResponse: summarizeVideoResponse(response, 700),
      })

      let videoUrl = ids.directUrl
      if (!videoUrl && !ids.videoId && !ids.taskId) {
        throw new Error(
          `视频创建接口没有返回可轮询的 video_id 或 task_id。当前模型应走 Aixoras /v1/video/generations；请展开“视频调试信息”查看 createResponse。返回摘要：${summarizeVideoResponse(response, 900)}`,
        )
      }

      if (!videoUrl) {
        videoUrl = await pollVideo({
          videoId: ids.videoId,
          taskId: ids.taskId,
          finalPrompt,
          parameters: videoParametersSummary,
          provider: selectedVideoModel.provider,
        })
      }

      if (!videoUrl) {
        throw new Error('视频生成完成，但没有解析到视频 URL。')
      }

      let playableVideoUrl = videoUrl
      let mediaFetchError = ''
      if (isAixorasVideoProvider(selectedVideoModel.provider)) {
        try {
          setStatus('视频已生成，正在拉取可播放文件...')
          const mediaBlob = await fetchAixorasMediaBlob(videoUrl)
          playableVideoUrl = URL.createObjectURL(mediaBlob)
        } catch (mediaError) {
          mediaFetchError = mediaError.message || 'Aixoras 视频文件拉取失败'
        }
      }

      const videoAsset = {
        id: `video-${getNowMs()}`,
        type: 'video',
        url: playableVideoUrl,
        remoteUrl: videoUrl,
        mediaFetchError,
        prompt,
        finalPrompt,
        sourceImage: sourceImageUrls[0],
        sourceImages: sourceImageSummary,
        videoId: ids.videoId,
        taskId: ids.taskId,
        parameters: videoParametersSummary,
        provider: selectedVideoModel.provider,
        model: selectedVideoModel.model,
        createdAt: new Date().toISOString(),
      }

      saveAsset(videoAsset)
      addHistory({
        type: 'video',
        prompt,
        finalPrompt,
        status: 'completed',
        result: playableVideoUrl,
        playableUrl: playableVideoUrl,
        remoteUrl: videoUrl,
        mediaFetchError,
        videoId: ids.videoId,
        taskId: ids.taskId,
        inputMode: isSeedanceModel ? 'omni-reference' : videoInputMode,
        sourceImages: sourceImageSummary,
        model: selectedVideoModel.model,
        provider: selectedVideoModel.provider,
      })
      onGenerated?.()

      pushMessage({
        role: 'assistant',
        content: mediaFetchError
          ? `视频任务已完成，但结果文件需要鉴权，当前未能拉取成可播放文件：${mediaFetchError}`
          : '视频已生成，并保存到资产页。',
      })
      if (usesInlineVideoPrompt) {
        setSeedanceEditorText('')
      } else {
        setInput('')
      }
      setStatus('')
      setDebugInfo(null)
    } catch (e) {
      setError(e.message || '生成视频失败')
      pushMessage({ role: 'assistant', content: `视频生成失败：${e.message || '未知错误'}` })
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const stopVideoPolling = () => {
    videoPollRunRef.current += 1
    setBusy(false)
    setStatus('')
    setError('已停止等待。Agnes 后台任务可能仍在生成，稍后可以用调试信息里的 video_id 到接口查询。')
  }

  return (
    <div className="min-h-full overflow-y-auto bg-[#eef3f2] text-slate-900">
      {isCreatorView && (
      <section className="relative overflow-visible border-b border-white/60">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#d9e6e3_0%,#eef3f2_100%)]" />
        <div
          className="absolute inset-x-0 top-0 h-56 opacity-45"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 46%',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">AI工作台</h1>
              <p className="mt-1 text-sm text-slate-600">agnes-2.0-flash · {selectedImageModel} · agnes-video-v2.0</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('assets')}
                className="rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur hover:bg-white"
              >
                打开资产
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('canvas')}
                className="rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur hover:bg-white"
              >
                打开画布
              </button>
              <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                AI工作台
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl rounded-[24px] bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.14)] ring-1 ring-white/70">
            <div className="mb-4 inline-flex rounded-full bg-slate-100 p-1">
              {WORKFLOW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    if (mode.value !== workflowMode) {
                      setInlineMentions([])
                      setAssetMention((current) => ({ ...current, open: false }))
                      setAssetMentionPosition(null)
                    }
                    setWorkflowMode(mode.value)
                  }}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    workflowMode === mode.value
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {referenceTrayItems.length > 0 && (
              <div className="mb-3 rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    {workflowMode === 'video' ? '引用素材' : '引用图片'}
                  </span>
                  <button
                    type="button"
                    onClick={clearReferenceTray}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm hover:text-slate-800"
                  >
                    清空
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {referenceTrayItems.map((item, index) => (
                    <div key={item.key} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setPreviewAsset({
                          ...item.asset,
                          prompt: item.asset.prompt || item.reference.name || `引用素材 ${index + 1}`,
                          mentionLabel: item.mentionLabel,
                        })}
                        className="block h-full w-full text-left"
                        title="大图预览"
                        aria-label={`预览 @${item.mentionLabel}`}
                      >
                        <AssetPreview asset={item.asset} />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-1 text-center text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                          预览
                        </span>
                      </button>
                      <span className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                        @{item.mentionLabel}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (item.kind === 'prompt') removePromptReference(item.reference.id)
                          else if (workflowMode === 'image') removeImageReference(item.asset.id)
                          else removeVideoReference(item.asset.id)
                        }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="移除引用素材"
                      >
                        ×
                      </button>
                      {item.kind === 'prompt' && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            addPromptReferenceToCanvas(item.reference, index)
                          }}
                          className="absolute inset-x-1 bottom-1 rounded bg-white/90 px-1 py-0.5 text-[10px] font-medium text-slate-700 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          存资产
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workflowMode === 'video' && isSeedanceModel && seedanceLocalReferenceCount > 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-700">
                当前有 {seedanceLocalReferenceCount} 个本地/粘贴参考素材。生成时会先自动上传成临时公网 URL，再提交给 Seedance / Aixoras；如果文件过大或上传失败，会在扣费提交前停止。
              </div>
            )}

            {workflowMode === 'video' && isSeedanceModel && seedanceReferenceGroups.videos.length > 0 && (
              <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold leading-5 text-sky-700">
                动作视频参考会按“动作稿”处理：本地视频生成时会自动中心裁切、灰度化、静音并压到 720p 级别后上传；远程 URL 视频无法自动清洗，请尽量使用无字幕、无贴纸、无水印的动作片段。
              </div>
            )}

            {workflowMode === 'video' && isSeedanceModel && (
              <label className={`mb-3 flex items-start gap-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-5 ${
                seedancePreflightIssue
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
              >
                <input
                  type="checkbox"
                  checked={confirmPaidSeedance}
                  onChange={(event) => setConfirmPaidSeedance(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  确认使用付费 Seedance / Aixoras 模型。本次提交会消耗额度；本地/粘贴参考会先自动转成临时公网 URL，比例和时长正确时才会提交。
                  {seedancePreflightIssue && (
                    <span className="mt-1 block">当前预检：{seedancePreflightIssue}</span>
                  )}
                </span>
              </label>
            )}

            <div className={`relative rounded-2xl border border-transparent ${
              workflowMode === 'video' ? 'min-h-[260px]' : 'min-h-32'
            }`}>
              {workflowMode === 'video' && (
                <button
                  type="button"
                  onClick={handleOptimizeVideoPrompt}
                  disabled={busy || optimizingPrompt || (!input.trim() && !getVideoPromptContextAssets().length)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  title="自动优化视频提示词"
                >
                  {optimizingPrompt ? '优化中...' : 'AI 优化'}
                </button>
              )}
              {usesInlinePrompt ? (
                <div
                  ref={seedancePromptEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncSeedancePromptEditor}
                  onClick={(event) => {
                    if (event.target?.dataset?.removeMention) {
                      event.preventDefault()
                      event.target.closest('[data-mention-token="true"]')?.remove()
                      syncSeedancePromptEditor()
                    }
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData?.getData('text/plain') || ''

                    event.preventDefault()
                    const handledPaste = handlePromptPaste(event)
                    if (text && !handledPaste) {
                      const insertedNode = insertTextAtSelection(text)
                      if (insertedNode) {
                        replaceReferenceMentionsInTextNode(insertedNode, mentionableReferences, { moveCaret: true })
                      }
                    }
                    window.setTimeout(() => {
                      autoLinkPlainReferenceMentions()
                      syncSeedancePromptEditor()
                    }, 0)
                  }}
                  onBlur={() => {
                    autoLinkPlainReferenceMentions()
                    syncSeedancePromptEditor()
                  }}
                  onKeyDown={handleInputKeyDown}
                  className={`w-full whitespace-pre-wrap break-words border-0 bg-transparent px-2 py-2 text-base leading-8 text-slate-900 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${
                    workflowMode === 'video' ? 'min-h-[210px] pr-28' : 'min-h-28'
                  }`}
                  data-placeholder={workflowMode === 'image'
                    ? '输入图片描述，粘贴图片或输入 @ 引用图片...'
                    : '输入视频提示词，粘贴图片/视频/音频或输入 @ 引用上方素材...'}
                />
              ) : (
                <textarea
                  value={input}
                  onChange={handlePromptInputChange}
                  onPaste={handlePromptPaste}
                  onKeyDown={handleInputKeyDown}
                  placeholder={workflowMode === 'chat' ? '和 AI工作台聊聊...' : workflowMode === 'image' ? '输入图片描述，或上传参考图...' : '输入视频提示词，可粘贴图片/视频/音频参考...'}
                  className={`w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400 ${
                    workflowMode === 'video' ? 'pr-28' : ''
                  } ${workflowMode === 'video' ? 'min-h-[210px]' : 'min-h-28'}`}
                />
              )}
              {showAssetMention && (
                <div
                  className={`absolute z-50 w-[min(520px,calc(100%-16px))] overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 ${
                    assetMentionPosition ? '' : 'left-2 top-full mt-2'
                  }`}
                  style={assetMentionPosition ? {
                    left: `${assetMentionPosition.left}px`,
                    top: `${assetMentionPosition.top}px`,
                  } : undefined}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-500">
                      {workflowMode === 'image' ? '引用图片' : '引用上方素材'}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      workflowMode === 'image'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                    >
                      {workflowMode === 'image' ? '图片参考' : '全能参考'}
                    </span>
                  </div>
                  {assetMentionOptions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto p-2">
                      {assetMentionOptions.map(({ reference, index }) => (
                        <button
                          key={reference.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            selectMentionReference(reference, index)
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                            <AssetPreview asset={reference} />
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">@{getPromptReferenceMentionLabel(reference, index)}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{getMentionPreviewLabel(reference, index)}</span>
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">加入</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-sm text-slate-500">
                      {referenceTrayItems.length
                        ? '没有匹配的上方引用素材，可换个关键词再试'
                        : workflowMode === 'image'
                        ? '先上传、粘贴或在资产参考里选择图片，再输入 @ 引用'
                        : '先上传或粘贴参考素材到提示词上方，再输入 @ 引用'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUploadMenu((value) => !value)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl leading-none text-slate-700 hover:bg-slate-200"
                    aria-label="添加参考"
                  >
                    +
                  </button>
                  {showUploadMenu && (
                    <div className="absolute left-0 top-11 z-20 w-56 rounded-xl bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-slate-200">
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <span>本地上传</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePromptReferenceUpload}
                          className="hidden"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <span>上传到资产</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleReferenceUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={addSelectedAssetToPromptReferences}
                        disabled={selectedAsset?.type !== 'image'}
                        className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        引用选中图片
                      </button>
                    </div>
                  )}
                </div>

                {workflowMode === 'image' && (
                  <>
                    <select
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value)}
                      className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                    >
                      {SIZE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowReferencePicker((value) => !value)}
                      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      资产参考
                    </button>
                    <select
                      value={imageProviderId}
                      onChange={(e) => handleImageProviderChange(e.target.value)}
                      className="h-10 max-w-[240px] rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                      title={selectedImageProvider.description}
                    >
                      {IMAGE_PROVIDER_OPTIONS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}{provider.badge ? ` · ${provider.badge}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="rounded-full bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                      {selectedImageModel} · {selectedImageProvider.badge}
                    </span>
                  </>
                )}

                {workflowMode === 'video' && (
                  <>
                    {isSeedanceModel ? (
                      <span className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        全能参考
                      </span>
                    ) : (
                      <select
                        value={videoInputMode}
                        onChange={(e) => setVideoInputMode(e.target.value)}
                        className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                      >
                        {VIDEO_INPUT_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                    )}

                    <select
                      value={videoModelId}
                      onChange={(e) => handleVideoModelChange(e.target.value)}
                      className="h-10 max-w-[260px] rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                      title={selectedVideoModel.description}
                    >
                      {VIDEO_MODEL_OPTIONS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}{model.badge ? ` · ${model.badge}` : ''}
                        </option>
                      ))}
                    </select>

                    {isSeedanceModel ? (
                      <select
                        value={seedanceDuration}
                        onChange={(e) => setSeedanceDuration(e.target.value)}
                        className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                      >
                        {SEEDANCE_DURATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={videoDurationPreset}
                        onChange={(e) => handleVideoDurationChange(e.target.value)}
                        className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                      >
                        {VIDEO_DURATION_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>{preset.label}</option>
                        ))}
                        <option value="custom">自定义</option>
                      </select>
                    )}

                    {isSeedanceModel && (
                      <select
                        value={seedanceAspectRatio}
                        onChange={(e) => setSeedanceAspectRatio(e.target.value)}
                        className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                        title="Seedance 输出比例"
                      >
                        {SEEDANCE_ASPECT_RATIOS.map((ratio) => (
                          <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                        ))}
                      </select>
                    )}

                    {isSeedanceModel && (
                      <select
                        value={videoModelId}
                        onChange={(e) => handleVideoModelChange(e.target.value)}
                        className="h-10 max-w-[260px] rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                        title="Seedance 清晰度 / 版本"
                      >
                        {SEEDANCE_RESOLUTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowReferencePicker((value) => !value)}
                      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      资产参考
                    </button>
                    {!isSeedanceModel && (
                      <button
                        type="button"
                        onClick={() => setShowAdvancedPanel((value) => !value)}
                        className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        参数
                      </button>
                    )}
                    {isSeedanceModel && (
                      <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        {selectedVideoModel.resolution || 'Seedance'} · Aixoras · 自动 URL 参考
                      </span>
                    )}
                  </>
                )}

                {workflowMode === 'chat' && messages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages(STARTER_MESSAGES)
                      setError('')
                      setStatus('')
                    }}
                    className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    清空对话
                  </button>
                )}
              </div>

              <button
                onClick={handleSubmit}
                title={workflowMode === 'video' && isSeedanceModel && seedancePreflightIssue ? seedancePreflightIssue : undefined}
                disabled={
                  workflowMode === 'chat'
                    ? !canSendChat
                    : workflowMode === 'image'
                    ? !canGenerateImage
                    : !canGenerateVideo
                }
                className="h-11 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {workflowMode === 'chat' ? '发送' : workflowMode === 'image' ? '生成图片' : '生成视频'}
              </button>
            </div>
          </div>

          {(status || error || debugInfo) && (
            <div className="mx-auto mt-4 max-w-5xl space-y-2 text-left">
              {status && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  <span className="min-w-0 flex-1 break-words">{status}</span>
                  {busy && workflowMode === 'video' && (
                    <button
                      type="button"
                      onClick={stopVideoPolling}
                      className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-200 hover:bg-blue-100"
                    >
                      停止等待
                    </button>
                  )}
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              {debugInfo && (
                <details className="rounded-lg border border-slate-200 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-sm">
                  <summary className="cursor-pointer text-slate-700">视频调试信息</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {workflowMode === 'image' && imagePreviewAssets.length > 0 && (
            <section className="mx-auto mt-4 max-w-5xl rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">图片预览</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    已保存到资产页。预览显示线上结果，下载按钮会拉取接口返回的原图文件。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                    {imagePreviewAssets.length} 张 · {selectedImageProvider.label}
                  </span>
                  {imagePreviewAssets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadAllImageAssets()}
                      disabled={Boolean(downloadingAssetId)}
                      className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      下载全部
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                {imagePreviewAssets.map((asset, index) => {
                  const imageUrl = getAssetPlaybackUrl(asset)
                  return (
                    <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block bg-slate-100"
                        title="打开原图"
                      >
                        <img
                          src={imageUrl}
                          alt={asset.prompt || `生成图片 ${index + 1}`}
                          className="max-h-[520px] min-h-56 w-full object-contain"
                        />
                      </a>
                      <div className="space-y-3 border-t border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-1">#{index + 1}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">{asset.aspectRatio || imageSize}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1">{asset.model || selectedImageModel}</span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-5 text-slate-600">{asset.prompt || `${asset.providerLabel || selectedImageProvider.label} 生成图片`}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            打开原图
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleDownloadImageAsset(asset, index)}
                            disabled={downloadingAssetId === asset.id}
                            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {downloadingAssetId === asset.id ? '下载中...' : '下载原图'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </section>
      )}

      <main className="mx-auto max-w-7xl px-6 py-6">
        {isCanvasView && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">AI工作台画布</h1>
              <p className="mt-1 text-sm text-slate-600">无限画布还没完善成功，目前先用于整理素材、节点和剧本关系。</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('assets')}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                打开资产
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('workspace')}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                返回创作
              </button>
              <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                {assets.length} 个素材 · {edges.length} 条连线
              </div>
            </div>
          </div>
        )}

        {isAssetsView && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">AI工作台资产</h1>
                <p className="mt-1 text-sm text-slate-600">本地上传、URL 导入、生成结果都会集中保存在这里。</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('canvas')}
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
              >
                打开画布
              </button>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_150px_150px_auto]">
                <label className="flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
                  上传素材
                  <input type="file" accept="image/*,video/*,audio/*" multiple onChange={handleAssetFileUpload} className="hidden" />
                </label>
                <input
                  value={assetUrl}
                  onChange={(event) => setAssetUrl(event.target.value)}
                  placeholder="粘贴图片、视频或音频 URL..."
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300"
                />
                <select
                  value={assetUrlType}
                  onChange={(event) => setAssetUrlType(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300"
                >
                  {ASSET_URL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <input
                  value={assetUrlTitle}
                  onChange={(event) => setAssetUrlTitle(event.target.value)}
                  placeholder="素材名称"
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300"
                />
                <button
                  type="button"
                  onClick={handleAddAssetUrl}
                  className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  添加 URL
                </button>
              </div>
            </div>

            {(error || status) && (
              <div className="space-y-2">
                {status && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{status}</div>}
                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              </div>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  {ASSET_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setAssetFilter(filter.value)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        assetFilter === filter.value
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {filteredAssets.length} / {assets.length} 个素材
                </span>
              </div>

              {filteredAssets.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-500">暂无对应分类素材。</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                  {filteredAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                        selectedId === asset.id ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(asset.id)}
                        className="block w-full text-left"
                      >
                        <div className="relative aspect-[4/3] bg-slate-100">
                          <AssetPreview asset={asset} />
                          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
                            {getAssetTypeLabel(asset)}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">{asset.prompt || '未命名素材'}</p>
                        </div>
                      </button>
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
                        <button
                          type="button"
                          onClick={() => addAssetNodeToCanvas(asset)}
                          className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                        >
                          加到画布
                        </button>
                        <a
                          href={getAssetPlaybackUrl(asset)}
                          download={`agnes-${asset.type}`}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          下载
                        </a>
                        {asset.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => addAssetToPromptReferences(asset)}
                            className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            引用
                          </button>
                        )}
                        {asset.type === 'video' && (asset.remoteUrl || asset.url) && (
                          <button
                            type="button"
                            onClick={() => recoverVideoAsset(asset)}
                            disabled={recoveringAssetId === asset.id}
                            className="col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {recoveringAssetId === asset.id ? '取回中...' : '取回视频文件'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {isCreatorView && (workflowMode === 'video' || workflowMode === 'image') && showReferencePicker && (
          <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {workflowMode === 'image' ? '图片参考' : '资产参考'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {workflowMode === 'image'
                    ? `当前模式：图片参考，已选 ${selectedImageReferences.length} 张图片。图片页不会引用视频或音频。`
                    : (
                      <>
                        当前模式：{isSeedanceModel ? 'Aixoras 全能参考' : getVideoModeLabel(videoInputMode)}，已选 {isSeedanceModel ? seedanceReferences.length : selectedVideoInputReferences.length} 个参考素材
                        {isSeedanceModel ? '，最多 9 图 / 3 视频 / 3 音频' : ''}
                      </>
                    )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                  上传图片
                  <input type="file" accept="image/*" multiple onChange={handleReferenceUpload} className="hidden" />
                </label>
                {(workflowMode === 'image' ? imageReferenceIds.length > 0 : videoReferenceIds.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (workflowMode === 'image') setImageReferenceIds([])
                      else setVideoReferenceIds([])
                    }}
                    className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
            {(workflowMode === 'image' ? imageAssets : videoReferenceAssets).length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                {workflowMode === 'image'
                  ? '资产页还没有图片。可以先上传图片，或在输入框直接粘贴参考图。'
                  : isSeedanceModel ? '资产页还没有图片、视频或音频素材。' : '资产页还没有图片。'}
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                {(workflowMode === 'image' ? imageAssets : videoReferenceAssets).map((asset) => {
                  const selected = workflowMode === 'image'
                    ? imageReferenceIds.includes(asset.id)
                    : videoReferenceIds.includes(asset.id)
                  const order = workflowMode === 'image'
                    ? selectedImageReferences.findIndex((item) => item.id === asset.id) + 1
                    : selectedVideoReferences.findIndex((item) => item.id === asset.id) + 1
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        if (workflowMode === 'image') toggleImageReference(asset.id)
                        else toggleVideoReference(asset.id)
                      }}
                      className={`relative aspect-square overflow-hidden rounded-lg border bg-slate-100 ${
                        selected ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={asset.prompt}
                    >
                      <AssetPreview asset={asset} />
                      <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                        {getAssetTypeLabel(asset)}
                      </span>
                      {selected && (
                        <span className="absolute left-2 top-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                          {order}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {isCreatorView && workflowMode === 'video' && !isSeedanceModel && showAdvancedPanel && (
          <section className="mb-5 grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">视频分辨率</label>
              <select
                value={videoSize}
                onChange={(e) => setVideoSize(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
              >
                {VIDEO_RESOLUTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">帧率</label>
              <select
                value={videoFrameRate}
                onChange={(e) => handleVideoFrameRateChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
              >
                {VIDEO_FRAME_RATES.map((rate) => (
                  <option key={rate} value={rate}>{rate} fps{rate === 24 ? ' 推荐' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">帧数 (num_frames)</label>
              <input
                type="number"
                value={videoNumFrames}
                onChange={(e) => handleVideoNumFramesChange(e.target.value)}
                min={9}
                max={441}
                step={8}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
              />
              <p className="mt-1 text-[11px] text-slate-500">约 {formatVideoDuration(videoNumFrames, videoFrameRate)}，需为 8n+1</p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">随机种子 (seed)</label>
              <input
                type="number"
                value={videoSeed}
                onChange={(e) => setVideoSeed(e.target.value)}
                placeholder="留空则随机"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div className="lg:col-span-4">
              <label className="mb-2 block text-xs font-semibold text-slate-500">负面提示词</label>
              <textarea
                value={videoNegativePrompt}
                onChange={(e) => setVideoNegativePrompt(e.target.value)}
                placeholder="不想出现在视频里的内容，可留空"
                className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
          </section>
        )}

        {isCanvasView && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              无限画布仍在完善中：现在可以创建节点、连线、放素材和整理剧本，但自动编排、批量生成串联和完整工作流执行还未开放。
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">画布工作台</h2>
                <p className="mt-1 text-xs text-slate-500">{nodes.length} 个节点 · {edges.length} 条连线</p>
              </div>
              <div className="inline-flex rounded-full bg-slate-100 p-1">
                {WORKSPACE_PANELS.map((panel) => (
                  <button
                    key={panel.value}
                    type="button"
                    onClick={() => setWorkspacePanel(panel.value)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      workspacePanel === panel.value
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
            </div>

            {workspacePanel === 'canvas' && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    {CANVAS_NODE_TEMPLATES.map((template) => (
                      <button
                        key={template.value}
                        type="button"
                        onClick={() => addTemplateNodeToCanvas(template.value)}
                        className="flex h-16 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300 hover:bg-white"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs text-slate-400 shadow-sm">
                          {template.icon}
                        </span>
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">点击快速新建节点；素材节点从资产页手动加入。</span>
                    {edges.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEdges([])}
                        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        清空连线
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative h-[560px]">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={FLOW_NODE_TYPES}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    fitView
                    minZoom={0.18}
                    maxZoom={1.8}
                    defaultEdgeOptions={{
                      type: 'smoothstep',
                      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                    }}
                  >
                    <Background color="#cbd5e1" gap={20} size={1.1} />
                    <MiniMap
                      pannable
                      zoomable
                      nodeColor={(node) => (node.id === 'script-main' ? '#f59e0b' : '#8b5cf6')}
                      maskColor="rgba(248,250,252,0.72)"
                    />
                    <Controls showInteractive={false} />
                  </ReactFlow>
                  {nodes.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/86 px-6 py-5 text-center shadow-sm backdrop-blur">
                        <p className="text-sm font-semibold text-slate-700">点击上方节点类型快速创建，或从资产页添加素材节点。</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {workspacePanel === 'script' && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">剧本</p>
                      <p className="mt-1 text-xs text-slate-500">{scriptText.trim().length} 字</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
                        上传文本
                        <input type="file" accept=".txt,.md,.text" onChange={handleScriptUpload} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={structureScriptWithAI}
                        disabled={!scriptText.trim() || busy || optimizingPrompt}
                        className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        AI 拆分镜
                      </button>
                      <button
                        type="button"
                        onClick={useScriptAsPrompt}
                        disabled={!scriptText.trim()}
                        className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        填入视频提示词
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={scriptText}
                    onChange={(event) => setScriptText(event.target.value)}
                    placeholder="粘贴剧本、分镜、角色设定或场景列表..."
                    className="h-[420px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-300"
                  />
                </div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">剧本资产</p>
                  <button
                    type="button"
                    onClick={() => setWorkspacePanel('canvas')}
                    className="w-full rounded-xl bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    查看剧本节点
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptText('')}
                    disabled={!scriptText}
                    className="w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    清空剧本
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">选中节点</h2>
              {selectedNode && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                  {selectedAsset ? getAssetTypeLabel(selectedAsset) : selectedNode.data?.label || '节点'}
                </span>
              )}
            </div>
            {selectedNode ? (
              <div className="space-y-3">
                {selectedAsset ? (
                  <div className="overflow-hidden rounded-xl bg-slate-100">
                    <AssetPreview asset={selectedAsset} controls className="w-full" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-slate-50 text-4xl font-semibold text-slate-300">
                    {CANVAS_NODE_TEMPLATES.find((template) => template.value === selectedNode.data?.nodeKind)?.icon || '节'}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-500">类型</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedAsset ? getAssetTypeLabel(selectedAsset) : selectedNode.data?.label || '未命名节点'}
                  </p>
                </div>
                {selectedAsset ? (
                  <>
                    <p className="text-xs leading-5 text-slate-500">{selectedAsset.prompt}</p>
                    {canUseSelectedAssetAsVideoReference && (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedAsset.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => addAssetToPromptReferences(selectedAsset)}
                            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                          >
                            引用到提示词
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleVideoReference(selectedAsset.id)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedAsset.type === 'image' ? '' : 'col-span-2'} ${
                            videoReferenceIds.includes(selectedAsset.id)
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {videoReferenceIds.includes(selectedAsset.id) ? '已入参考' : isSeedanceModel ? '全能参考' : '视频参考'}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={getAssetPlaybackUrl(selectedAsset)}
                        download={`agnes-${selectedAsset.type}`}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        下载
                      </a>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(selectedAsset.remoteUrl || selectedAsset.url)}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        复制链接
                      </button>
                    </div>
                    {selectedAsset.type === 'video' && (selectedAsset.remoteUrl || selectedAsset.url) && (
                      <button
                        type="button"
                        onClick={() => recoverVideoAsset(selectedAsset)}
                        disabled={recoveringAssetId === selectedAsset.id}
                        className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {recoveringAssetId === selectedAsset.id ? '取回中...' : '取回视频文件'}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-4 text-xs leading-5 text-slate-500">
                    这是一个空节点，可以先和其他节点连线，后续再绑定资产或生成动作。
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const nodeId = selectedNode.id
                    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
                    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
                    setSelectedNodeId(null)
                  }}
                  className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  删除节点
                </button>
                {selectedAsset && (
                  <button
                    type="button"
                    onClick={() => removeAsset(selectedAsset.id)}
                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    从资产页删除素材
                  </button>
                )}
              </div>
            ) : selectedAsset ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl bg-slate-100">
                  <AssetPreview asset={selectedAsset} controls className="w-full" />
                </div>
                <p className="text-xs leading-5 text-slate-500">{selectedAsset.prompt}</p>
                {canUseSelectedAssetAsVideoReference && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAsset.type === 'image' && (
                      <button
                        type="button"
                        onClick={() => addAssetToPromptReferences(selectedAsset)}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                      >
                        引用到提示词
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleVideoReference(selectedAsset.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedAsset.type === 'image' ? '' : 'col-span-2'} ${
                        videoReferenceIds.includes(selectedAsset.id)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {videoReferenceIds.includes(selectedAsset.id) ? '已入参考' : isSeedanceModel ? '全能参考' : '视频参考'}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={getAssetPlaybackUrl(selectedAsset)}
                    download={`agnes-${selectedAsset.type}`}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    下载
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(selectedAsset.remoteUrl || selectedAsset.url)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    复制链接
                  </button>
                </div>
                {selectedAsset.type === 'video' && (selectedAsset.remoteUrl || selectedAsset.url) && (
                  <button
                    type="button"
                    onClick={() => recoverVideoAsset(selectedAsset)}
                    disabled={recoveringAssetId === selectedAsset.id}
                    className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recoveringAssetId === selectedAsset.id ? '取回中...' : '取回视频文件'}
                  </button>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">选中节点后显示详情。</p>
            )}
          </aside>
        </section>
        )}

        {isCreatorView && (
        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">对话</h2>
            <span className="text-xs text-slate-400">{messages.length} 条</span>
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[78%] rounded-2xl p-3 ${
                  message.role === 'user'
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-50 text-slate-700'
                }`}
                >
                  {message.references?.length > 0 && (
                    <div className="mb-2 flex gap-2 overflow-x-auto">
                      {message.references.slice(0, 6).map((reference, referenceIndex) => (
                        <img
                          key={`${reference.id}-${referenceIndex}`}
                          src={reference.url}
                          alt={reference.name || '引用图'}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <p className={`text-xs font-semibold ${message.role === 'user' ? 'text-white/70' : 'text-slate-500'}`}>
                    {message.role === 'user' ? '你' : 'AI工作台'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}
      </main>

      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="引用素材预览"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_22px_70px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">引用素材预览</h2>
                  {previewAsset.mentionLabel && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      @{previewAsset.mentionLabel}
                    </span>
                  )}
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                    {getAssetTypeLabel(previewAsset)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {previewAsset.prompt || previewAsset.name || '参考素材'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {getAssetPlaybackUrl(previewAsset) && (
                  <a
                    href={getAssetPlaybackUrl(previewAsset)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    打开原文件
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAsset(null)}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-4">
              {previewAsset.type === 'video' ? (
                <video
                  src={getAssetPlaybackUrl(previewAsset)}
                  controls
                  className="max-h-[76vh] max-w-full rounded-xl bg-black"
                />
              ) : previewAsset.type === 'audio' ? (
                <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-4 text-sm font-semibold text-slate-900">{previewAsset.prompt || '音频参考'}</p>
                  <audio src={getAssetPlaybackUrl(previewAsset)} controls className="w-full" />
                </div>
              ) : (
                <img
                  src={getAssetPlaybackUrl(previewAsset)}
                  alt={previewAsset.prompt || previewAsset.name || '引用素材预览'}
                  className="max-h-[76vh] max-w-full rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
