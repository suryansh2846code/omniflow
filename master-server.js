import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { URL } from 'url';
import { execSync } from 'child_process';

if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const k = match[1];
      let v = match[2] || '';
      v = v.replace(/(^['"]|['"]$)/g, '').trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}
import { VideoProcessingEngine } from './video-processing/index.js';
import { VideoIntelligenceLayer } from './video-intelligence/index.js';
import { PromptIntelligenceEngine } from './prompt-engine/index.js';
import { PostProcessor } from './video-intelligence/postProcessor.js';
import { GenerationEngine } from './generation-engine/index.js';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniFlow — Master Pipeline</title>
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
      --primary: #8b5cf6;
      --primary-hover: #a855f7;
      --success: #22c55e;
      --error: #ef4444;
      --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

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
      background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
      top: -100px;
      left: -100px;
      z-index: -1;
      pointer-events: none;
    }

    header {
      max-width: 900px;
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
      max-width: 900px;
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
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .panel-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input[type="text"], textarea, input[type="password"] {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      transition: all 0.2s ease;
      outline: none;
    }

    input:focus, textarea:focus {
      border-color: var(--primary);
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
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
      background: rgba(139, 92, 246, 0.02);
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

    .file-icon { font-size: 32px; margin-bottom: 8px; }
    .file-label-text { font-size: 14px; color: #fff; font-weight: 600; }

    .btn-process {
      background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 16px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
      margin-top: 10px;
    }

    .btn-process:hover:not(:disabled) {
      background: linear-gradient(135deg, #a855f7, #7c3aed);
      transform: translateY(-2px);
    }

    .btn-process:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    /* Pipeline Tracker */
    .tracker {
      display: none;
      flex-direction: column;
      gap: 16px;
      padding: 24px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .step {
      display: flex;
      align-items: center;
      gap: 16px;
      opacity: 0.4;
      transition: opacity 0.3s ease;
    }

    .step.active { opacity: 1; }
    .step.completed { opacity: 1; color: var(--success); }

    .step-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .step.active .step-icon {
      background: rgba(139, 92, 246, 0.2);
      border-color: var(--primary);
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
    }
    
    .step.completed .step-icon {
      background: rgba(34, 197, 94, 0.2);
      border-color: var(--success);
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.4);
    }

    .step-text { font-size: 14px; font-weight: 600; }
    .step-subtext { font-size: 12px; color: var(--text-muted); margin-top: 4px; font-weight: normal; }

    /* Results */
    #resultPanel { display: none; }
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
      padding: 16px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 8px;
      color: var(--success);
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
      word-break: break-all;
    }
    .result-link:hover { background: rgba(34, 197, 94, 0.15); }
    
    /* Logs */
    #logOutput {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 16px;
      background: #000;
      border: 1px solid var(--border);
      border-radius: 8px;
      height: 150px;
      overflow-y: auto;
      color: #a1a1aa;
      white-space: pre-wrap;
      margin-top: 16px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="glow"></div>

  <header>
    <div class="brand">
      <div class="brand-icon">♾️</div>
      <div class="brand-text">
        <h1>OmniFlow Master Pipeline</h1>
        <p>End-to-End Autonomous Video Orchestration</p>
      </div>
    </div>
  </header>

  <main>
    <section class="panel" id="inputPanel">
      <div class="panel-title">🎬 1. Setup Your Vision</div>
      
      <div class="file-input-wrapper">
        <div class="file-icon">📼</div>
        <span class="file-label-text" id="fileLabel">Drag & drop source video or click to browse</span>
        <input type="file" id="videoFile" accept="video/mp4,video/quicktime">
      </div>

      <div class="form-group" style="margin-top: 10px;">
        <label>AI Editing Target Prompt</label>
        <textarea id="promptInput" rows="3" placeholder="e.g. Turn this vlog into a high-octane cyberpunk action movie..."></textarea>
      </div>
      
      <div class="form-group">
        <label>Gemini API Key (Optional)</label>
        <input type="password" id="apiKeyInput" placeholder="Leave blank to use local .env key">
      </div>

      <div class="form-group" style="margin-bottom: 8px;">
        <label>Chrome Debug Port</label>
        <input type="number" id="chromePortInput" value="9222" placeholder="e.g. 9222">
      </div>

      <button id="startBtn" class="btn-process" disabled>🚀 Run Full OmniFlow Pipeline</button>
    </section>

    <section class="panel tracker" id="trackerPanel">
      <div class="panel-title">⚡ 2. Pipeline Execution</div>
      
      <div class="step" id="step-ingest">
        <div class="step-icon">1</div>
        <div>
          <div class="step-text">Video Ingestion & Splitting</div>
          <div class="step-subtext" id="sub-ingest">Waiting to start...</div>
        </div>
      </div>

      <div class="step" id="step-intel">
        <div class="step-icon">2</div>
        <div>
          <div class="step-text">Video Intelligence & Context Analysis</div>
          <div class="step-subtext" id="sub-intel">Analyzing character sheets & environment...</div>
        </div>
      </div>

      <div class="step" id="step-prompt">
        <div class="step-icon">3</div>
        <div>
          <div class="step-text">Prompt Engineering Engine</div>
          <div class="step-subtext" id="sub-prompt">Generating layered clip instructions...</div>
        </div>
      </div>

      <div class="step" id="step-gen">
        <div class="step-icon">4</div>
        <div>
          <div class="step-text">Parallel Video Generation</div>
          <div class="step-subtext" id="sub-gen">Waiting for Gemini extension tabs...</div>
        </div>
      </div>

      <div class="step" id="step-merge">
        <div class="step-icon">5</div>
        <div>
          <div class="step-text">Post-Processing & Composition</div>
          <div class="step-subtext" id="sub-merge">Stitching final video...</div>
        </div>
      </div>
      
      <div id="logOutput"></div>
    </section>

    <section class="panel" id="resultPanel">
      <div class="panel-title">✨ 3. Final Masterpiece</div>
      <video id="finalVideo" controls playsinline></video>
      <a id="downloadLink" class="result-link" href="#" download="omniflow_masterpiece.mp4">⬇️ Download Masterpiece</a>
    </section>
  </main>

  <script>
    const fileInput = document.getElementById('videoFile');
    const fileLabel = document.getElementById('fileLabel');
    const promptInput = document.getElementById('promptInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const chromePortInput = document.getElementById('chromePortInput');
    const startBtn = document.getElementById('startBtn');
    const trackerPanel = document.getElementById('trackerPanel');
    const inputPanel = document.getElementById('inputPanel');
    const resultPanel = document.getElementById('resultPanel');
    const logOutput = document.getElementById('logOutput');

    let generatedClipsExpected = 0;
    let generatedClipsFound = [];
    let isWaitingForDownloads = false;

    // File input handler
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        fileLabel.textContent = \`Selected: \${file.name} (\${(file.size / (1024*1024)).toFixed(2)} MB)\`;
        checkForm();
      } else {
        fileLabel.textContent = "Drag & drop source video or click to browse";
        startBtn.disabled = true;
      }
    });

    promptInput.addEventListener('input', checkForm);

    function checkForm() {
      if (fileInput.files[0] && promptInput.value.trim().length > 0) {
        startBtn.disabled = false;
      } else {
        startBtn.disabled = true;
      }
    }

    function updateStep(stepId, state, subtext) {
      const el = document.getElementById('step-' + stepId);
      const sub = document.getElementById('sub-' + stepId);
      if(state === 'active') {
        el.classList.add('active');
        el.classList.remove('completed');
        if(subtext) sub.textContent = subtext;
      } else if(state === 'completed') {
        el.classList.remove('active');
        el.classList.add('completed');
        el.querySelector('.step-icon').textContent = '✓';
        if(subtext) sub.textContent = subtext;
      } else if(state === 'error') {
        el.classList.add('active');
        el.style.color = 'var(--error)';
        el.querySelector('.step-icon').style.borderColor = 'var(--error)';
        el.querySelector('.step-icon').textContent = '✗';
        if(subtext) sub.textContent = subtext;
      }
    }

    function log(msg) {
      logOutput.style.display = 'block';
      logOutput.textContent += \`[\${new Date().toLocaleTimeString()}] \${msg}\\n\`;
      logOutput.scrollTop = logOutput.scrollHeight;
    }

    // MAIN PIPELINE TRIGGER
    startBtn.addEventListener('click', async () => {
      const file = fileInput.files[0];
      const targetPrompt = promptInput.value.trim();
      const apiKey = apiKeyInput.value.trim();

      inputPanel.style.display = 'none';
      trackerPanel.style.display = 'flex';
      
      try {
        // --- PHASE 1, 2, 3: Backend Processing Pipeline ---
        updateStep('ingest', 'active', 'Uploading and splitting video...');
        log('Uploading source video to backend...');
        
        const queryParams = new URLSearchParams({ 
          name: file.name,
          prompt: targetPrompt
        });
        if(apiKey) queryParams.set('apiKey', apiKey);

        const res = await fetch(\`/api/process-full-pipeline?\${queryParams.toString()}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Backend pipeline failed");
        }

        updateStep('ingest', 'completed');
        updateStep('intel', 'completed');
        updateStep('prompt', 'completed');
        
        const data = await res.json();
        log(\`Backend pipeline success! Generated \${data.tasks.length} clip instructions.\`);

        // --- PHASE 4: Parallel Video Generation (Frontend Automation) ---
        updateStep('gen', 'active', \`Triggering \${data.tasks.length} Gemini tabs in parallel...\`);
        generatedClipsExpected = data.tasks.length;
        generatedClipsFound = [];
        
        let hasError = false;
        const chromePort = chromePortInput.value.trim() || '9222';
        
        const runningPromises = data.tasks.map((task, index) => {
          return new Promise((resolve) => {
            log(\`Starting SSE event listener for \${task.clipId}...\`);
            const params = new URLSearchParams({
              clipId: task.clipId,
              videoPath: task.videoPath,
              prompt: task.prompt,
              chromePort: chromePort
            });
            const sse = new EventSource(\`/api/run-stream?\${params.toString()}\`);

            sse.onmessage = (event) => {
              try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'log') {
                  log(\`[\${task.clipId}] \${payload.data}\`);
                } else if (payload.type === 'error') {
                  log(\`[\${task.clipId}] ERROR: \${payload.data}\`);
                  hasError = true;
                } else if (payload.type === 'result') {
                  if (payload.data.downloadedPath) {
                    generatedClipsFound.push(payload.data.downloadedPath);
                    log(\`Detected completed clip: \${payload.data.downloadedPath.split('/').pop() || payload.data.downloadedPath.split('\\\\\\\\').pop()}\`);
                    updateStep('gen', 'active', \`Generated \${generatedClipsFound.length} of \${generatedClipsExpected} clips...\`);
                  }
                }
              } catch (err) {
                log('Error parsing event data: ' + err.message);
              }
            };

            sse.onerror = () => {
              sse.close();
              resolve();
            };
          });
        });

        await Promise.all(runningPromises);

        if (hasError && generatedClipsFound.length < generatedClipsExpected) {
           throw new Error("Some clips failed to generate properly. Please check logs.");
        }

        updateStep('gen', 'completed', 'All clips generated successfully.');
        // Trigger Merge Phase
        triggerMergePhase(generatedClipsFound.sort());

      } catch (err) {
        log('Error: ' + err.message);
        updateStep('ingest', 'error', err.message);
      }
    });

    // --- PHASE 4: Polling for Downloads ---
    async function pollForDownloads() {
      if (!isWaitingForDownloads) return;

      try {
        const res = await fetch('/api/check-downloads');
        const data = await res.json();

        if (data.downloadedPaths && data.downloadedPaths.length > generatedClipsFound.length) {
          data.downloadedPaths.forEach(path => {
            if (!generatedClipsFound.includes(path)) {
              generatedClipsFound.push(path);
              log(\`Detected completed clip: \${path.split('/').pop() || path.split('\\\\').pop()}\`);
            }
          });
          
          updateStep('gen', 'active', \`Generated \${generatedClipsFound.length} of \${generatedClipsExpected} clips...\`);
        }

        if (generatedClipsFound.length >= generatedClipsExpected) {
          isWaitingForDownloads = false;
          updateStep('gen', 'completed', 'All clips generated successfully.');
          
          // Trigger Merge Phase
          triggerMergePhase(generatedClipsFound);
        } else {
          // Poll again in 2 seconds
          setTimeout(pollForDownloads, 2000);
        }
      } catch (err) {
        console.error("Polling error:", err);
        setTimeout(pollForDownloads, 2000);
      }
    }

    // --- PHASE 5: Post-Processing & Merge ---
    async function triggerMergePhase(clipPaths) {
      updateStep('merge', 'active', 'Sending generated clips to FFmpeg merger...');
      log('Calling /api/run-merge...');

      try {
        const mergeRes = await fetch('/api/run-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputPaths: clipPaths })
        });
        
        if (!mergeRes.ok) {
          const errData = await mergeRes.json();
          throw new Error(errData.error || "Merging failed.");
        }
        
        const mergeData = await mergeRes.json();
        
        updateStep('merge', 'completed', 'Merger complete!');
        log('Final video stitched successfully!');

        // --- RESULT DISPLAY ---
        const videoFilename = mergeData.finalPath.split('/').pop() || mergeData.finalPath.split('\\\\').pop();
        const videoUrl = \`/merged-output/\${encodeURIComponent(videoFilename)}\`;
        
        document.getElementById('finalVideo').src = videoUrl;
        document.getElementById('downloadLink').href = videoUrl;
        
        resultPanel.style.display = 'block';
        
      } catch (err) {
        log('Merge Error: ' + err.message);
        updateStep('merge', 'error', err.message);
      }
    }
  </script>
</body>
</html>`;

const tempDir = path.join(process.cwd(), 'omniflow-master-temp');
const outputClipsDir = path.join(tempDir, 'split-clips');
const outputMergedDir = path.join(tempDir, 'merged-output');

// Clean start for temp directories
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(outputClipsDir, { recursive: true });
fs.mkdirSync(outputMergedDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Serves HTML UI
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  // Serve static videos
  if (req.method === 'GET' && pathname.startsWith('/merged-output/')) {
    const filename = decodeURIComponent(pathname.replace('/merged-output/', ''));
    const filePath = path.join(outputMergedDir, filename);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/run-stream') {
    let videoPath = parsedUrl.searchParams.get('videoPath');
    if (videoPath === 'null' || videoPath === 'undefined') {
      videoPath = null;
    }
    const prompt = parsedUrl.searchParams.get('prompt');
    const clipId = parsedUrl.searchParams.get('clipId') || 'clip_1';
    const chromePort = parseInt(parsedUrl.searchParams.get('chromePort') || '9222', 10);

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
        console.log(`[Master] Initializing GenerationEngine with chromePort: ${chromePort}...`);
        const engine = new GenerationEngine({ chromePort });

        const result = await engine.runJob({
          clipId,
          videoPath,
          prompt,
          geminiUrl: 'https://gemini.google.com',
          downloadOutputDir: tempDir
        });

        sendEvent('result', result);
      } catch (err) {
        console.error(`[Master] Execution Error: ${err.message}`);
        sendEvent('error', err.message);
      } finally {
        console.log = originalLog;
        console.error = originalError;
        res.end();
      }
    })();
    return;
  }

  if (req.method === 'POST' && pathname === '/api/process-full-pipeline') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const filename = parsedUrl.searchParams.get('name') || 'master_input.mp4';
    const targetPrompt = parsedUrl.searchParams.get('prompt') || '';
    const apiKey = parsedUrl.searchParams.get('apiKey');

    const tempInputPath = path.join(tempDir, `input_${Date.now()}_${filename}`);
    const fileStream = fs.createWriteStream(tempInputPath);
    
    const uploadFinished = new Promise((resolve, reject) => {
      fileStream.on('finish', () => resolve());
      fileStream.on('error', (err) => reject(err));
      req.on('error', (err) => reject(err));
    });

    req.pipe(fileStream);

    req.on('end', async () => {
      try {
        await uploadFinished;
        console.log(`\n================================`);
        console.log(`[Master] 1. Splitting Video...`);
        const procEngine = new VideoProcessingEngine();
        const splitManifest = procEngine.process(tempInputPath, outputClipsDir, { segmentLength: 10 });
        const clipPaths = splitManifest.clips.map(c => c.filePath);

        console.log(`\n================================`);
        console.log(`[Master] 2. Analyzing with Video Intelligence...`);
        const intelLayer = new VideoIntelligenceLayer({ 
          apiKey,
          modelName: process.env.VISION_MODEL || 'gemini-1.5-flash'
        });
        const intelResult = await intelLayer.processClips(clipPaths, targetPrompt, { tempDir });

        console.log(`[Master] 3. Generating Layered Prompts...`);
        const promptEngine = new PromptIntelligenceEngine({ 
          apiKey: apiKey || undefined,
          modelName: process.env.PROMPT_ENGINE_MODEL || 'gemini-1.5-flash'
        });

        // Helper to parse duration extension from target prompt
        const parseDurationExtension = (p) => {
          if (!p) return 0;
          const regex = /(?:add|extend(?:\s+by)?|extra|duration\s+extension\s+of)\s*(\d+)\s*(?:sec|second|seconds|s\b)/i;
          const match = p.match(regex);
          return match ? parseInt(match[1], 10) : 0;
        };

        const promptEngineInput = intelResult.promptEngineInput;
        const extraSeconds = parseDurationExtension(targetPrompt);
        
        if (extraSeconds > 0) {
          console.log(`[Master] Duration extension detected. Appending ${extraSeconds} seconds of text-to-video.`);
          const extraClipsCount = Math.ceil(extraSeconds / 10);
          let lastEnd = promptEngineInput.videoMetadata.duration;
          const segmentLength = 10;

          for (let i = 0; i < extraClipsCount; i++) {
            const newIndex = promptEngineInput.videoMetadata.clips.length;
            const start = lastEnd;
            const end = Number((start + segmentLength).toFixed(2));
            lastEnd = end;

            promptEngineInput.videoMetadata.clips.push({
              clipIndex: newIndex,
              timestamps: { start, end },
              originalDescription: `Continuous extension clip ${newIndex + 1}. Pure creative text-to-video clip based on: ${targetPrompt}. Keep overall character visual sheet, lighting, and environment identical to prior clips.`,
              cameraShotType: "cinematic",
              speakerText: ""
            });
          }
          promptEngineInput.videoMetadata.duration = lastEnd;
        }

        const promptOutput = await promptEngine.process(promptEngineInput);

        // Prepare tasks for frontend to dispatch to Gemini (including phantom clips)
        const tasks = promptEngineInput.videoMetadata.clips.map((clip, index) => {
          const promptData = promptOutput.clipPrompts.find(p => p.clipIndex === index);
          const isPhantom = index >= splitManifest.clips.length;
          return {
            clipId: `clip_${index + 1}`,
            videoPath: isPhantom ? null : splitManifest.clips[index].filePath,
            prompt: promptData ? promptData.finalAssembledPrompt : targetPrompt
          };
        });

        console.log(`[Master] Backend Pipeline Complete. Returning ${tasks.length} tasks to frontend.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tasks }));
      } catch (err) {
        console.error("[Master] Pipeline error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Polling endpoint to check for downloaded generated clips
  if (req.method === 'GET' && pathname === '/api/check-downloads') {
    const downloadedPaths = [];
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(f => {
        if (f.endsWith('_generated.mp4')) {
          downloadedPaths.push(path.join(tempDir, f));
        }
      });
    }
    
    // Also check default Downloads folder just in case (like in generation-tester)
    const osDownloadsDir = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(osDownloadsDir)) {
      const files = fs.readdirSync(osDownloadsDir);
      files.forEach(f => {
        if (f.startsWith('clip_') && f.endsWith('_generated.mp4')) {
          const oldPath = path.join(osDownloadsDir, f);
          const newPath = path.join(tempDir, f);
          try {
            fs.renameSync(oldPath, newPath); // Move to temp dir
            downloadedPaths.push(newPath);
            console.log(`[Master] Moved downloaded file: ${f} to temp dir`);
          } catch (e) { }
        }
      });
    }

    // Sort paths alphabetically to maintain order
    downloadedPaths.sort();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ downloadedPaths }));
    return;
  }

  // Merge endpoint
  if (req.method === 'POST' && pathname === '/api/run-merge') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { inputPaths } = JSON.parse(body);
        if (!inputPaths || inputPaths.length === 0) throw new Error("No clips provided to merge.");

        const processor = new PostProcessor();
        const outputFilename = `omniflow_masterpiece_${Date.now()}.mp4`;
        const outputPath = path.join(outputMergedDir, outputFilename);
        
        console.log(`[Master] 4. Merging ${inputPaths.length} clips into ${outputPath}`);
        const finalPath = await processor.mergeVideos(inputPaths, outputPath);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ finalPath }));
      } catch (err) {
        console.error("[Master] Merge error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 3007;
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`♾️ OmniFlow Master Pipeline Server running!`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log('==================================================');
});
