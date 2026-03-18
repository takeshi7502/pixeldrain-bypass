const express = require('express');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3456;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 5000,
});

app.get('/download/:fileId', (req, res) => {
  const { fileId } = req.params;

  if (!fileId || !/^[a-zA-Z0-9]+$/.test(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  console.log(`[Proxy] Downloading: ${fileId}`);

  const options = {
    hostname: 'pixeldrain.com',
    path: `/api/file/${fileId}?download`,
    method: 'GET',
    agent: agent,
    headers: {
      'User-Agent': randomUA(),
      'Referer': 'https://pixeldrain.com/',
      'Origin': 'https://pixeldrain.com',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Ch-Ua': '"Chromium";v="122", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      ...(req.headers['range'] ? { 'Range': req.headers['range'] } : {}),
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    if (proxyRes.statusCode === 403) {
      console.log(`[Proxy] 403 Blocked for ${fileId}`);
      return res.status(403).send('Pixeldrain returned 403 - Speed limit reached or blocked.');
    }

    console.log(`[Proxy] Streaming ${fileId} - Status: ${proxyRes.statusCode}`);

    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Content-Disposition': proxyRes.headers['content-disposition'] || `attachment; filename="${fileId}"`,
      'Content-Length': proxyRes.headers['content-length'] || '',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy] Error for ${fileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).send(`Proxy request failed: ${err.message}`);
    }
  });

  proxyReq.end();
});

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Proxy] Pixeldrain proxy running on port ${PORT}`);
});
