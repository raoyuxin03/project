const BASE_URL_KEY = 'agnes_base_url';
const API_KEY_KEY = 'agnes_api_key';

const DEFAULT_BASE_URL = '/api-proxy';
const AIXORAS_BASE_URL_KEY = 'aixoras_base_url';
const AIXORAS_API_KEY_KEY = 'aixoras_api_key';
const AIXORAS_IMAGE_API_KEY_KEY = 'aixoras_image_api_key';
const AIXORAS_VIDEO_API_KEY_KEY = 'aixoras_video_api_key';
const AIXORAS_IMAGE_MODEL_KEY = 'aixoras_image_model';
const IMAGE_PROVIDER_KEY = 'image_provider';
const CHANGE2PRO_BASE_URL_KEY = 'change2pro_base_url';
const CHANGE2PRO_IMAGE_API_KEY_KEY = 'change2pro_image_api_key';
const CHANGE2PRO_IMAGE_MODEL_KEY = 'change2pro_image_model';
const DEFAULT_AIXORAS_BASE_URL = '/aixoras-proxy';
const DEFAULT_CHANGE2PRO_BASE_URL = '/change2pro-proxy';
const DEFAULT_AIXORAS_IMAGE_MODEL = 'gpt-image-2-2k';
const DEFAULT_CHANGE2PRO_IMAGE_MODEL = 'gpt-5.5';
const DEFAULT_AIXORAS_IMAGE_QUALITY = 'auto';
const DEFAULT_IMAGE_PROVIDER = 'aixoras';
const CHAT_MODEL = 'agnes-2.0-flash';
const IMAGE_MODEL = 'agnes-image-2.1-flash';
const VIDEO_MODEL = 'agnes-video-v2.0';
const AIXORAS_ALLOWED_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'];
export const IMAGE_PROVIDER_OPTIONS = [
  {
    id: 'aixoras',
    label: 'Aixoras Image2',
    badge: 'Image2',
    description: 'Aixoras / v1/images/generations / v1/images/edits',
  },
  {
    id: 'change2pro-images',
    label: 'Change2Pro Image API',
    badge: '/images',
    description: 'OpenAI 兼容图片接口 /v1/images/generations 与 /v1/images/edits',
  },
  {
    id: 'change2pro-responses',
    label: 'Change2Pro Responses',
    badge: '/responses',
    description: 'OpenAI 兼容 Responses API，使用 image_generation 工具',
  },
];
export const VIDEO_MODEL_OPTIONS = [
  {
    id: 'agnes-video-v2.0',
    label: 'Agnes Video v2.0',
    provider: 'agnes',
    model: 'agnes-video-v2.0',
    resolution: '',
    badge: '免费',
    description: 'Agnes 原生视频模型',
  },
  {
    id: 'jimeng-video-seedance-2.0-pro',
    label: '即梦 Seedance 2.0 Pro',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-pro',
    resolution: 'Pro',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations',
  },
  {
    id: 'jimeng-video-seedance-2.0-pro-1080p',
    label: '即梦 Seedance 2.0 Pro 1080p',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-pro-1080p',
    resolution: '1080p',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations / 1080p',
  },
  {
    id: 'jimeng-video-seedance-2.0-pro-720p',
    label: '即梦 Seedance 2.0 Pro 720p',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-pro-720p',
    resolution: '720p',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations / 720p',
  },
  {
    id: 'jimeng-video-seedance-2.0-fast',
    label: '即梦 Seedance 2.0 Fast',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-fast',
    resolution: 'Fast',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations',
  },
  {
    id: 'jimeng-video-seedance-2.0-mini-720p',
    label: '即梦 Seedance 2.0 Mini 720p',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-mini-720p',
    resolution: '720p',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations / 720p',
  },
  {
    id: 'jimeng-video-seedance-2.0-mini',
    label: '即梦 Seedance 2.0 Mini',
    provider: 'aixoras',
    model: 'jimeng-video-seedance-2.0-mini',
    resolution: 'Mini',
    badge: '新渠道',
    description: 'Aixoras / 字节跳动 / /v1/video/generations',
  },
  {
    id: 'bytedance-seedance-2-image-to-video-480p',
    label: 'Seedance 2.0 图生视频 480p（旧渠道）',
    provider: 'aixoras',
    model: 'bytedance/seedance-2.0/图生视频-480p',
    resolution: '480p',
    badge: '最低价',
    description: 'Aixoras / bytedance/seedance-2.0/图生视频-480p',
  },
  {
    id: 'bytedance-seedance-2-image-to-video-720p',
    label: 'Seedance 2.0 图生视频 720p（旧渠道）',
    provider: 'aixoras',
    model: 'bytedance/seedance-2.0/图生视频-720p',
    resolution: '720p',
    badge: '高清',
    description: 'Aixoras / bytedance/seedance-2.0/图生视频-720p',
  },
  {
    id: 'bytedance-seedance-2-image-to-video-1080p',
    label: 'Seedance 2.0 图生视频 1080p（旧渠道）',
    provider: 'aixoras',
    model: 'bytedance/seedance-2.0/图生视频-1080p',
    resolution: '1080p',
    badge: '高画质',
    description: 'Aixoras / bytedance/seedance-2.0/图生视频-1080p',
  },
];
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const IMAGE_REQUEST_TIMEOUT_MS = 180000;
const VIDEO_CREATE_TIMEOUT_MS = 120000;
const CHAT_VIDEO_CREATE_TIMEOUT_MS = 10 * 60 * 1000;
const VIDEO_STATUS_TIMEOUT_MS = 30000;
const PUBLIC_MEDIA_UPLOAD_TIMEOUT_MS = 120000;
export const VIDEO_POLL_INITIAL_DELAY_MS = 15000;
export const VIDEO_POLL_INTERVAL_MS = 10000;
export const VIDEO_POLL_TIMEOUT_MS = 15 * 60 * 1000;

