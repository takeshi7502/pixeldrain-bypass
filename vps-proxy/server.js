import express from 'express';
import { gotScraping } from 'got-scraping';
const app = express();
const PORT = process.env.PORT || 3456;

// ============================================
// Dải IPv6 Vultr của bạn (Thay phần đầu tiên của IPv6 /64)
// Prefix của bạn: 2401:c080:1400:6d4f
const IPV6_PREFIX = '2401:c080:1400:6d4f';
// ============================================

// State để Cloudflare không bị sốc vì thay IP quá nhanh cho mỗi Request
// Mình thiết lập 1 IP sẽ dùng để tải 50 file (hoặc 50GB), sau đó đổi IP tiếp theo
let currentIPv6Suffix = getRandomIPv6Suffix();
let requestCount = 0;

// Hàm sinh IP tĩnh: Lấy random 1 trong 1000 IP bạn vừa gán vào VPS
function getRandomIPv6Suffix() {
  const r = Math.floor(Math.random() * 1000) + 1;
  return r.toString(16);
}

// GET /download/:fileId  →  stream file từ Pixeldrain
app.get('/download/:fileId', (req, res) => {
  const { fileId } = req.params;

  if (!fileId || !/^[a-zA-Z0-9]+$/.test(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  // Đảo IP sau mỗi 50 lượt Request để lách thuật toán Rate-Limit của Cloudflare
  requestCount++;
  if (requestCount > 50) {
    currentIPv6Suffix = getRandomIPv6Suffix();
    requestCount = 0;
    console.log(`[Proxy] Switched to NEW IPv6 rotation block: ${currentIPv6Suffix}`);
  }

  const randomIPv6 = `${IPV6_PREFIX}::${currentIPv6Suffix}`;
  console.log(`[Proxy] Lấy file ${fileId} qua IP ra: ${randomIPv6}`);

  const targetUrl = `https://pixeldrain.com/api/file/${fileId}?download`;

  // Sử dụng got-scraping để giả lập LUỒNG GIAO TIẾP TLS của Chrome đời mới 
  // Cloudflare AI sẽ không nhìn thấy dấu hiệu của Tool NodeJS nữa
  const proxyStream = gotScraping.stream(targetUrl, {
    headerGeneratorOptions: {
      browsers: [
        { name: 'chrome', minVersion: 110, maxVersion: 122 },
        { name: 'firefox', minVersion: 110 }
      ],
      devices: ['desktop'],
      operatingSystems: ['windows', 'macos']
    },
    localAddress: randomIPv6, // Vẫn phải trói IP Outbound ra IPv6 ảo của Vultr
    throwHttpErrors: false,
    http2: true // BẬT HTTP/2 (CHÌA KHÓA để có Chữ Ký mã hóa TLS xịn)
  });

  proxyStream.on('response', (proxyRes) => {
    if (proxyRes.statusCode === 403) {
      console.log('Got 403 Blocked. Cloudflare may still detect us.');
      return res.status(403).send('Pixeldrain returned 403 - Blocked or Private.');
    }

    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Content-Disposition': proxyRes.headers['content-disposition'] || `attachment; filename="${fileId}"`,
      'Content-Length': proxyRes.headers['content-length'] || '',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', 
      'Cache-Control': 'no-cache'
    });
  });

  proxyStream.on('error', (err) => {
    console.error('Request error:', err.message);
    if (!res.headersSent) {
      res.status(500).send(`Proxy request failed: ${err.message}`);
    }
  });

  proxyStream.pipe(res);
});

app.listen(PORT, () => {
  console.log(`Pixeldrain Proxy chạy port ${PORT}. Đã bật Fake TLS Fingerprint!`);
});
