import { useMemo, useState } from 'react'
import { chatCompletion, getApiKey } from '../api'

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content: '你好，我是 AI创作工作台，当前聊天模型是 Agnes 2.0 Flash。',
  },
]

const CHAT_CAPABILITIES = [
  {
    id: 'general',
    label: '通用对话',
    description: '问答、写作、解释、规划',
    systemPrompt: '你是 AI创作工作台，一个清晰、直接、可靠的中文 AI 助手。',
    temperature: 0.7,
    maxTokens: 1200,
  },
  {
    id: 'image-prompt',
    label: '图片 Prompt',
    description: '整理主体、场景、光线、构图',
    systemPrompt:
      '你是 AI创作工作台图片生成提示词助手。把用户想法整理成适合 agnes-image-2.1-flash 的高质量提示词。优先输出 English prompt，并补充 negative prompt、尺寸建议和可调参数。保留用户的核心主体、风格、光线、构图和限制。',
    temperature: 0.45,
    maxTokens: 1600,
  },
  {
    id: 'video-prompt',
    label: '视频 Prompt',
    description: '镜头、运动、节奏、约束',
    systemPrompt:
      '你是 AI创作工作台视频生成提示词助手。把用户想法整理成适合 agnes-video-v2.0 的英文视频提示词。明确主体、动作、镜头运动、景别、光线、时长感、画面风格和不要出现的内容。不要编造接口不支持的参数。',
    temperature: 0.45,
    maxTokens: 1600,
  },
  {
    id: 'storyboard',
    label: '分镜策划',
    description: '拆镜头、画面、旁白、转场',
    systemPrompt:
      '你是短片分镜策划助手。把用户的主题拆成可生成的镜头列表。每个镜头包含画面、动作、镜头运动、时长建议、图片提示词、视频提示词和转场建议。输出要紧凑、可执行。',
    temperature: 0.65,
    maxTokens: 2200,
  },
  {
    id: 'translator',
    label: '翻译润色',
    description: '中英互译、改写、润色',
    systemPrompt:
      '你是专业翻译和润色助手。根据用户要求在中文和英文之间准确转换，保留语气、术语、结构和关键信息。输出自然、简洁，并在必要时给出两个风格版本。',
    temperature: 0.35,
    maxTokens: 1400,
  },
  {
    id: 'code',
    label: '代码助手',
    description: '解释、排错、重构、测试',
    systemPrompt:
      '你是务实的软件工程助手。优先给出可执行的诊断、修改建议和代码片段。说明假设、风险和验证方式。除非用户要求，不输出冗长教程。',
    temperature: 0.35,
    maxTokens: 2200,
  },
]

const QUICK_ACTIONS = [
  {
    id: 'make-image-prompt',
    label: '优化图片 Prompt',
    instruction:
      '把下面内容改写成适合 AI创作工作台图片生成的提示词。输出：中文理解、English prompt、negative prompt、推荐尺寸。',
  },
  {
    id: 'make-video-prompt',
    label: '优化视频 Prompt',
    instruction:
      '把下面内容改写成适合 AI创作工作台视频生成的英文提示词。输出：English prompt、negative prompt、镜头运动、推荐时长和分辨率。',
  },
  {
    id: 'summarize',
    label: '总结要点',
    instruction: '总结下面内容，输出核心结论、关键细节、待确认问题和下一步动作。',
  },
  {
    id: 'translate-english',
    label: '翻译成英文',
    instruction: '把下面内容翻译成自然准确的英文，保留专业词和语气。',
  },
  {
    id: 'review-code',
    label: '代码检查',
    instruction: '检查下面代码或报错，指出问题、原因、修复方案和验证命令。',
  },
  {
    id: 'storyboard',
    label: '拆成分镜',
    instruction:
      '把下面创意拆成 6 个可生成镜头。每个镜头包含画面、动作、镜头运动、图片 Prompt、视频 Prompt。',
  },
]

const EXAMPLE_PROMPTS = [
  '帮我把“未来城市里的猫咪特工”改成图片生成提示词',
  '把一个海边日落场景拆成 6 个短视频分镜',
  '解释一下 text-to-video 和 image-to-video 的区别',
]

function extractAssistantText(response) {
  return response?.choices?.[0]?.message?.content || response?.data?.choices?.[0]?.message?.content || ''
}

function messageLabel(role) {
  if (role === 'user') return '你'
  if (role === 'system') return 'System'
  return 'AI创作工作台'
}