export function getBaseUrl() {
  return localStorage.getItem(BASE_URL_KEY) || DEFAULT_BASE_URL;
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || '';
}

export function getAixorasBaseUrl() {
  return localStorage.getItem(AIXORAS_BASE_URL_KEY) || DEFAULT_AIXORAS_BASE_URL;
}

export function getAixorasApiKey() {
  return localStorage.getItem(AIXORAS_API_KEY_KEY) || '';
}

export function getAixorasImageApiKey() {
  return localStorage.getItem(AIXORAS_IMAGE_API_KEY_KEY) || getAixorasApiKey();
}

export function getAixorasVideoApiKey() {
  return localStorage.getItem(AIXORAS_VIDEO_API_KEY_KEY) || getAixorasApiKey();
}

export function getAixorasImageModel() {
  return localStorage.getItem(AIXORAS_IMAGE_MODEL_KEY) || DEFAULT_AIXORAS_IMAGE_MODEL;
}

export function getImageProvider() {
  const provider = localStorage.getItem(IMAGE_PROVIDER_KEY) || DEFAULT_IMAGE_PROVIDER;
  return IMAGE_PROVIDER_OPTIONS.some((option) => option.id === provider) ? provider : DEFAULT_IMAGE_PROVIDER;
}

export function getImageProviderOption(provider = getImageProvider()) {
  return IMAGE_PROVIDER_OPTIONS.find((option) => option.id === provider) || IMAGE_PROVIDER_OPTIONS[0];
}

export function getChange2ProBaseUrl() {
  return localStorage.getItem(CHANGE2PRO_BASE_URL_KEY) || DEFAULT_CHANGE2PRO_BASE_URL;
}

export function getChange2ProImageApiKey() {
  return localStorage.getItem(CHANGE2PRO_IMAGE_API_KEY_KEY) || '';
}

export function getChange2ProImageModel() {
  return localStorage.getItem(CHANGE2PRO_IMAGE_MODEL_KEY) || DEFAULT_CHANGE2PRO_IMAGE_MODEL;
}

export function getImageModel(provider = getImageProvider()) {
  return String(provider).startsWith('change2pro') ? getChange2ProImageModel() : getAixorasImageModel();
}

export function setBaseUrl(url) {
  localStorage.setItem(BASE_URL_KEY, normalizeBaseUrl(url || DEFAULT_BASE_URL));
}

export function setApiKey(key) {
  localStorage.setItem(API_KEY_KEY, key);
}

export function setAixorasBaseUrl(url) {
  localStorage.setItem(AIXORAS_BASE_URL_KEY, normalizeBaseUrl(url || DEFAULT_AIXORAS_BASE_URL));
}

export function setAixorasApiKey(key) {
  localStorage.setItem(AIXORAS_API_KEY_KEY, key);
}

export function setAixorasImageApiKey(key) {
  localStorage.setItem(AIXORAS_IMAGE_API_KEY_KEY, key);
}

export function setAixorasVideoApiKey(key) {
  localStorage.setItem(AIXORAS_VIDEO_API_KEY_KEY, key);
}

export function setAixorasImageModel(model) {
  localStorage.setItem(AIXORAS_IMAGE_MODEL_KEY, String(model || DEFAULT_AIXORAS_IMAGE_MODEL).trim());
}

