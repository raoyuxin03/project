const HISTORY_KEY = 'agnes_history'
const SCRIPT_KEY = 'agnes_script'
const CANVAS_GRAPH_KEY = 'agnes_canvas_graph'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function getHistory() {
  return readJson(HISTORY_KEY, [])
}

export function addHistory(record) {
  const history = getHistory()
  history.unshift({
    ...record,
    time: new Date().toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
  })
  // 最多保存 50 条
  if (history.length > 50) history.length = 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getSavedScript() {
  try {
    return localStorage.getItem(SCRIPT_KEY) || ''
  } catch {
    return ''
  }
}

export function saveScript(script) {
  try {
    localStorage.setItem(SCRIPT_KEY, script)
  } catch {
    // 剧本文本保存失败不影响核心生成流程。
  }
}

export function getSavedCanvasGraph() {
  return readJson(CANVAS_GRAPH_KEY, { nodes: [], edges: [] })
}

export function saveCanvasGraph(graph) {
  try {
    localStorage.setItem(CANVAS_GRAPH_KEY, JSON.stringify(graph))
  } catch {
    // 画布位置保存失败时，素材本身仍保存在 IndexedDB。
  }
}
