import { Buffer } from 'node:buffer'

export default async function handler(req, res) {
  const target = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url

  if (!target) {
    res.status(400).send('Missing url')
    return
  }

  let targetUrl
  try {
    targetUrl = new URL(target)
  } catch {
    res.status(400).send('Invalid url')
    return
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    res.status(400).send('Unsupported url protocol')
    return
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        accept: req.headers.accept || '*/*',
        'user-agent': 'Mozilla/5.0 AIWorkbench/1.0',
      },
      redirect: 'follow',
    })

    if (!upstream.ok) {
      res.status(upstream.status).send(`Download upstream failed: ${upstream.status}`)
      return
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const contentDisposition = upstream.headers.get('content-disposition')
    const bytes = Buffer.from(await upstream.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition)
    res.status(200).send(bytes)
  } catch (error) {
    res.status(502).send(`Download proxy failed: ${error.message || 'Unknown error'}`)
  }
}