export function setImageProvider(provider) {
  const nextProvider = IMAGE_PROVIDER_OPTIONS.some((option) => option.id === provider) ? provider : DEFAULT_IMAGE_PROVIDER;
  localStorage.setItem(IMAGE_PROVIDER_KEY, nextProvider);
}

export function setChange2ProBaseUrl(url) {
  localStorage.setItem(CHANGE2PRO_BASE_URL_KEY, normalizeBaseUrl(url || DEFAULT_CHANGE2PRO_BASE_URL));
}

export function setChange2ProImageApiKey(key) {
  localStorage.setItem(CHANGE2PRO_IMAGE_API_KEY_KEY, key);
}

export function setChange2ProImageModel(model) {
  localStorage.setItem(CHANGE2PRO_IMAGE_MODEL_KEY, String(model || DEFAULT_CHANGE2PRO_IMAGE_MODEL).trim());
}

export function getAixorasAuthorizedHeaders() {
  const token = getAixorasApiKey().trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAixorasImageAuthorizedHeaders() {
  const token = getAixorasImageApiKey().trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getChange2ProImageAuthorizedHeaders() {
  const token = getChange2ProImageApiKey().trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getImageAuthorizedHeaders(provider = getImageProvider()) {
  return String(provider).startsWith('change2pro')
    ? getChange2ProImageAuthorizedHeaders()
    : getAixorasImageAuthorizedHeaders();
}

export function getAixorasVideoAuthorizedHeaders() {
  const token = getAixorasVideoApiKey().trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

function parseSize(size) {
  const [width, height] = String(size || '').split('x').map(Number);
  if (!width || !height) {
    throw new Error('Invalid size. Use WIDTHxHEIGHT, for example 1152x768.');
  }
  return { width, height };
}

function extractMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return data.error.message;
  if (data.error && typeof data.error === 'object') {
    return data.error.detail || data.error.message || JSON.stringify(data.error).slice(0, 500);
  }
  if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg || item.message || String(item)).join('; ');
  if (typeof data.detail === 'object') return JSON.stringify(data.detail).slice(0, 500);
  return data.message || data.detail || fallback;
}

function normalizeProviderErrorMessage(message) {
  if (String(message || '').includes('无权访问') && String(message || '').includes('分组')) {
    return `${message}。这通常是 Aixoras API Key 没有开通该模型所在分组权限，或当前令牌/账号不可用。请在 Aixoras 控制台确认令牌已允许访问“图像视频”分组，并且有可用额度。`;
  }

  return message;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError' || String(e.message || '').includes('signal is aborted')) {
      const error = new Error(`请求超过 ${Math.round(timeoutMs / 1000)} 秒未返回，已自动停止等待。`);
      error.status = 408;
      error.timeout = true;
      throw error;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request(path, options = {}) {
  const token = (options.apiKey ?? getApiKey()).trim();
  if (!token) {
    throw new Error(options.missingKeyMessage || 'Missing API Key. Configure it in Settings first.');
  }

  const baseUrl = options.baseUrl || getBaseUrl();
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };
  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;
  delete fetchOptions.baseUrl;
  delete fetchOptions.apiKey;
  delete fetchOptions.missingKeyMessage;

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      const error = new Error(`Agnes API 请求超过 ${Math.round(timeoutMs / 1000)} 秒未返回，已自动停止等待。`);
      error.status = 408;
      error.timeout = true;
      error.baseUrl = normalizeBaseUrl(baseUrl);
      throw error;
    }
    throw new Error(
      `网络请求失败：${e.message || '无法连接 Agnes API'}。如果你在浏览器里直连 https://apihub.agnes-ai.com，请把 API Base URL 改成 /api-proxy。`,
      { cause: e },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const error = new Error(normalizeProviderErrorMessage(extractMessage(data, `HTTP ${res.status}: ${res.statusText}`)));
    error.status = res.status;
    error.statusText = res.statusText;
    error.data = data;
    throw error;
  }

  return data || {};
}

async function requestFormData(path, formData, options = {}) {
  const token = (options.apiKey ?? getApiKey()).trim();
  if (!token) {
    throw new Error(options.missingKeyMessage || 'Missing API Key. Configure it in Settings first.');
  }

  const baseUrl = options.baseUrl || getBaseUrl();
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const res = await fetchWithTimeout(url, {
    method: options.method || 'POST',
    body: formData,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  }, timeoutMs);
  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const error = new Error(normalizeProviderErrorMessage(extractMessage(data, `HTTP ${res.status}: ${res.statusText}`)));
    error.status = res.status;
    error.statusText = res.statusText;
    error.data = data;
    throw error;
  }

  return data || {};
}

