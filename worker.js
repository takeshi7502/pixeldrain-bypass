// User-Agent pool to mimic browser requests
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
];

// IMPORTANT: Sau khi deploy proxy-worker.js lên Cloudflare (đặt tên pdb01, pdb02...),
// điền URL của các proxy worker vào đây.
// Ví dụ: 'https://pdb01.yourname.workers.dev'
const subDomains = [
  'http://103.3.62.242:3456' // ← Điền URL proxy worker thứ 1 của bạn vào đây
  //  'https://pdb02.yourname.workers.dev'  // ← Điền URL proxy worker thứ 2 (hoặc xoá dòng này nếu chỉ có 1)
];

// --- Main Fetch Handler ---
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route requests
    if (path.startsWith('/api/generate/')) {
      // API: Generate download links
      const fileId = path.replace('/api/generate/', '');
      return handleGenerateAPI(fileId);
    } else {
      // Serve the basic HTML page for all other requests
      return new Response(getHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  },
};

// --- API Logic ---
async function handleGenerateAPI(fileId) {
  if (!fileId || !/^[a-zA-Z0-9]+$/.test(fileId)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid Pixeldrain URL format.' }), {
      headers: { 'Content-Type': 'application/json' }, status: 400
    });
  }

  try {
    const fileInfo = await getPixeldrainFileInfo(fileId);
    if (!fileInfo.success) {
      return new Response(JSON.stringify(fileInfo), {
        headers: { 'Content-Type': 'application/json' }, status: 404
      });
    }

    // Generate multiple proxied download links
    const downloadUrls = subDomains.map(domain => `${domain}/download/${fileId}`); // Note: Assumes proxy workers handle the /download/ path

    return new Response(JSON.stringify({
      success: true,
      fileName: fileInfo.fileName,
      downloadUrls: downloadUrls
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Server error. Please try again later.' }), {
      headers: { 'Content-Type': 'application/json' }, status: 500
    });
  }
}

// --- Helper Functions ---
async function getPixeldrainFileInfo(fileId) {
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const infoUrl = `https://pixeldrain.com/api/file/${fileId}/info`;

  try {
    const response = await fetch(infoUrl, {
      headers: { 'User-Agent': randomUserAgent, 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return { success: false, error: 'Invalid URL or file not found/expired.' };
    }

    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.message || 'Could not retrieve file info.' };
    }

    return { success: true, fileName: data.name || `file_${fileId}` };
  } catch (error) {
    return { success: false, error: 'Failed to connect to Pixeldrain API.' };
  }
}

// --- Minimalist Frontend HTML ---
function getHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minimal Pixeldrain Bypass</title>
    <style>
        body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; background: #f4f4f4; }
        .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        input { width: 100%; padding: 10px; margin-bottom: 10px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        #result a { display: block; margin-top: 10px; padding: 10px; background: #28a745; color: white; text-align: center; text-decoration: none; border-radius: 4px; }
        #result .error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Pixeldrain Bypass Tool</h1>
        <p>Paste a Pixeldrain URL to generate a direct download link.</p>
        <input type="url" id="pixeldrainUrl" placeholder="e.g., https://pixeldrain.com/u/ABC123">
        <button onclick="generateLink()">Generate Link</button>
        <div id="result" style="margin-top: 20px;"></div>
    </div>
    <script>
        async function generateLink() {
            const resultDiv = document.getElementById('result');
            const url = document.getElementById('pixeldrainUrl').value;
            const fileId = url.match(/\\/u\\/([a-zA-Z0-9]+)/)?.[1];

            resultDiv.innerHTML = 'Generating...';

            if (!fileId) {
                resultDiv.innerHTML = '<p class="error">Invalid URL format.</p>';
                return;
            }

            try {
                const response = await fetch('/api/generate/' + fileId);
                const data = await response.json();

                if (data.success) {
                    // Lấy ngẫu nhiên 1 URL trong danh sách Proxy để phân bổ giới hạn 6GB đều nhau
                    const randomIndex = Math.floor(Math.random() * data.downloadUrls.length);
                    const downloadUrl = data.downloadUrls[randomIndex];
                    resultDiv.innerHTML = \`<a href="\${downloadUrl}" target="_blank">Download: \${data.fileName}</a>\`;
                } else {
                    resultDiv.innerHTML = \`<p class="error">\${data.error}</p>\`;
                }
            } catch (err) {
                resultDiv.innerHTML = '<p class="error">Request failed. Check the console.</p>';
            }
        }
    </script>
</body>
</html>
  `;
}
