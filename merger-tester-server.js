import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { PostProcessor } from './video-intelligence/postProcessor.js';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniFlow — Video Merger Tester</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #09090b;
      --card-bg: rgba(20, 20, 25, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --border-hover: rgba(255, 255, 255, 0.16);
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --primary: #ec4899;
      --primary-hover: #f472b6;
      --success: #22c55e;
      --error: #ef4444;
      --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 40px;
      overflow-x: hidden;
    }

    .glow {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 70%);
      top: -100px;
      left: -100px;
      z-index: -1;
      pointer-events: none;
    }

    header {
      max-width: 800px;
      width: 100%;
      margin: 0 auto 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      font-size: 28px;
    }

    .brand-text h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff, #a1a1aa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-text p {
      font-size: 12px;
      color: var(--text-muted);
    }

    main {
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .panel-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-input-wrapper {
      position: relative;
      border: 2px dashed var(--border);
      border-radius: 12px;
      padding: 40px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .file-input-wrapper:hover {
      border-color: var(--primary);
      background: rgba(236, 72, 153, 0.02);
    }

    .file-input-wrapper input[type="file"] {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .file-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .file-label-text {
      font-size: 14px;
      color: #fff;
      font-weight: 600;
    }

    .file-subtext {
      font-size: 12px;
      color: var(--text-muted);
    }

    #fileList {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
    }

    .btn-process {
      background: linear-gradient(135deg, #ec4899, #be185d);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 14px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
    }

    .btn-process:hover:not(:disabled) {
      background: linear-gradient(135deg, #f472b6, #ec4899);
      transform: translateY(-1px);
    }

    .btn-process:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .status-text {
      text-align: center;
      font-size: 14px;
      color: var(--primary);
      font-weight: 600;
      margin-top: 8px;
    }

    video {
      width: 100%;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #000;
      margin-top: 16px;
    }

    .result-link {
      display: block;
      margin-top: 12px;
      padding: 12px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 8px;
      color: var(--success);
      font-size: 13px;
      text-align: center;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="glow"></div>

  <header>
    <div class="brand">
      <div class="brand-icon">✂️</div>
      <div class="brand-text">
        <h1>OmniFlow Merger UI</h1>
        <p>Post-Processing & Video Composition</p>
      </div>
    </div>
  </header>

  <main>
    <section class="panel">
      <div class="panel-title">📂 Upload Video Clips</div>
      
      <div class="file-input-wrapper">
        <div class="file-icon">🎞️</div>
        <span class="file-label-text">Drag & drop clips or click to browse</span>
        <span class="file-subtext">Select multiple .mp4 files (they will be merged in the order you select them)</span>
        <input type="file" id="videoFiles" multiple accept="video/mp4,video/quicktime">
      </div>

      <div id="fileList"></div>

      <button id="mergeBtn" class="btn-process" disabled>✨ Merge Videos</button>
      <div id="statusText" class="status-text"></div>
    </section>

    <section class="panel" id="resultPanel" style="display: none;">
      <div class="panel-title">🎬 Final Merged Video</div>
      <video id="finalVideo" controls playsinline></video>
      <div id="finalPath" class="result-link"></div>
    </section>
  </main>

  <script>
    const fileInput = document.getElementById('videoFiles');
    const fileListEl = document.getElementById('fileList');
    const mergeBtn = document.getElementById('mergeBtn');
    const statusText = document.getElementById('statusText');
    const resultPanel = document.getElementById('resultPanel');
    const finalVideo = document.getElementById('finalVideo');
    const finalPathEl = document.getElementById('finalPath');

    let selectedFiles = [];

    fileInput.addEventListener('change', () => {
      selectedFiles = Array.from(fileInput.files);
      renderFileList();
      mergeBtn.disabled = selectedFiles.length < 2;
      
      if (selectedFiles.length > 0 && selectedFiles.length < 2) {
        statusText.textContent = "Please select at least 2 videos to merge.";
        statusText.style.color = "var(--text-muted)";
      } else {
        statusText.textContent = "";
      }
    });

    function renderFileList() {
      fileListEl.innerHTML = '';
      selectedFiles.forEach((f, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = \`
          <span>\${idx + 1}. \${f.name}</span>
          <span style="color: var(--text-muted);">\${(f.size / (1024*1024)).toFixed(2)} MB</span>
        \`;
        fileListEl.appendChild(item);
      });
    }

    mergeBtn.addEventListener('click', async () => {
      if (selectedFiles.length < 2) return;
      
      mergeBtn.disabled = true;
      fileInput.disabled = true;
      resultPanel.style.display = 'none';
      
      try {
        const uploadedPaths = [];
        
        // Step 1: Upload each file sequentially
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          statusText.textContent = \`Uploading video \${i + 1} of \${selectedFiles.length} (\${file.name})...\`;
          
          const queryParams = new URLSearchParams({ name: file.name, index: i });
          const uploadRes = await fetch(\`/api/upload-clip?\${queryParams.toString()}\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file
          });
          
          if (!uploadRes.ok) throw new Error(\`Failed to upload \${file.name}\`);
          const data = await uploadRes.json();
          uploadedPaths.push(data.filePath);
        }
        
        // Step 2: Request Merge
        statusText.textContent = "Merging clips with FFmpeg... (This may take a few seconds)";
        const mergeRes = await fetch('/api/run-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputPaths: uploadedPaths })
        });
        
        if (!mergeRes.ok) {
          const errData = await mergeRes.json();
          throw new Error(errData.error || "Merging failed.");
        }
        
        const mergeData = await mergeRes.json();
        
        // Display Result
        statusText.textContent = "✅ Merge Complete!";
        statusText.style.color = "var(--success)";
        
        const videoFilename = mergeData.finalPath.split('/').pop() || mergeData.finalPath.split('\\\\').pop();
        finalVideo.src = \`/merged-output/\${encodeURIComponent(videoFilename)}\`;
        finalPathEl.textContent = \`Saved to: \${mergeData.finalPath}\`;
        
        resultPanel.style.display = 'flex';
        
      } catch (err) {
        statusText.textContent = "❌ Error: " + err.message;
        statusText.style.color = "var(--error)";
      } finally {
        mergeBtn.disabled = false;
        fileInput.disabled = false;
      }
    });
  </script>
</body>
</html>`;

const tempUploadDir = path.join(process.cwd(), 'omniflow-temp', 'merger-uploads');
const outputMergedDir = path.join(process.cwd(), 'omniflow-temp', 'merged-output');

// Setup directories
if (!fs.existsSync(tempUploadDir)) fs.mkdirSync(tempUploadDir, { recursive: true });
if (!fs.existsSync(outputMergedDir)) fs.mkdirSync(outputMergedDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Serve UI
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  // Serve output videos for playback
  if (req.method === 'GET' && pathname.startsWith('/merged-output/')) {
    const filename = decodeURIComponent(pathname.replace('/merged-output/', ''));
    const filePath = path.join(outputMergedDir, filename);
    
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
      });
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Upload Clip Endpoint
  if (req.method === 'POST' && pathname === '/api/upload-clip') {
    const filename = parsedUrl.searchParams.get('name') || 'clip.mp4';
    const index = parsedUrl.searchParams.get('index') || '0';
    
    // Add timestamp to prevent overwriting
    const tempInputPath = path.join(tempUploadDir, `upload_${Date.now()}_idx${index}_${filename}`);
    const fileStream = fs.createWriteStream(tempInputPath);
    req.pipe(fileStream);

    fileStream.on('error', (err) => {
      console.error("[MergerUI] Upload write error:", err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    req.on('end', () => {
      console.log(`[MergerUI] Clip uploaded: "${tempInputPath}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, filePath: tempInputPath }));
    });
    return;
  }

  // Run Merge Endpoint
  if (req.method === 'POST' && pathname === '/api/run-merge') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { inputPaths } = JSON.parse(body);
        
        if (!inputPaths || inputPaths.length < 2) {
          throw new Error("At least 2 input paths are required to merge.");
        }

        const processor = new PostProcessor();
        const outputFilename = `final_composition_${Date.now()}.mp4`;
        const outputPath = path.join(outputMergedDir, outputFilename);
        
        console.log(`[MergerUI] Starting merge of ${inputPaths.length} clips into ${outputPath}`);
        const finalPath = await processor.mergeVideos(inputPaths, outputPath);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, finalPath }));
      } catch (err) {
        console.error("[MergerUI] Merge failed:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

const PORT = 3006;
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🎬 OmniFlow Merger UI running on http://localhost:${PORT}`);
  console.log('==================================================');
});