function parsePublicMediaUploadResult(provider, text) {
  const trimmed = String(text || '').trim();

  if (provider === 'litterbox') {
    if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;
    throw new Error(trimmed || 'Litterbox 没有返回媒体 URL');
  }

  if (provider === 'uguu') {
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error(trimmed || 'Uguu 没有返回 JSON');
    }

    const url = data?.files?.[0]?.url;
    if (data?.success && /^https?:\/\//i.test(url || '')) return url;
    throw new Error(data?.errors?.join?.('; ') || data?.description || 'Uguu 上传失败');
  }

  throw new Error('未知公网媒体上传服务');
}

async function uploadPublicMediaViaProvider(file, provider) {
  const form = new FormData();
  let endpoint;

  if (provider === 'litterbox') {
    endpoint = '/public-upload/litterbox';
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', file, file.name || 'reference-media');
  } else if (provider === 'uguu') {
    endpoint = '/public-upload/uguu';
    form.append('files[]', file, file.name || 'reference-media');
  } else {
    throw new Error('未知公网媒体上传服务');
  }

  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    body: form,
  }, PUBLIC_MEDIA_UPLOAD_TIMEOUT_MS);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }

  return parsePublicMediaUploadResult(provider, text);
}

export async function uploadPublicMedia(file) {
  const errors = [];

  for (const provider of ['litterbox', 'uguu']) {
    try {
      return await uploadPublicMediaViaProvider(file, provider);
    } catch (error) {
      errors.push(`${provider}: ${error.message || '上传失败'}`);
    }
  }

  throw new Error(`公网媒体上传失败：${errors.join('；')}`);
}

export async function uploadPublicImage(file) {
  return uploadPublicMedia(file);
}

function shouldRetryWithProxy(error) {
  return Boolean(error?.timeout) && normalizeBaseUrl(getBaseUrl()) !== DEFAULT_BASE_URL;
}

export async function chatCompletion({
  messages,
  temperature = 0.7,
  top_p,
  max_tokens,
  stream = false,
  tools,
  tool_choice,
}) {
  const body = {
    model: CHAT_MODEL,
    messages,
    temperature,
    stream,
  };

  if (top_p !== undefined) body.top_p = top_p;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  return request('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  });
}

// Agnes image generation uses an OpenAI-compatible endpoint.
export async function generateImage({ prompt, size = '1024x1024', images = [] }) {
  const body = {
    model: IMAGE_MODEL,
    prompt,
    size,
    extra_body: {
      response_format: 'url',
    },
  };

  if (images.length) {
    body.extra_body.image = images;
  }

  return request('/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  });
}

export async function generateImageCompat(params) {
  return generateImage(params);
}

function getAixorasAspectRatioFromSize(size) {
  if (AIXORAS_ALLOWED_ASPECT_RATIOS.includes(String(size || ''))) {
    return String(size);
  }

  try {
    const { width, height } = parseSize(size);
    if (width === height) return '1:1';
    if (width > height) {
      const ratio = width / height;
      if (ratio > 2) return '21:9';
      if (ratio > 1.55) return '16:9';
      if (ratio > 1.35) return '3:2';
      return '4:3';
    }

    const ratio = height / width;
    if (ratio > 1.55) return '9:16';
    if (ratio > 1.35) return '2:3';
    return '3:4';
  } catch {
    return '1:1';
  }
}

function getOpenAIImageSizeFromAspectRatio(size) {
  const aspectRatio = getAixorasAspectRatioFromSize(size);
  const sizes = {
    '1:1': '1024x1024',
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '4:3': '1536x1024',
    '3:4': '1024x1536',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '21:9': '1536x1024',
  };

  if (/^\d+x\d+$/i.test(String(size || ''))) return String(size);
  return sizes[aspectRatio] || '1024x1024';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`${file?.name || '参考图'} 读取失败`));
    reader.readAsDataURL(file);
  });
}

// Aixoras Image2 uses aspect_ratio instead of fixed pixel dimensions.
export async function generateAixorasImage({
  prompt,
  size = '1:1',
  aspect_ratio,
  n = 1,
  quality = DEFAULT_AIXORAS_IMAGE_QUALITY,
  response_format = 'url',
  model = getAixorasImageModel(),
}) {
  const aspectRatio = aspect_ratio || getAixorasAspectRatioFromSize(size);

  if (!AIXORAS_ALLOWED_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new Error(`Aixoras Image2 不支持当前比例 ${aspectRatio}。`);
  }

  const body = {
    model,
    prompt,
    n,
    aspect_ratio: aspectRatio,
    quality,
    response_format,
  };

  return request('/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getAixorasBaseUrl(),
    apiKey: getAixorasImageApiKey(),
    missingKeyMessage: 'Missing Image2 API Key. Configure it in Settings first.',
  });
}

