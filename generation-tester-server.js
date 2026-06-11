import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { GenerationEngine } from './generation-engine/index.js';

const PORT = 3004;

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniFlow — Generation Engine Tester</title>
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
      --primary: #10b981;
      --primary-hover: #34d399;
      --success: #10b981;
      --warning: #f59e0b;
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
      background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
      top: -100px;
      left: -100px;
      z-index: -1;
      pointer-events: none;
    }

    .glow-right {
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
      bottom: -100px;
      right: -100px;
      z-index: -1;
      pointer-events: none;
    }

    header {
      max-width: 1200px;
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
      background: linear-gradient(135deg, #10b981, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 8px rgba(16, 185, 129, 0.3));
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

    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 10px var(--success);
    }

    main {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 480px 1fr;
      gap: 32px;
      align-items: start;
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

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, textarea, select {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      transition: all 0.2s ease;
      outline: none;
    }

    input:focus, textarea:focus, select:focus {
      border-color: var(--primary);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
    }

    button.btn-primary {
      background: var(--primary);
      color: #000;
      border: none;
      padding: 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    button.btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
    }

    button.btn-primary:disabled {
      background: #27272a;
      color: #71717a;
      cursor: not-allowed;
    }

    .workspace-panel {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .console-box {
      background: #040405;
      border: 1px solid var(--border);
      border-radius: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      padding: 16px;
      height: 350px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .console-line {
      display: flex;
      gap: 12px;
    }

    .console-time {
      color: #71717a;
      flex-shrink: 0;
    }

    .console-text {
      color: #e4e4e7;
      word-break: break-all;
    }

    .console-text.system {
      color: #3b82f6;
    }

    .console-text.success {
      color: #10b981;
    }

    .console-text.error {
      color: #ef4444;
    }

    .console-text.warn {
      color: #f59e0b;
    }

    .results-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      display: none;
      flex-direction: column;
      gap: 16px;
      animation: fadeIn 0.4s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .result-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .result-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .result-val {
      font-size: 14px;
      font-weight: 700;
    }

    .val-true {
      color: var(--success);
    }

    .val-false {
      color: var(--error);
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="glow-right"></div>

  <header>
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div class="brand-text">
        <h1>OmniFlow</h1>
        <p>Generation Engine Automation Tester</p>
      </div>
    </div>
    <div class="status-badge">
      <div class="status-dot" id="statusDot"></div>
      <span id="statusText">Ready</span>
    </div>
  </header>

  <main>
    <!-- Config Panel -->
    <section class="panel">
      <div class="panel-title">🔧 Job Configuration</div>
      
      <div class="form-group">
        <label for="clipId">Clip Identifier</label>
        <input type="text" id="clipId" value="clip_1" placeholder="e.g. clip_001">
      </div>

      <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px; margin-bottom: 8px;">
        <input type="checkbox" id="runBatch" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
        <label for="runBatch" style="cursor: pointer; text-transform: none; font-size: 13px; font-weight: 500;">Run in Batch Mode (3 Parallel Tabs)</label>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">
        <input type="checkbox" id="useSample" checked style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
        <label for="useSample" style="cursor: pointer; text-transform: none; font-size: 13px; font-weight: 500;">Use sample test clip (auto-generated)</label>
      </div>

      <div class="form-group" id="videoPathGroup" style="display: none;">
        <label for="videoPath">Absolute Video Path</label>
        <input type="text" id="videoPath" placeholder="/Users/suryanshsingh/..." value="">
      </div>

      <div class="form-group">
        <label for="prompt">Prompt Instruction</label>
        <textarea id="prompt" rows="3" placeholder="Enter target style, timing, and details...">Create a cinematic drama with high-contrast lighting, slow-motion details, and a dark visual mood.</textarea>
      </div>

      <div class="form-group">
        <label for="geminiUrl">Gemini URL (Default matches Gemini Webapp)</label>
        <input type="text" id="geminiUrl" value="https://gemini.google.com" placeholder="https://gemini.google.com">
      </div>

      <div class="form-group">
        <label for="chromePort">Chrome Debugging Port</label>
        <input type="number" id="chromePort" value="9222">
      </div>

      <button id="runBtn" class="btn-primary">
        <span>🚀 Start Browser Automation</span>
      </button>

      <button id="mockMergeBtn" class="btn-primary" style="background: var(--warning); margin-top: 10px;">
        <span>🧪 Test Merger (Mock Data)</span>
      </button>
    </section>

    <!-- Workspace Logging & Results -->
    <section class="workspace-panel">
      <div class="panel" style="flex: 1;">
        <div class="panel-title">💻 Live Execution Logs</div>
        <div id="console" class="console-box">
          <div class="console-line">
            <span class="console-time">--:--:--</span>
            <span class="console-text system">System ready. Configure parameters and click start. Make sure your local debuggable Google Chrome window is open.</span>
          </div>
        </div>
      </div>

      <!-- Result Visualizer -->
      <div id="resultsContainer" style="display: flex; flex-direction: column; gap: 16px; width: 100%;"></div>
    </section>
  </main>

  <script>
    const runBtn = document.getElementById('runBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const consoleBox = document.getElementById('console');
    const resultsContainer = document.getElementById('resultsContainer');
    const useSampleCheckbox = document.getElementById('useSample');
    const videoPathGroup = document.getElementById('videoPathGroup');
    const runBatchCheckbox = document.getElementById('runBatch');
    const mockMergeBtn = document.getElementById('mockMergeBtn');

    useSampleCheckbox.addEventListener('change', () => {
      if (useSampleCheckbox.checked) {
        videoPathGroup.style.display = 'none';
      } else {
        videoPathGroup.style.display = 'flex';
      }
    });

    function log(message, type = 'info') {
      const line = document.createElement('div');
      line.className = 'console-line';
      const time = new Date().toLocaleTimeString();
      line.innerHTML = \`<span class="console-time">\${time}</span><span class="console-text \${type}">\${escapeHtml(message)}</span>\`;
      consoleBox.appendChild(line);
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function setStatus(state, label) {
      statusDot.className = 'status-dot';
      statusText.innerText = label;
      if (state === 'running') {
        statusDot.style.background = 'var(--warning)';
        statusDot.style.boxShadow = '0 0 10px var(--warning)';
      } else if (state === 'success') {
        statusDot.style.background = 'var(--success)';
        statusDot.style.boxShadow = '0 0 10px var(--success)';
      } else if (state === 'error') {
        statusDot.style.background = 'var(--error)';
        statusDot.style.boxShadow = '0 0 10px var(--error)';
      } else {
        statusDot.style.background = '#71717a';
        statusDot.style.boxShadow = 'none';
      }
    }

    function createResultCard(idSuffix) {
      const card = document.createElement('div');
      card.className = 'results-card';
      card.style.display = 'flex';
      card.innerHTML = \`
        <div class="panel-title" style="color: var(--success);">✓ Automation Completed (\${idSuffix})</div>
        <div class="results-grid">
          <div class="result-item"><span class="result-label">Clip ID</span><span id="resClipId_\${idSuffix}" class="result-val">—</span></div>
          <div class="result-item"><span class="result-label">Tab ID</span><span id="resTabId_\${idSuffix}" class="result-val">—</span></div>
          <div class="result-item"><span class="result-label">Video Uploaded</span><span id="resUploaded_\${idSuffix}" class="result-val">—</span></div>
          <div class="result-item"><span class="result-label">Prompt Injected</span><span id="resPrompt_\${idSuffix}" class="result-val">—</span></div>
          <div class="result-item"><span class="result-label">Generation Started</span><span id="resStarted_\${idSuffix}" class="result-val">—</span></div>
          <div class="result-item"><span class="result-label">Generation Completed</span><span id="resCompleted_\${idSuffix}" class="result-val">—</span></div>
        </div>
        <div class="result-item" style="grid-column: span 2;" id="videoUrlWrapper_\${idSuffix}">
          <span class="result-label">Generated Video Source URL</span>
          <a href="#" target="_blank" id="resVideoUrl_\${idSuffix}" class="result-val" style="color: var(--primary); text-decoration: none; word-break: break-all;">—</a>
        </div>
      \`;
      resultsContainer.appendChild(card);
    }

    function renderResult(r, idSuffix) {
      document.getElementById('resClipId_' + idSuffix).innerText = r.clipId || '—';
      document.getElementById('resTabId_' + idSuffix).innerText = r.tabId || '—';
      
      const setBoolLabel = (elId, val) => {
        const el = document.getElementById(elId);
        if(!el) return;
        el.innerText = val ? 'YES' : 'NO';
        el.className = 'result-val ' + (val ? 'val-true' : 'val-false');
      };

      setBoolLabel('resUploaded_' + idSuffix, r.uploaded);
      setBoolLabel('resPrompt_' + idSuffix, r.promptInserted);
      setBoolLabel('resStarted_' + idSuffix, r.generationStarted);
      setBoolLabel('resCompleted_' + idSuffix, r.generationCompleted);

      const videoUrlWrapper = document.getElementById('videoUrlWrapper_' + idSuffix);
      const videoLink = document.getElementById('resVideoUrl_' + idSuffix);
      if (r.videoUrl) {
        videoUrlWrapper.style.display = 'flex';
        videoLink.href = r.videoUrl;
        videoLink.innerText = r.videoUrl;
      } else {
        videoUrlWrapper.style.display = 'none';
      }
    }

    runBtn.addEventListener('click', () => {
      const baseClipId = document.getElementById('clipId').value.trim();
      const useSample = useSampleCheckbox.checked;
      const videoPath = useSample ? '' : document.getElementById('videoPath').value.trim();
      const prompt = document.getElementById('prompt').value.trim();
      const geminiUrl = document.getElementById('geminiUrl').value.trim();
      const chromePort = document.getElementById('chromePort').value.trim();
      const isBatch = runBatchCheckbox.checked;

      if (!useSample && !videoPath) {
        alert("Please enter the absolute video path to upload!");
        return;
      }
      if (!prompt) {
        alert("Please enter the prompt instructions!");
        return;
      }

      runBtn.disabled = true;
      resultsContainer.innerHTML = '';
      setStatus('running', isBatch ? 'Automating (Parallel)...' : 'Automating...');
      consoleBox.innerHTML = '';

      let hasError = false;
      const downloadedPaths = [];
      const tasks = isBatch ? [1, 2, 3] : [1];

      // Run all tasks in parallel
      const runningPromises = tasks.map(index => {
        return new Promise((resolve) => {
          const clipId = isBatch ? baseClipId + "_" + index : baseClipId;
          const currentPrompt = isBatch ? prompt + " (Variation " + index + ")" : prompt;
          const currentVideoPath = videoPath;
          
          log(\`[Client] Starting SSE event listener for \${clipId}...\`, 'system');
          
          const params = new URLSearchParams({ clipId, videoPath: currentVideoPath, prompt: currentPrompt, geminiUrl, chromePort, useSample, sampleIndex: index });
          const sse = new EventSource(\`/api/run-stream?\${params.toString()}\`);

          sse.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);
              if (payload.type === 'log') {
                let styleClass = 'info';
                const text = \`[\${clipId}] \${payload.data}\`;
                if (text.includes('success') || text.includes('complete') || text.includes('verified')) {
                  styleClass = 'success';
                } else if (text.includes('warn')) {
                  styleClass = 'warn';
                }
                log(text, styleClass);
              } else if (payload.type === 'error') {
                log(\`[\${clipId}] \${payload.data}\`, 'error');
                hasError = true;
              } else if (payload.type === 'result') {
                createResultCard(index);
                renderResult(payload.data, index);
                if (payload.data.downloadedPath) {
                  downloadedPaths.push(payload.data.downloadedPath);
                }
              }
            } catch (err) {
              log('Error parsing event data: ' + err.message, 'error');
            }
          };

          sse.onerror = () => {
            sse.close();
            resolve();
          };
        });
      });

      Promise.all(runningPromises).then(async () => {
        runBtn.disabled = false;
        if (hasError) {
          setStatus('error', 'Failed');
        } else {
          setStatus('success', 'Completed');
          
          if (isBatch && downloadedPaths.length > 1) {
            log('[Client] Triggering post-generation merge process...', 'system');
            try {
              const mergeRes = await fetch('/api/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputPaths: downloadedPaths.sort() })
              });
              const mergeData = await mergeRes.json();
              if (mergeData.success) {
                log('[Client] Successfully merged videos into: ' + mergeData.finalPath, 'success');
                
                // Display Final Video Link
                const card = document.createElement('div');
                card.className = 'results-card';
                card.style.display = 'flex';
                card.innerHTML = \`
                  <div class="panel-title" style="color: var(--primary);">🎬 Final Merged Video</div>
                  <div class="result-item">
                    <span class="result-label">Local Path</span>
                    <span class="result-val" style="word-break: break-all;">\${mergeData.finalPath}</span>
                  </div>
                \`;
                resultsContainer.appendChild(card);
                
              } else {
                log('[Client] Merge failed: ' + mergeData.error, 'error');
              }
            } catch (e) {
              log('[Client] Merge request error: ' + e.message, 'error');
            }
          }
        }
      });
    });

    mockMergeBtn.addEventListener('click', async () => {
      mockMergeBtn.disabled = true;
      runBtn.disabled = true;
      resultsContainer.innerHTML = '';
      consoleBox.innerHTML = '';
      setStatus('running', 'Generating Mock Clips...');
      log('[Client] Triggering generation of mock clips...', 'system');
      try {
        const res = await fetch('/api/generate-mock-clips', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          log('[Client] Mock clips generated. Triggering actual /api/merge endpoint...', 'system');
          
          const downloadedPaths = data.mockPaths;
          const mergeRes = await fetch('/api/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputPaths: downloadedPaths.sort() })
          });
          
          const mergeData = await mergeRes.json();
          if (mergeData.success) {
            log('[Client] Successfully merged videos into: ' + mergeData.finalPath, 'success');
            const card = document.createElement('div');
            card.className = 'results-card';
            card.style.display = 'flex';
            card.innerHTML = \`
              <div class="panel-title" style="color: var(--primary);">🎬 Final Merged Video (Mocked)</div>
              <div class="result-item">
                <span class="result-label">Local Path</span>
                <span class="result-val" style="word-break: break-all;">\${mergeData.finalPath}</span>
              </div>
            \`;
            resultsContainer.appendChild(card);
            setStatus('success', 'Merge Complete');
          } else {
            log('[Client] Merge failed: ' + mergeData.error, 'error');
            setStatus('error', 'Failed');
          }
        } else {
          log('[Client] Mock generation failed: ' + data.error, 'error');
          setStatus('error', 'Failed');
        }
      } catch(e) {
        log('[Client] Request error: ' + e.message, 'error');
        setStatus('error', 'Failed');
      }
      mockMergeBtn.disabled = false;
      runBtn.disabled = false;
    });
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/merge') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { inputPaths } = JSON.parse(body);
        const { PostProcessor } = await import('./video-intelligence/postProcessor.js');
        const processor = new PostProcessor();
        const outputPath = path.resolve('./omniflow-temp/final_merged.mp4');
        const finalPath = await processor.mergeVideos(inputPaths, outputPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, finalPath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/generate-mock-clips') {
    (async () => {
      try {
        const { execSync } = await import('child_process');
        const tempDir = path.resolve('./omniflow-temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const mockPaths = [];
        const files = fs.readdirSync(tempDir);
        const generatedClips = files.filter(f => f.endsWith('_generated.mp4')).map(f => path.join(tempDir, f));
        
        if (generatedClips.length >= 2) {
          console.log('[Server] Found existing generated clips. Using them as mock data:', generatedClips);
          mockPaths.push(...generatedClips);
        } else {
          console.log('[Server] Not enough generated clips found. Generating fallback colored mock clips...');
          const colors = ['red', 'green', 'blue'];
          for (let i = 0; i < 3; i++) {
            const mockPath = path.join(tempDir, `mock_clip_${i+1}.mp4`);
            execSync(`ffmpeg -y -f lavfi -i color=c=${colors[i]}:s=640x360:r=30:d=2 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:d=2 -c:v libx264 -c:a aac -shortest "${mockPath}"`, { stdio: 'ignore' });
            mockPaths.push(mockPath);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, mockPaths }));
      } catch (err) {
        console.error('[Server] Mock clip generation failed:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/run-stream') {
    const videoPath = parsedUrl.searchParams.get('videoPath');
    const prompt = parsedUrl.searchParams.get('prompt');
    const clipId = parsedUrl.searchParams.get('clipId') || 'clip_1';
    const geminiUrl = parsedUrl.searchParams.get('geminiUrl') || 'https://gemini.google.com';
    const chromePort = parseInt(parsedUrl.searchParams.get('chromePort') || '9222', 10);
    const useSample = parsedUrl.searchParams.get('useSample');
    const sampleIndex = parsedUrl.searchParams.get('sampleIndex') || '1';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const sendEvent = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      sendEvent('log', args.join(' '));
    };
    console.error = (...args) => {
      originalError(...args);
      sendEvent('error', args.join(' '));
    };

    (async () => {
      try {
        let finalVideoPath = videoPath;
        
        if (useSample === 'true') {
          const tempDir = path.resolve('./omniflow-temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const samplePath = path.join(tempDir, `sample_test_clip_${sampleIndex}.mp4`);
          
          if (!fs.existsSync(samplePath)) {
            console.log(`[Server] Generating 3-second sample MP4 clip via FFmpeg at: ${samplePath}`);
            try {
              const { execSync } = await import('child_process');
              execSync(`ffmpeg -y -f lavfi -i testsrc=duration=3:size=640x360:rate=30 -c:v libx264 -crf 23 -pix_fmt yuv420p "${samplePath}"`, { stdio: 'ignore' });
              console.log(`[Server] Sample clip generated successfully.`);
            } catch (e) {
              console.error(`[Server] FFmpeg generation failed. Writing mock video container.`);
              fs.writeFileSync(samplePath, 'mock mp4 content');
            }
          } else {
            console.log(`[Server] Reusing existing sample clip at: ${samplePath}`);
          }
          finalVideoPath = samplePath;
        }

        console.log(`[Server] Initializing GenerationEngine with chromePort: ${chromePort}...`);
        const engine = new GenerationEngine({
          chromePort
        });

        console.log(`[Server] Configuration: ClipID="${clipId}", GeminiUrl="${geminiUrl}"`);
        console.log(`[Server] File: "${finalVideoPath}"`);

        const result = await engine.runJob({
          clipId,
          videoPath: finalVideoPath,
          prompt,
          geminiUrl,
          downloadOutputDir: path.resolve('./omniflow-temp')
        });

        sendEvent('result', result);
        console.log(`[Server] Completed. Result sent.`);
      } catch (err) {
        console.error(`[Server] Execution Error: ${err.message}`);
        sendEvent('error', err.message);
      } finally {
        console.log = originalLog;
        console.error = originalError;
        res.end();
      }
    })();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🎉 Generation Automation Tester running on http://localhost:${PORT}`);
  console.log(`==================================================`);
  console.log(`1. Make sure Chrome is open with remote debugging enabled:`);
  console.log(`   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222`);
  console.log(`2. Open http://localhost:${PORT} in your browser.`);
  console.log(`3. Select "Use sample test clip" (enabled by default) to run directly,`);
  console.log(`   or customize your local MP4 path and editing instruction prompt.`);
  console.log(`4. Run automation to watch Chrome control Gemini E2E!`);
  console.log(`==================================================\n`);
});
