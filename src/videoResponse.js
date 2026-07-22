const VIDEO_ID_KEYS = ['video_id', 'videoId', 'videoID']
const TASK_ID_KEYS = ['task_id', 'taskId', 'task', 'job_id', 'jobId', 'generation_id', 'generationId']
const STATUS_KEYS = ['status', 'state']
const URL_KEYS = [
  'video_url',
  'videoUrl',
  'url',
  'output',
  'result',
  'video',
  'download_url',
  'downloadUrl',
  'play_url',
  'playUrl',
  'file_url',
  'fileUrl',
  'remixed_from_video_id',
  'content',
  'text',
]
const ERROR_KEYS = ['error', 'message', 'detail', 'error_message', 'errorMessage']
const PROGRESS_KEYS = ['progress', 'percent', 'percentage']
const QUEUE_KEYS = ['queue_position', 'queuePosition', 'position']

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value?.message === 'string') return value.message

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractFirstUrl(value) {
  if (typeof value !== 'string') return ''
  if (/^data:video\//i.test(value.trim())) return value.trim()
  const match = value.match(/https?:\/\/[^\s"'<>`\\)]+/i)
  return match ? match[0].replace(/[，。,.!?;:]+$/, '') : ''
}

function isLikelyChatCompletionId(value) {
  return /^(chatcmpl-|cmpl-|resp_|msg_)/i.test(String(value || '').trim())
}

function isLikelyTaskId(value) {
  const text = stringifyValue(value).trim()
  return Boolean(text) && !text.startsWith('video_') && !isLikelyChatCompletionId(text)
}

function extractTaskIdFromText(value) {
  const text = stringifyValue(value)
  if (!text) return ''

  const patterns = [
    /["'](?:task_id|taskId|job_id|jobId|generation_id|generationId)["']\s*:\s*["']([^"']+)["']/i,
    /(?:task[_\s-]?id|job[_\s-]?id|generation[_\s-]?id|任务\s*id|任务号|任务)\s*[:：]\s*([A-Za-z0-9_.-]+)/i,
    /\btask_[A-Za-z0-9_.-]+\b/i,
    /\bjob_[A-Za-z0-9_.-]+\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = match?.[1] || match?.[0] || ''
    if (isLikelyTaskId(candidate)) return candidate
  }

  return ''
}

function looksLikeUrl(value) {
  return Boolean(extractFirstUrl(stringifyValue(value)))
}

function findFirstValue(value, keys, predicate, depth = 0, visited = new Set(), allowPrimitive = false) {
  if (value === null || value === undefined || depth > 7) return null

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return allowPrimitive && predicate(value) ? value : null
  }

  if (!isObject(value) || visited.has(value)) return null
  visited.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstValue(item, keys, predicate, depth + 1, visited, allowPrimitive)
      if (found !== null && found !== undefined && found !== '') return found
    }
    return null
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && predicate(value[key])) {
      return value[key]
    }
  }

  for (const item of Object.values(value)) {
    const found = findFirstValue(item, keys, predicate, depth + 1, visited, allowPrimitive)
    if (found !== null && found !== undefined && found !== '') return found
  }

  return null
}

function firstString(value, keys, predicate = (item) => Boolean(stringifyValue(item)), allowPrimitive = false) {
  const found = findFirstValue(value, keys, predicate, 0, new Set(), allowPrimitive)
  return stringifyValue(found)
}

export function normalizeVideoStatus(status) {
  const value = stringifyValue(status).trim().toLowerCase()
  if (!value) return ''

  const aliases = {
    complete: 'completed',
    completed: 'completed',
    done: 'completed',
    finished: 'completed',
    success: 'completed',
    succeeded: 'completed',
    pending: 'queued',
    queue: 'queued',
    queued: 'queued',
    processing: 'in_progress',
    running: 'in_progress',
    inprogress: 'in_progress',
    'in-progress': 'in_progress',
    in_progress: 'in_progress',
    error: 'failed',
    failed: 'failed',
    failure: 'failed',
  }

  return aliases[value] || value
}

export function extractVideoCreateIds(response) {
  const explicitVideoId = firstString(response, VIDEO_ID_KEYS)
  const idValue = firstString(response, ['id'])
  const explicitTaskId = firstString(response, TASK_ID_KEYS, isLikelyTaskId)
  const textTaskId = extractTaskIdFromText(response)

  return {
    videoId: explicitVideoId || (idValue.startsWith('video_') ? idValue : ''),
    taskId: explicitTaskId || textTaskId || (isLikelyTaskId(idValue) ? idValue : ''),
    directUrl: extractVideoUrl(response),
  }
}

export function extractVideoUrl(response) {
  if (looksLikeUrl(response)) return extractFirstUrl(response)
  return extractFirstUrl(firstString(response, URL_KEYS, looksLikeUrl, true))
}

export function extractVideoStatus(response) {
  return normalizeVideoStatus(firstString(response, STATUS_KEYS))
}

export function extractVideoError(response) {
  const found = findFirstValue(response, ERROR_KEYS, (item) => {
    if (item === null || item === undefined || item === '') return false
    if (typeof item === 'object' && Object.keys(item).length === 0) return false
    return true
  })
  return stringifyValue(found)
}

export function extractVideoProgress(response) {
  return stringifyValue(findFirstValue(response, PROGRESS_KEYS, (item) => item !== null && item !== undefined && item !== ''))
}

export function extractQueuePosition(response) {
  return stringifyValue(findFirstValue(response, QUEUE_KEYS, (item) => item !== null && item !== undefined && item !== ''))
}

export function isVideoStatusSuccess(status) {
  return normalizeVideoStatus(status) === 'completed'
}

export function isVideoStatusFailure(status) {
  return normalizeVideoStatus(status) === 'failed'
}

export function isFatalPollingError(error) {
  return Boolean(error?.fatal) || [400, 401, 403, 404].includes(error?.status)
}

export function isRetryablePollingError(error) {
  return [408, 425, 429, 500, 502, 503, 504].includes(error?.status)
}

export function summarizeVideoResponse(response, maxLength = 900) {
  try {
    return JSON.stringify(response, null, 2).slice(0, maxLength)
  } catch {
    return String(response).slice(0, maxLength)
  }
}
