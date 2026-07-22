import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function mediaDownloadProxyPlugin() {
  const handleProxy = async (req, res, next) => {
    if (!req.url?.startsWith('/media-download-proxy')) {
      next()
      return
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost')
      const target = requestUrl.searchParams.get('url')

      if (!target) {
        res.statusCode = 400
        res.end('Missing url')
        return
      }

      const targetUrl = new URL(target)
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        res.statusCode = 400
        res.end('Unsupported url protocol')
        return
      }

      const upstream = await fetch(targetUrl, {
        headers: {
          accept: req.headers.accept || '*/*',
          'user-agent': 'Mozilla/5.0 AgnesAI/1.0',
        },
        redirect: 'follow',
      })

      if (!upstream.ok) {
        res.statusCode = upstream.status
        res.end(`Download upstream failed: ${upstream.status}`)
        return
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const contentLength = upstream.headers.get('content-length')
      const disposition = upstream.headers.get('content-disposition')

      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (contentLength) res.setHeader('Content-Length', contentLength)
      if (disposition) res.setHeader('Content-Disposition', disposition)

      const bytes = new Uint8Array(await upstream.arrayBuffer())
      res.end(bytes)
    } catch (error) {
      res.statusCode = 502
      res.end(`Download proxy failed: ${error.message || 'Unknown error'}`)
    }
  }

  return {
    name: 'agnes-media-download-proxy',
    configureServer(server) {
      server.middlewares.use(handleProxy)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleProxy)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [mediaDownloadProxyPlugin(), react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api-proxy': {
        target: 'https://apihub.agnes-ai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
      },
      '/aixoras-proxy': {
        target: 'https://api.aixoras.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aixoras-proxy/, ''),
      },
      '/change2pro-proxy': {
        target: 'https://api.change2pro.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/change2pro-proxy/, ''),
      },
      '/public-upload/litterbox': {
        target: 'https://litterbox.catbox.moe',
        changeOrigin: true,
        rewrite: () => '/resources/internals/api.php',
      },
      '/public-upload/uguu': {
        target: 'https://uguu.se',
        changeOrigin: true,
        rewrite: () => '/upload.php',
      },
    },
  },
})