export async function generateChange2ProImage({
  prompt,
  size = '1:1',
  n = 1,
  quality = DEFAULT_AIXORAS_IMAGE_QUALITY,
  model = getChange2ProImageModel(),
}) {
  const body = {
    model,
    prompt,
    n,
    size: getOpenAIImageSizeFromAspectRatio(size),
    quality,
  };

  return request('/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getChange2ProBaseUrl(),
    apiKey: getChange2ProImageApiKey(),
    missingKeyMessage: 'Missing Change2Pro Image API Key. Configure it in Settings first.',
  });
}

export async function generateChange2ProImageWithResponses({
  prompt,
  size = '1:1',
  model = getChange2ProImageModel(),
}) {
  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${prompt}\n\nOutput image aspect/size target: ${getOpenAIImageSizeFromAspectRatio(size)}.`,
          },
        ],
      },
    ],
    tools: [{ type: 'image_generation' }],
  };

  return request('/v1/responses', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getChange2ProBaseUrl(),
    apiKey: getChange2ProImageApiKey(),
    missingKeyMessage: 'Missing Change2Pro Image API Key. Configure it in Settings first.',
  });
}

export async function editAixorasImage({
  prompt,
  image,
  n = 1,
  quality = DEFAULT_AIXORAS_IMAGE_QUALITY,
  response_format = 'url',
  model = getAixorasImageModel(),
}) {
  if (!image) {
    throw new Error('Image2 图生图需要先上传一张参考图。');
  }

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', image, image.name || 'reference.png');
  form.append('n', String(n));
  form.append('quality', quality);
  form.append('response_format', response_format);

  return requestFormData('/v1/images/edits', form, {
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getAixorasBaseUrl(),
    apiKey: getAixorasImageApiKey(),
    missingKeyMessage: 'Missing Image2 API Key. Configure it in Settings first.',
  });
}

export async function editChange2ProImage({
  prompt,
  image,
  n = 1,
  quality = DEFAULT_AIXORAS_IMAGE_QUALITY,
  size = '1:1',
  model = getChange2ProImageModel(),
}) {
  if (!image) {
    throw new Error('Change2Pro 图生图需要先上传一张参考图。');
  }

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', image, image.name || 'reference.png');
  form.append('n', String(n));
  form.append('quality', quality);
  form.append('size', getOpenAIImageSizeFromAspectRatio(size));

  return requestFormData('/v1/images/edits', form, {
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getChange2ProBaseUrl(),
    apiKey: getChange2ProImageApiKey(),
    missingKeyMessage: 'Missing Change2Pro Image API Key. Configure it in Settings first.',
  });
}

export async function editChange2ProImageWithResponses({
  prompt,
  image,
  size = '1:1',
  model = getChange2ProImageModel(),
}) {
  if (!image) {
    throw new Error('Change2Pro Responses 图生图需要先上传一张参考图。');
  }

  const imageUrl = await fileToDataUrl(image);
  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${prompt}\n\nUse the attached image as the visual reference. Output image aspect/size target: ${getOpenAIImageSizeFromAspectRatio(size)}.`,
          },
          {
            type: 'input_image',
            image_url: imageUrl,
          },
        ],
      },
    ],
    tools: [{ type: 'image_generation' }],
  };

  return request('/v1/responses', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: IMAGE_REQUEST_TIMEOUT_MS,
    baseUrl: getChange2ProBaseUrl(),
    apiKey: getChange2ProImageApiKey(),
    missingKeyMessage: 'Missing Change2Pro Image API Key. Configure it in Settings first.',
  });
}

export async function generateImageByProvider({ provider = getImageProvider(), ...params }) {
  if (provider === 'change2pro-images') return generateChange2ProImage(params);
  if (provider === 'change2pro-responses') return generateChange2ProImageWithResponses(params);
  return generateAixorasImage(params);
}

export async function editImageByProvider({ provider = getImageProvider(), ...params }) {
  if (provider === 'change2pro-images') return editChange2ProImage(params);
  if (provider === 'change2pro-responses') return editChange2ProImageWithResponses(params);
  return editAixorasImage(params);
}

