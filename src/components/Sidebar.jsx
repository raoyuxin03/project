import { useState } from 'react'
import {
  getImageAuthorizedHeaders,
  getAixorasVideoAuthorizedHeaders,
  getApiKey,
} from '../api'
import { getHistory } from '../store'

const navItems = [
  { id: 'workspace', icon: '+', label: '创作' },
  { id: 'assets', icon: 'A', label: '资产' },
  { id: 'canvas', icon: 'C', label: '画布' },
  { id: 'settings', icon: 'S', label: '设置' },
]

function getImageSrc(result) {
  if (!result) return null
  if (typeof result === 'object') {
    return result.url || (result.b64_json ? `data:image/png;base64,${result.b64_json}` : null)
  }
  return isLikelyBase64Image(result) ? `data:image/png;base64,${result}` : result
}

function getHistoryMediaUrl(item) {
  return item.playableUrl || item.result || ''
}

function getHistoryCopyUrl(item) {
  return item.remoteUrl || item.result || ''
}

function getHistoryTitle(item) {
  return item.prompt || (item.type === 'video' ? '未命名视频' : '未命名图片')
}

function isLikelyBase64Image(value) {
  const text = String(value || '').trim()
  return text.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(text)
}

function normalizeDownloadUrl(url) {
  if (!url) return ''
  const cleanUrl = String(url).trim()
  if (isLikelyBase64Image(cleanUrl)) return `data:image/png;base64,${cleanUrl}`
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('/')) return cleanUrl

  try {
    const parsed = new URL(cleanUrl)
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
    return cleanUrl
  }

  return cleanUrl
}

