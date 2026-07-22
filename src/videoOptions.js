export const VIDEO_RESOLUTIONS = [
  { label: '720x1280 竖屏 9:16', value: '720x1280' },
  { label: '1280x720 横屏 16:9', value: '1280x720' },
  { label: '1024x1024 方形 1:1', value: '1024x1024' },
  { label: '768x768 方形 1:1', value: '768x768' },
  { label: '1152x768 标准 3:2', value: '1152x768' },
]

export const VIDEO_FRAME_RATES = [8, 16, 24, 30]

export const VIDEO_DURATION_PRESETS = [
  { label: '约 3 秒', value: '3', seconds: 3.4 },
  { label: '约 5 秒（推荐）', value: '5', seconds: 5 },
  { label: '约 8 秒', value: '8', seconds: 8 },
  { label: '约 12 秒', value: '12', seconds: 12 },
  { label: '约 18 秒（最长）', value: '18', seconds: 18 },
]

const MIN_VIDEO_FRAMES = 9
const MAX_VIDEO_FRAMES = 441

export function findDurationPreset(value) {
  return VIDEO_DURATION_PRESETS.find((preset) => preset.value === value)
}

export function normalizeVideoFrames(value) {
  const numericValue = Number(value)
  const rawFrames = Number.isFinite(numericValue) ? numericValue : 121
  const clampedFrames = Math.max(MIN_VIDEO_FRAMES, Math.min(MAX_VIDEO_FRAMES, rawFrames))
  return Math.max(
    MIN_VIDEO_FRAMES,
    Math.min(MAX_VIDEO_FRAMES, Math.round((clampedFrames - 1) / 8) * 8 + 1),
  )
}

export function framesFromDuration(seconds, frameRate) {
  return normalizeVideoFrames(Number(seconds) * Number(frameRate))
}

export function formatVideoDuration(numFrames, frameRate) {
  const seconds = Number(numFrames) / Number(frameRate)
  if (!Number.isFinite(seconds)) return '约 5 秒'
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)} 秒`
}