// Agnes video generation is asynchronous: create, then poll /v1/videos/{id}.
export async function generateVideo({
  model = VIDEO_MODEL,
  provider = 'agnes',
  prompt,
  num_frames = 121,
  frame_rate = 24,
  size = '1152x768',
  seed,
  image,
  images = [],
  video,
  videos = [],
  audio,
  audios = [],
  mode,
  negative_prompt,
  duration,
  resolution,
  aspect_ratio,
}) {
  if (provider === 'aixoras-chat') {
    return generateAixorasChatVideo({
      model,
      prompt,
      images,
      image,
      videos,
      video,
      audios,
      audio,
      duration,
      num_frames,
      frame_rate,
      size,
      resolution,
      aspect_ratio,
    });
  }

  if (provider === 'aixoras') {
    return generateAixorasVideo({
      model,
      prompt,
      images,
      image,
      videos,
      video,
      audios,
      audio,
      seed,
      duration,
      num_frames,
      frame_rate,
      size,
      resolution,
      aspect_ratio,
      negative_prompt,
    });
  }

  const { width, height } = parseSize(size);
  const imageInputs = images.length ? images : image ? [image] : [];
  const body = {
    model,
    prompt,
    width,
    height,
    num_frames,
    frame_rate,
  };

  if (seed !== undefined && seed !== '') body.seed = Number(seed);
  if (negative_prompt) body.negative_prompt = negative_prompt;
  if (imageInputs.length === 1 && mode !== 'keyframes') body.image = imageInputs[0];
  if (imageInputs.length > 1 || (imageInputs.length === 1 && mode === 'keyframes')) {
    body.extra_body = { image: imageInputs };
  }
  if (mode) {
    if (body.extra_body) {
      body.extra_body.mode = mode;
    } else {
      body.mode = mode;
    }
  }

  const options = {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: VIDEO_CREATE_TIMEOUT_MS,
  };

  try {
    return await request('/v1/videos', options);
  } catch (error) {
    if (!shouldRetryWithProxy(error)) throw error;
    const retryError = new Error(`${error.message} 已自动切换到 /api-proxy 重试。`);
    retryError.status = error.status;
    retryError.timeout = true;
    retryError.retryingProxy = true;
    try {
      return await request('/v1/videos', {
        ...options,
        baseUrl: DEFAULT_BASE_URL,
      });
    } catch (proxyError) {
      proxyError.proxyRetried = true;
      proxyError.originalError = retryError;
      throw proxyError;
    }
  }
}

function parseDurationSeconds({ duration, num_frames, frame_rate }) {
  if (duration !== undefined && duration !== '') return Number(duration);
  if (num_frames && frame_rate) return Math.max(1, Math.round(Number(num_frames) / Number(frame_rate)));
  return 5;
}

function getAspectRatioFromSize(size) {
  if (AIXORAS_ALLOWED_ASPECT_RATIOS.includes(String(size || ''))) {
    return String(size);
  }

  try {
    const { width, height } = parseSize(size);
    if (width === height) return '1:1';
    return width > height ? '16:9' : '9:16';
  } catch {
    return undefined;
  }
}

function normalizeAixorasResolutionParam(resolution) {
  const value = String(resolution || '').trim();
  return /^\d+p$/i.test(value) ? value.toLowerCase() : '';
}

function buildAixorasChatContent({ prompt, imageInputs, videoInputs, audioInputs, seconds, aspectRatio, resolution }) {
  const referenceLines = [
    ...imageInputs.map((url, index) => `输入图${index + 1}: ${url}`),
    ...videoInputs.map((url, index) => `输入视频${index + 1}: ${url}`),
    ...audioInputs.map((url, index) => `输入音频${index + 1}: ${url}`),
  ];
  const text = [
    prompt,
    '',
    `输出参数：时长 ${seconds} 秒；画幅 ${aspectRatio}；清晰度/档位 ${resolution || 'auto'}。`,
    '必须严格使用用户提供的参考素材约束角色、服装、场景、动作和镜头关系；不要生成水印、字幕、Logo 或平台 UI。',
    referenceLines.length ? `参考素材 URL：\n${referenceLines.join('\n')}` : '',
  ].filter(Boolean).join('\n');

  return [
    { type: 'text', text },
    ...imageInputs.map((url) => ({ type: 'image_url', image_url: { url } })),
    ...videoInputs.map((url) => ({ type: 'video_url', video_url: { url } })),
    ...audioInputs.map((url) => ({ type: 'audio_url', audio_url: { url } })),
  ];
}

