// =============================================
// Pixeldrain PROXY WORKER
// Deploy this SEPARATELY on Cloudflare Workers
// (e.g., name it: pdb01)
// This worker streams files directly from Pixeldrain
// =============================================

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle download requests: /download/{fileId}
    if (path.startsWith('/download/')) {
      const fileId = path.replace('/download/', '').trim();
      if (!fileId || !/^[a-zA-Z0-9]+$/.test(fileId)) {
        return new Response('Invalid file ID.', { status: 400 });
      }
      return streamPixeldrainFile(fileId, request);
    }

    return new Response('Pixeldrain Proxy Worker is running.', { status: 200 });
  },
};

async function streamPixeldrainFile(fileId, originalRequest) {
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const downloadUrl = `https://pixeldrain.com/api/file/${fileId}?download`;

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': randomUserAgent,
        'Referer': 'https://pixeldrain.com/',
        'Origin': 'https://pixeldrain.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Range': originalRequest.headers.get('Range') || '',
      },
      redirect: 'follow',
    });

    if (!response.ok && response.status !== 206) {
      return new Response(`Failed to fetch from Pixeldrain. Status: ${response.status}`, {
        status: response.status,
      });
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 500 });
  }
}