export default function ChatPage() {
  const [capabilityId, setCapabilityId] = useState('general')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState(CHAT_CAPABILITIES[0].systemPrompt)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasApiKey = Boolean(getApiKey().trim())
  const currentCapability = CHAT_CAPABILITIES.find((item) => item.id === capabilityId) || CHAT_CAPABILITIES[0]

  const requestMessages = useMemo(() => {
    const chatMessages = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }))
    return systemPrompt.trim()
      ? [{ role: 'system', content: systemPrompt.trim() }, ...chatMessages]
      : chatMessages
  }, [messages, systemPrompt])

  const sendMessage = async () => {
    const content = input.trim()
    if (!content || busy) return

    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setBusy(true)

    try {
      const payloadMessages = [
        ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
        ...nextMessages
          .filter((message) => message.role !== 'system')
          .map((message) => ({ role: message.role, content: message.content })),
      ]

      const response = await chatCompletion({
        messages: payloadMessages,
        temperature: Number(temperature),
        max_tokens: Number(maxTokens),
      })
      const answer = extractAssistantText(response).trim()
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: answer || '模型没有返回文本内容。',
        },
      ])
    } catch (e) {
      setError(e.message || '聊天请求失败')
      setMessages((current) => current.slice(0, -1))
      setInput(content)
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES)
    setError('')
  }

  const selectCapability = (id) => {
    const capability = CHAT_CAPABILITIES.find((item) => item.id === id)
    if (!capability) return
    setCapabilityId(id)
    setSystemPrompt(capability.systemPrompt)
    setTemperature(capability.temperature)
    setMaxTokens(capability.maxTokens)
    setError('')
  }

  const runQuickAction = (action) => {
    const content = input.trim()
    if (!content) {
      setInput(`${action.instruction}\n\n`)
      return
    }
    setInput(`${action.instruction}\n\n${content}`)
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-6xl gap-5">
      <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-gray-800 bg-gray-900/40">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">聊天</h2>
            <p className="mt-1 text-xs text-gray-500">agnes-2.0-flash · {currentCapability.label}</p>
          </div>
          <button
            onClick={clearChat}
            disabled={busy}
            className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            清空
          </button>
        </div>

        {!hasApiKey && (
          <div className="mx-5 mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
            请先在「设置」页面配置 API Key
          </div>
        )}

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-lg border px-4 py-3 ${
                  message.role === 'user'
                    ? 'border-cyan-500/30 bg-cyan-600 text-white'
                    : 'border-gray-700 bg-gray-950 text-gray-100'
                }`}
              >
                <div className="mb-1 text-[11px] font-medium text-gray-400">
                  <span>{messageLabel(message.role)}</span>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => copyText(message.content)}
                      className="ml-3 text-[10px] text-gray-500 hover:text-gray-300"
                    >
                      复制
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-6">
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-400">
                正在回复...
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                onClick={() => setInput(example)}
                disabled={busy}
                className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-cyan-500 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息"
              className="h-24 min-w-0 flex-1 resize-none rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500"
            />
            <button
              onClick={sendMessage}
              disabled={busy || !input.trim()}
              className="w-24 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-white"
            >
              发送
            </button>
          </div>
        </div>
      </section>

      <aside className="w-80 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="text-sm font-semibold text-gray-200">能力</h3>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-xs text-gray-500">能力模式</label>
            <div className="grid grid-cols-2 gap-2">
              {CHAT_CAPABILITIES.map((capability) => (
                <button
                  key={capability.id}
                  onClick={() => selectCapability(capability.id)}
                  disabled={busy}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    capabilityId === capability.id
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                      : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="block text-xs font-medium">{capability.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-gray-500">{capability.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-gray-500">快捷任务</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => runQuickAction(action)}
                  disabled={busy}
                  className="rounded-md border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:border-cyan-500 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-gray-500">系统提示词</label>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              className="h-28 w-full resize-none rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-gray-500">温度 temperature</label>
            <input
              type="number"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              min={0}
              max={2}
              step={0.1}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs text-gray-500">输出长度 max_tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(event) => setMaxTokens(event.target.value)}
              min={128}
              max={8192}
              step={128}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
          </div>

          <details className="rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
            <summary className="cursor-pointer text-gray-300">请求消息</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(requestMessages, null, 2)}
            </pre>
          </details>
        </div>
      </aside>
    </div>
  )
}