async function generateAixorasChatVideo({
  model,
  prompt,
  images = [],
  image,
  videos = [],
  video,
  audios = [],
  audio,
  duration,
  num_frames,
  frame_rate,
  size,
  resolution = 'auto',
  aspect_ratio,
}) {
  const imageInputs = [...images, image].filter(Boolean);
  const videoInputs = [...videos, video].filter(Boolean);
  const audioInputs = [...audios, audio].filter(Boolean);
  const referenceInputs = [...imageInputs, ...videoInputs, ...audioInputs];
  const invalidReferences = referenceInputs.filter((source) => !/^https?:\/\//i.test(String(source || '')));
  const normalizedAspectRatio = aspect_ratio || getAspectRatioFromSize(size) || '16:9';
  const seconds = parseDurationSeconds({ duration, num_frames, frame_rate });

  if (!referenceInputs.length) {
    throw new Error('即梦 Seedance 新渠道必须至少提供 1 个公网图片、视频或音频 URL，已阻止提交以避免扣费。');
  }

  if (invalidReferences.length) {
    throw new Error('即梦 Seedance 新渠道参考素材必须是 http/https 公网 URL，本地上传或 data: URL 不能提交，已阻止扣费请求。');
  }

  if (imageInputs.length > 9) {
    throw new Error(`即梦 Seedance 新渠道最多支持 9 张参考图，收到 ${imageInputs.length} 张，已阻止提交以避免扣费。`);
  }

  if (videoInputs.length > 3) {
    throw new Error(`即梦 Seedance 新渠道最多支持 3 段参考视频，收到 ${videoInputs.length} 段，已阻止提交以避免扣费。`);
  }

  if (audioInputs.length > 3) {
    throw new Error(`即梦 Seedance 新渠道最多支持 3 段参考音频，收到 ${audioInputs.length} 段，已阻止提交以避免扣费。`);
  }

  if (!AIXORAS_ALLOWED_ASPECT_RATIOS.includes(normalizedAspectRatio)) {
    throw new Error(`即梦 Seedance 新渠道不支持当前比例 ${normalizedAspectRatio}，已阻止提交以避免扣费。`);
  }

  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 15) {
    throw new Error(`即梦 Seedance 新渠道当前只允许 1 到 15 秒的整数秒任务，收到 ${seconds} 秒，已阻止提交以避免扣费。`);
  }

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: buildAixorasChatContent({
          prompt,
          imageInputs,
          videoInputs,
          audioInputs,
          seconds,
          aspectRatio: normalizedAspectRatio,
          resolution,
        }),
      },
    ],
    stream: false,
    metadata: {
      duration: seconds,
      seconds: String(seconds),
      aspect_ratio: normalizedAspectRatio,
      resolution,
      reference_images: imageInputs,
      reference_videos: videoInputs,
      reference_audios: audioInputs,
    },
  };

  return request('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: CHAT_VIDEO_CREATE_TIMEOUT_MS,
    baseUrl: getAixorasBaseUrl(),
    apiKey: getAixorasVideoApiKey(),
    missingKeyMessage: 'Missing Seedance API Key. Configure it in Settings first.',
  });
}