function getDownloadHeaders(downloadUrl, itemType) {
  if (downloadUrl.startsWith('/aixoras-proxy')) {
    return itemType === 'video' ? getAixorasVideoAuthorizedHeaders() : getImageAuthorizedHeaders('aixoras')
  }

  if (downloadUrl.startsWith('/change2pro-proxy')) {
    return getImageAuthorizedHeaders('change2pro-images')
  }

  if (downloadUrl.startsWith('/api-proxy')) {
    const token = getApiKey().trim()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  return {}
}

function getDownloadProxyUrl(url) {
  const cleanUrl = String(url || '').trim()
  if (!/^https?:\/\//i.test(cleanUrl)) return ''
  return `/media-download-proxy?url=${encodeURIComponent(cleanUrl)}`
}

async function fetchDownloadBlob(url, itemType) {
  const directUrl = normalizeDownloadUrl(url)
  const proxyUrl = getDownloadProxyUrl(url)
  const attempts = [directUrl, proxyUrl].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index)
  let lastError = null

  for (const attemptUrl of attempts) {
    try {
      const response = await fetch(attemptUrl, { headers: getDownloadHeaders(attemptUrl, itemType) })
      if (!response.ok) {
        throw new Error(`服务器返回 ${response.status}`)
      }
      return response.blob()
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('浏览器无法读取这个远程文件')
}

function getExtensionFromMime(type) {
  const cleanType = String(type || '').split(';')[0].trim().toLowerCase()
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }

  return map[cleanType] || cleanType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || ''
}

function ensureExtension(filename, extension) {
  if (!extension || /\.[a-z0-9]{2,5}$/i.test(filename)) return filename
  return `${filename}.${extension}`
}

function triggerFileDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export default function Sidebar({ page, setPage, refreshKey }) {
  const history = getHistory(refreshKey)
  const [selectedItem, setSelectedItem] = useState(null)
  const [downloadingKey, setDownloadingKey] = useState('')
  const [downloadError, setDownloadError] = useState('')

  const exportItem = (item, e) => {
    e?.stopPropagation()
    try {
      const exportData = {
        type: item.type,
        prompt: item.prompt,
        status: item.status,
        time: item.time,
        result: item.result || null,
        taskId: item.taskId || null,
        exportedAt: new Date().toISOString(),
      }
      const data = JSON.stringify(exportData, null, 2)
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `agnes-${item.type}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('导出失败:', err)
      alert(`导出失败: ${err.message}`)
    }
  }

  const downloadFile = async (url, filename, e, itemKey, itemType) => {
    e?.stopPropagation()
    if (!url) return
    const key = itemKey || filename

    setDownloadingKey(key)
    setDownloadError('')

    try {
      const blob = await fetchDownloadBlob(url, itemType)
      const extension = getExtensionFromMime(blob.type)
      const objectUrl = URL.createObjectURL(blob)
      triggerFileDownload(objectUrl, ensureExtension(filename, extension))
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
    } catch (err) {
      console.error('下载失败:', err)
      const message = err.message === 'Failed to fetch'
        ? '远程图片服务器禁止浏览器读取，请重启本地服务后再试。'
        : err.message || '浏览器无法读取这个远程文件'
      setDownloadError(`下载失败：${message}`)
    } finally {
      setDownloadingKey('')
    }
  }

  const copyLink = (url, e) => {
    e?.stopPropagation()
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      alert('链接已复制到剪贴板')
    }).catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('链接已复制到剪贴板')
    })
  }

  return (
    <aside className="w-[324px] shrink-0 bg-[#eef3f2] p-3">
      <div className="flex h-full flex-col rounded-[24px] bg-white px-3 py-4 shadow-sm ring-1 ring-slate-200">
        <div className="px-3 pb-6">
          <button
            type="button"
            onClick={() => setPage('workspace')}
            className="flex items-center gap-2 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              A
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AI创作工作台</h1>
              <p className="text-xs text-slate-400">创作工作流</p>
            </div>
          </button>
        </div>

        <nav className="space-y-2 px-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition ${
                page === item.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                page === item.id ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 flex min-h-0 flex-1 flex-col px-1">
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="text-sm font-medium text-slate-400">创作历史</p>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {history.length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-400">暂无历史记录</p>
            )}

            {history.map((item, i) => {
              const mediaUrl = getHistoryMediaUrl(item)
              const imageSrc = getImageSrc(mediaUrl)
              const title = getHistoryTitle(item)
              const isVideo = item.type === 'video'
              const imageDownloadKey = `${item.time || i}-image`
              const videoDownloadKey = `${item.time || i}-video`

              return (
                <div
                  key={`${item.time || 'history'}-${i}`}
                  className="rounded-2xl p-2 transition hover:bg-slate-50"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => {
                      setSelectedItem(selectedItem === i ? null : i)
                      setDownloadError('')
                    }}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {imageSrc && !isVideo ? (
                        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                      ) : isVideo && mediaUrl ? (
                        <video src={mediaUrl} className="h-full w-full object-cover" muted />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-300">
                          {isVideo ? 'V' : 'I'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {isVideo ? '视频' : '图片'} · {item.status === 'completed' ? '已完成' : '生成中'} · {item.time}
                      </p>
                    </div>
                  </button>

                  {selectedItem === i && (
                    <div className="ml-[68px] mt-2 space-y-2 border-l border-slate-100 pl-3">
                      <p className="line-clamp-3 text-xs leading-5 text-slate-500">{title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.result && item.type === 'image' && imageSrc && (
                          <button
                            type="button"
                            onClick={(e) => downloadFile(imageSrc, `agnes-image-${Date.now()}.png`, e, imageDownloadKey, 'image')}
                            disabled={Boolean(downloadingKey)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadingKey === imageDownloadKey ? '下载中...' : '下载图片'}
                          </button>
                        )}
                        {mediaUrl && item.type === 'video' && (
                          <button
                            type="button"
                            onClick={(e) => downloadFile(mediaUrl, `agnes-video-${Date.now()}.mp4`, e, videoDownloadKey, 'video')}
                            disabled={Boolean(downloadingKey)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadingKey === videoDownloadKey ? '下载中...' : '下载视频'}
                          </button>
                        )}
                        {(mediaUrl || item.remoteUrl) && (
                          <button
                            type="button"
                            onClick={(e) => copyLink(isVideo ? getHistoryCopyUrl(item) : imageSrc, e)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            复制链接
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => exportItem(item, e)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          导出 JSON
                        </button>
                      </div>
                      {downloadError && (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
                          {downloadError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