async function generateAixorasVideo({
  model,
  prompt,
  images = [],
  image,
  videos = [],
  video,
  audios = [],
  audio,
  seed,
  duration,
  num_frames,
  frame_rate,
  size,
  resolution = '480p',
  aspect_ratio,
  negative_prompt,
}) {
  const imageInputs = [...images, image].filter(Boolean);
  const videoInputs = [...videos, video].filter(Boolean);
  const audioInputs = [...audios, audio].filter(Boolean);
  const referenceInputs = [...imageInputs, ...videoInputs, ...audioInputs];
  const invalidReferences = referenceInputs.filter((source) => !/^https?:\/\//i.test(String(source || '')));
  const normalizedAspectRatio = aspect_ratio || getAspectRatioFromSize(size) || '16:9';
  const apiResolution = normalizeAixorasResolutionParam(resolution);

  if (!referenceInputs.length) {
    throw new Error('Seedance / Aixoras 全能参考必须至少提供 1 个公网图片、视频或音频 URL，已阻止提交以避免扣费。');
  }

  if (invalidReferences.length) {
    throw new Error('Seedance / Aixoras 参考素材必须是 http/https 公网 URL，本地上传或 data: URL 不能提交，已阻止扣费请求。');
  }

  if (imageInputs.length > 9) {
    throw new Error(`Seedance / Aixoras 最多支持 9 张参考图，收到 ${imageInputs.length} 张，已阻止提交以避免扣费。`);
  }

  if (videoInputs.length > 3) {
    throw new Error(`Seedance / Aixoras 最多支持 3 段参考视频，收到 ${videoInputs.length} 段，已阻止提交以避免扣费。`);
  }

  if (audioInputs.length > 3) {
    throw new Error(`Seedance / Aixoras 最多支持 3 段参考音频，收到 ${audioInputs.length} 段，已阻止提交以避免扣费。`);
  }

  if (!AIXORAS_ALLOWED_ASPECT_RATIOS.includes(normalizedAspectRatio)) {
    throw new Error(`Seedance / Aixoras 不支持当前比例 ${normalizedAspectRatio}，已阻止提交以避免扣费。`);
  }

  const seconds = parseDurationSeconds({ duration, num_frames, frame_rate });
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 15) {
    throw new Error(`Seedance / Aixoras 当前只允许 1 到 15 秒的整数秒任务，收到 ${seconds} 秒，已阻止提交以避免扣费。`);
  }

  const body = {
    model,
    prompt,
    duration: seconds,
    seconds: String(seconds),
    metadata: {
      watermark: false,
      aspect_ratio: normalizedAspectRatio,
    },
  };

  if (apiResolution) {
    body.resolution = apiResolution;
    body.size = apiResolution;
    body.metadata.resolution = apiResolution;
  }

  if (imageInputs.length) {
    body.images = imageInputs;
    body.reference_images = imageInputs;
    body.image = imageInputs[0];
    body.input_reference = imageInputs[0];
    body.metadata.reference_images = imageInputs;
  }
  if (videoInputs.length) {
    body.metadata.reference_videos = videoInputs;
  }
  if (audioInputs.length) {
    body.metadata.reference_audios = audioInputs;
  }
  if (seed !== undefined && seed !== '') body.metadata.seed = Number(seed);
  if (negative_prompt) body.metadata.negative_prompt = negative_prompt;

  return request('/v1/video/generations', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: VIDEO_CREATE_TIMEOUT_MS,
    baseUrl: getAixorasBaseUrl(),
    apiKey: getAixorasVideoApiKey(),
    missingKeyMessage: 'Missing Seedance API Key. Configure it in Settings first.',
  });
}

export async function getVideoStatus(videoId, options = {}) {
  if (options.provider === 'aixoras') {
    return request(`/v1/video/generations/${encodeURIComponent(videoId)}`, {
      timeoutMs: VIDEO_STATUS_TIMEOUT_MS,
      baseUrl: getAixorasBaseUrl(),
      apiKey: getAixorasVideoApiKey(),
      missingKeyMessage: 'Missing Seedance API Key. Configure it in Settings first.',
    });
  }

  return request(`/v1/videos/${encodeURIComponent(videoId)}`, {
    timeoutMs: VIDEO_STATUS_TIMEOUT_MS,
  });
}

export async function getVideoStatusByVideoId(videoId) {
  return request(`/agnesapi?video_id=${encodeURIComponent(videoId)}`, {
    timeoutMs: VIDEO_STATUS_TIMEOUT_MS,
  });
}

export async function getTaskStatus(taskId) {
  return getVideoStatus(taskId);
}

export async function getModels() {
  return request('/v1/models');
}

function normalizeAixorasMediaUrl(url) {
  if (!url) return '';
  const value = String(url);
  try {
    const parsed = new URL(value);
    if (['api.aixoras.com', 'aixoras.com', 'www.aixoras.com'].includes(parsed.hostname)) {
      return `${DEFAULT_AIXORAS_BASE_URL}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Keep relative or non-standard URLs unchanged.
  }
  return value;
}

function getMediaDownloadProxyUrl(url) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) return '';
  return `/media-download-proxy?url=${encodeURIComponent(value)}`;
}

export async function fetchAixorasMediaBlob(url) {
  const normalizedUrl = normalizeAixorasMediaUrl(url);
  if (!normalizedUrl) throw new Error('Missing Aixoras media URL.');
  const proxyUrl = getMediaDownloadProxyUrl(url);
  const attempts = [normalizedUrl, proxyUrl].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index);
  let lastError = null;

  for (const attemptUrl of attempts) {
    try {
      const res = await fetch(attemptUrl, {
        headers: attemptUrl.startsWith(DEFAULT_AIXORAS_BASE_URL) ? getAixorasVideoAuthorizedHeaders() : {},
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.clone().json();
          message = extractMessage(data, message);
        } catch {
          try {
            message = await res.text() || message;
          } catch {
            // Ignore body parsing failures.
          }
        }
        throw new Error(normalizeProviderErrorMessage(message));
      }

      return res.blob();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `无法取回 Aixoras 视频文件：${lastError?.message || '网络请求被浏览器拦截'}。已尝试直连和本地下载代理，请确认本地服务仍在运行。`,
    { cause: lastError },
  );
}
