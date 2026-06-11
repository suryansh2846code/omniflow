import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { VideoProcessingEngine } from './video-processing/index.js';
import { VideoIntelligenceLayer } from './video-intelligence/index.js';
import { PromptIntelligenceEngine } from './prompt-engine/index.js';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniFlow — Video Processing Tester</title>
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
      --primary: #3b82f6;
      --primary-hover: #60a5fa;
      --success: #22c55e;
      --warning: #eab308;
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
      background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
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
      background: radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%);
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
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.3));
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
      grid-template-columns: 450px 1fr;
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
      font-size: 12px;
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
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    }

    .file-input-wrapper {
      position: relative;
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .file-input-wrapper:hover {
      border-color: var(--primary);
      background: rgba(59, 130, 246, 0.02);
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

    .file-label-text {
      font-size: 13px;
      color: var(--text-muted);
    }

    .btn-process {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
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
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }

    .btn-process:hover {
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
      transform: translateY(-1px);
    }

    .btn-process:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .results-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }

    .tab {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .tab:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.03);
    }

    .tab.active {
      color: #fff;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .tab-content {
      display: none;
      animation: fadeIn 0.3s ease;
    }

    .tab-content.active {
      display: block;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .meta-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-val {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }

    .clips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 12px;
    }

    .clip-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .clip-header {
      background: rgba(59, 130, 246, 0.05);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .clip-id {
      font-weight: 700;
      font-size: 13px;
      color: #fff;
    }

    .clip-time {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }

    .clip-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #000;
    }

    video {
      width: 100%;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #09090b;
      outline: none;
    }

    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      overflow-x: auto;
      color: #60a5fa;
      border: 1px solid var(--border);
    }

    .loader {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      gap: 16px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(59, 130, 246, 0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s infinite linear;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="glow-right"></div>

  <header>
    <div class="brand">
      <div class="brand-icon">🎬</div>
      <div class="brand-text">
        <h1>Video Processing Tester</h1>
        <p>OmniFlow Video Ingest Engine</p>
      </div>
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      <span>Engine Active</span>
    </div>
  </header>

  <main>
    <section class="panel">
      <div class="panel-title">⚙️ Splitting Configuration</div>
      
      <div class="form-group">
        <label>Select Video File</label>
        <div class="file-input-wrapper">
          <span class="file-label-text" id="fileLabel">Drag & drop or click to choose video (.mp4)</span>
          <input type="file" id="videoFile" accept="video/mp4,video/quicktime">
        </div>
      </div>

      <div class="form-group">
        <label for="segmentLength">Max segment length (seconds)</label>
        <input type="number" id="segmentLength" value="10" min="1" max="60">
      </div>

      <div class="form-group">
        <label for="scenes">Scene Markers (comma separated seconds - optional)</label>
        <input type="text" id="scenes" placeholder="e.g. 4.5, 9.0, 14.5">
      </div>

      <button id="processBtn" class="btn-process" disabled>🎬 Split Video Assets</button>

      <div class="form-group" style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 15px;">
        <label for="analyzerPrompt">AI Editing Target Prompt</label>
        <textarea id="analyzerPrompt" placeholder="e.g. Turn my vlog into a cyberpunk action movie"></textarea>
      </div>

      <div class="form-group">
        <label for="apiKey">Gemini API Key (Optional)</label>
        <input type="password" id="apiKey" placeholder="Leave empty to use .env key">
      </div>

      <button id="analyzeBtn" class="btn-process" style="background: linear-gradient(135deg, #a855f7, #7c3aed); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2); display: none;">🎬 Run Video Analyzer</button>
    </section>

    <section class="panel" style="min-height: 600px;">
      <div class="panel-title">📊 Processing Pipeline Results</div>

      <div id="loader" class="loader">
        <div class="spinner"></div>
        <p id="loaderText" style="color: var(--text-muted); font-size: 13px;">Analyzing video stream & physically cutting segments...</p>
      </div>

      <div id="resultsWrap" class="results-container" style="display: none;">
        <div class="tabs">
          <button class="tab active" onclick="switchTab('metadata')">Metadata</button>
          <button class="tab" onclick="switchTab('clips')">Split Clip Assets</button>
          <button class="tab" onclick="switchTab('manifest')">Manifest JSON</button>
          <button class="tab" id="analyzerTabBtn" style="display: none;" onclick="switchTab('analyzer')">Video Analyzer</button>
          <button class="tab" id="promptsTabBtn" style="display: none;" onclick="switchTab('prompts')">Layered Prompts</button>
        </div>

        <!-- Video Analyzer Tab -->
        <div id="tab-analyzer" class="tab-content">
          <div class="grid-2" style="margin-bottom: 20px;">
            <div class="meta-card">
              <div class="meta-card-title">🌐 Video Summary</div>
              <div class="meta-val" id="intelSummary" style="font-size: 14px; line-height: 1.6;">—</div>
            </div>
            <div class="meta-card">
              <div class="meta-card-title">👤 Unified Character Sheet</div>
              <div class="meta-item">
                <span class="meta-label">Identity</span>
                <span class="meta-val" id="intelIdentity">—</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Clothing</span>
                <span class="meta-val" id="intelClothing">—</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Face</span>
                <span class="meta-val" id="intelFace">—</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Hair</span>
                <span class="meta-val" id="intelHair">—</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Accessories</span>
                <span class="meta-val" id="intelAccessories">—</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Body Type</span>
                <span class="meta-val" id="intelBodyType">—</span>
              </div>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom: 20px;">
            <div class="meta-card">
              <div class="meta-card-title">📍 Locations</div>
              <div class="meta-val" id="intelLocations">—</div>
            </div>
            <div class="meta-card">
              <div class="meta-card-title">📦 Key Objects</div>
              <div class="meta-val" id="intelObjects">—</div>
            </div>
          </div>

          <div class="meta-card" style="margin-bottom: 20px;">
            <div class="meta-card-title">📹 Camera Style</div>
            <div class="meta-val" id="intelCameraStyle">—</div>
          </div>

          <div class="panel-title" style="font-size: 14px; margin-bottom: 12px;">🎞️ Clip Scene Timeline</div>
          <div id="intelTimelineList" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;"></div>
        </div>

        <!-- Layered Prompts Tab -->
        <div id="tab-prompts" class="tab-content">
          <div class="meta-card" style="margin-bottom: 20px; border-color: rgba(168, 85, 247, 0.3);">
            <div class="meta-card-title" style="color: #a855f7;">🌐 Master Context DNA</div>
            <div class="meta-item">
              <span class="meta-label">Genre</span>
              <span class="meta-val" id="pEngineGenre">—</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Overall Environment</span>
              <span class="meta-val" id="pEngineEnv">—</span>
            </div>
          </div>
          
          <div class="panel-title" style="font-size: 14px; margin-bottom: 12px;">⚡ Layered Prompts per Clip</div>
          <div id="pEngineClipsList" style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px;"></div>
        </div>

        <!-- Metadata Tab -->
        <div id="tab-metadata" class="tab-content active">
          <div class="grid-4" style="margin-bottom: 24px;">
            <div class="meta-card">
              <span class="meta-label">Duration</span>
              <span class="meta-val" id="resDuration">—</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">FPS</span>
              <span class="meta-val" id="resFps">—</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">Resolution</span>
              <span class="meta-val" id="resResolution">—</span>
            </div>
            <div class="meta-card">
              <span class="meta-label">Codec</span>
              <span class="meta-val" id="resCodec">—</span>
            </div>
          </div>
          
          <div class="meta-card" style="width: 100%;">
            <span class="meta-label">Source File Path</span>
            <span class="meta-val" id="resSourcePath" style="font-size:12.5px; font-family:'JetBrains Mono'; word-break:break-all;">—</span>
          </div>
        </div>

        <!-- Clips Tab -->
        <div id="tab-clips" class="tab-content">
          <div class="clips-grid" id="resClipsGrid"></div>
        </div>

        <!-- Manifest Tab -->
        <div id="tab-manifest" class="tab-content">
          <pre><code id="resManifestJson"></code></pre>
        </div>
      </div>
    </section>
  </main>

  <script>
    const fileInput = document.getElementById('videoFile');
    const fileLabel = document.getElementById('fileLabel');
    const processBtn = document.getElementById('processBtn');

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        fileLabel.textContent = \`Selected: \${file.name} (\${(file.size / (1024 * 1024)).toFixed(2)} MB)\`;
        processBtn.disabled = false;
      } else {
        fileLabel.textContent = "Drag & drop or click to choose video (.mp4)";
        processBtn.disabled = true;
      }
    });

    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const tabElement = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.toLowerCase().includes(tabName.toLowerCase()));
      if (tabElement) tabElement.classList.add('active');
      
      const contentElement = document.getElementById(\`tab-\${tabName}\`);
      if (contentElement) contentElement.classList.add('active');
    }

    processBtn.addEventListener('click', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const segmentLength = document.getElementById('segmentLength').value;
      const scenesVal = document.getElementById('scenes').value.trim();

      document.getElementById('loader').style.display = 'flex';
      document.getElementById('resultsWrap').style.display = 'none';
      processBtn.disabled = true;

      try {
        const queryParams = new URLSearchParams({
          name: file.name,
          segmentLength
        });
        if (scenesVal) {
          queryParams.set('scenes', scenesVal);
        }

        const res = await fetch(\`/api/process-video?\${queryParams.toString()}\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: file
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Processing failed.");
        }

        const manifest = await res.json();
        
        // Populate results UI
        document.getElementById('resDuration').textContent = \`\${manifest.metadata.duration.toFixed(2)}s\`;
        document.getElementById('resFps').textContent = manifest.metadata.fps;
        document.getElementById('resResolution').textContent = manifest.metadata.resolution;
        document.getElementById('resCodec').textContent = manifest.metadata.codec;
        document.getElementById('resSourcePath').textContent = manifest.sourceVideo;

        // Render split clips video players
        const grid = document.getElementById('resClipsGrid');
        grid.innerHTML = '';

        manifest.clips.forEach(c => {
          const card = document.createElement('div');
          card.className = 'clip-card';
          
          // Get filename
          const filename = c.filePath.split('/').pop() || c.filePath.split('\\\\').pop();

          card.innerHTML = \`
            <div class="clip-header">
              <span class="clip-id">Clip #\u200B\${c.clipId}</span>
              <span class="clip-time">\${c.start}s - \${c.end}s (\${c.duration}s)</span>
            </div>
            <div class="clip-body">
              <video controls src="/clips/\${encodeURIComponent(filename)}"></video>
            </div>
          \`;
          grid.appendChild(card);
        });

        document.getElementById('resManifestJson').textContent = JSON.stringify(manifest, null, 2);

        // Save paths globally for analyzer
        window.lastSplitClips = manifest.clips.map(c => c.filePath);
        document.getElementById('analyzeBtn').style.display = 'flex';

        document.getElementById('loader').style.display = 'none';
        document.getElementById('resultsWrap').style.display = 'flex';
        switchTab('metadata');
      } catch (err) {
        alert("Processing Error: " + err.message);
        document.getElementById('loader').style.display = 'none';
      } finally {
        processBtn.disabled = false;
      }
    });

    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.addEventListener('click', async () => {
      if (!window.lastSplitClips || window.lastSplitClips.length === 0) return;

      const userPrompt = document.getElementById('analyzerPrompt').value.trim();
      const apiKey = document.getElementById('apiKey').value.trim();

      if (!userPrompt) {
        alert("Please enter an AI Editing Target Prompt first!");
        return;
      }

      document.getElementById('loaderText').textContent = "Extracting clip frames & running Gemini Vision analysis...";
      document.getElementById('loader').style.display = 'flex';
      document.getElementById('resultsWrap').style.display = 'none';
      analyzeBtn.disabled = true;

      try {
        const response = await fetch('/api/analyze-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipPaths: window.lastSplitClips,
            userPrompt,
            apiKey
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Analysis failed.");
        }

        const data = await response.json();
        const intel = data.videoUnderstanding;
        const promptOut = data.promptEngineOutput;

        // Populate Analyzer fields
        document.getElementById('intelSummary').textContent = intel.videoSummary || '—';
        document.getElementById('intelIdentity').textContent = intel.characterSheet?.identity || '—';
        document.getElementById('intelClothing').textContent = intel.characterSheet?.clothing || '—';
        document.getElementById('intelFace').textContent = intel.characterSheet?.face || '—';
        document.getElementById('intelHair').textContent = intel.characterSheet?.hair || '—';
        document.getElementById('intelAccessories').textContent = intel.characterSheet?.accessories || '—';
        document.getElementById('intelBodyType').textContent = intel.characterSheet?.bodyType || '—';
        document.getElementById('intelLocations').textContent = (intel.locations || []).join(', ') || '—';
        document.getElementById('intelObjects').textContent = (intel.objects || []).join(', ') || '—';
        document.getElementById('intelCameraStyle').textContent = intel.cameraStyle || '—';

        // Populate timeline list
        const timelineList = document.getElementById('intelTimelineList');
        timelineList.innerHTML = '';
        (intel.sceneTimeline || []).forEach(t => {
          const card = document.createElement('div');
          card.className = 'meta-card';
          card.style.borderLeft = '4px solid var(--primary)';
          card.innerHTML = \`
            <div class="meta-card-title">Clip #\${t.clipId} — Location: \${t.location || 'Unknown'}</div>
            <div class="meta-val" style="margin-bottom: 6px;"><strong>Summary:</strong> \${t.summary}</div>
            <div class="meta-label">Characters present: \${t.characters ? t.characters.join(', ') : 'None'}</div>
          \`;
          timelineList.appendChild(card);
        });

        // Populate prompt engine outputs
        document.getElementById('pEngineGenre').textContent = promptOut.masterContext?.visualGenre || '—';
        document.getElementById('pEngineEnv').textContent = promptOut.masterContext?.overallEnvironment || '—';

        const promptsClipsList = document.getElementById('pEngineClipsList');
        promptsClipsList.innerHTML = '';
        (promptOut.clipPrompts || []).forEach(c => {
          const card = document.createElement('div');
          card.className = 'clip-card';
          card.innerHTML = \`
            <div class="clip-header" style="background: rgba(168, 85, 247, 0.05);">
              <span class="clip-index">Clip #\${c.clipIndex}</span>
              <span class="clip-time">\${c.timestamps?.start || 0}s - \${c.timestamps?.end || 0}s</span>
            </div>
            <div class="clip-body" style="background: #000;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom: 6px;">
                <strong>Original description:</strong> "\${c.relationship?.currentClipGoal || '—'}"
              </div>
              <div class="clip-prompt-box">
                \${c.finalAssembledPrompt}
              </div>
              <div style="margin-top: 10px; font-size:11px; display:flex; flex-direction:column; gap:4px; opacity:0.8;">
                <div><strong>Master layer:</strong> \${c.threeLayerPrompt?.master}</div>
                <div><strong>Clip layer:</strong> \${c.threeLayerPrompt?.clip}</div>
                <div><strong>Technical layer:</strong> \${c.threeLayerPrompt?.technical}</div>
              </div>
            </div>
          \`;
          promptsClipsList.appendChild(card);
        });

        // Show tabs and switch
        document.getElementById('analyzerTabBtn').style.display = 'inline-block';
        document.getElementById('promptsTabBtn').style.display = 'inline-block';

        document.getElementById('loader').style.display = 'none';
        document.getElementById('resultsWrap').style.display = 'flex';
        switchTab('analyzer');

      } catch (err) {
        alert("Analysis Error: " + err.message);
        document.getElementById('loader').style.display = 'none';
        document.getElementById('resultsWrap').style.display = 'flex';
      } finally {
        analyzeBtn.disabled = false;
        document.getElementById('loaderText').textContent = "Analyzing video stream & physically cutting segments...";
      }
    });
  </script>
</body>
</html>`;

const tempUploadDir = path.join(process.cwd(), 'video-processing-tester-temp');
const outputClipsDir = path.join(tempUploadDir, 'clips');

// Clean start
if (fs.existsSync(tempUploadDir)) {
  fs.rmSync(tempUploadDir, { recursive: true, force: true });
}
fs.mkdirSync(outputClipsDir, { recursive: true });

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // GET /
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  // POST /api/process-video
  if (req.method === 'POST' && pathname === '/api/process-video') {
    const filename = parsedUrl.searchParams.get('name') || 'video.mp4';
    const segmentLengthStr = parsedUrl.searchParams.get('segmentLength');
    const segmentLength = parseInt(segmentLengthStr || '10', 10);
    const scenesStr = parsedUrl.searchParams.get('scenes') || '';
    
    // Parse scene markers
    let scenes = [];
    if (scenesStr) {
      scenes = scenesStr.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s));
    }

    const tempInputPath = path.join(tempUploadDir, `input_${Date.now()}_${filename}`);
    const fileStream = fs.createWriteStream(tempInputPath);
    req.pipe(fileStream);

    fileStream.on('error', (err) => {
      console.error("[Tester] Upload write error:", err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    req.on('end', () => {
      try {
        console.log(`[Tester] Video uploaded: "${tempInputPath}"`);
        const engine = new VideoProcessingEngine();
        
        // Process the uploaded video
        const manifest = engine.process(tempInputPath, outputClipsDir, {
          segmentLength,
          scenes
        });

        // Cleanup the temporary full-upload file so we don't leak storage
        if (fs.existsSync(tempInputPath)) {
          fs.unlinkSync(tempInputPath);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(manifest));
      } catch (procErr) {
        console.error("[Tester] Video processing failed:", procErr.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: procErr.message }));
      }
    });
    return;
  }

  // POST /api/analyze-clips
  if (req.method === 'POST' && pathname === '/api/analyze-clips') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { clipPaths, userPrompt, apiKey } = payload;
        
        const keyToUse = apiKey || process.env.GEMINI_API_KEY;
        console.log(`[Tester] Running Video Analyzer on ${clipPaths.length} clips...`);
        
        const videoIntel = new VideoIntelligenceLayer({ apiKey: keyToUse });
        const intelResult = await videoIntel.processClips(clipPaths, userPrompt);
        
        // E2E: Feed output directly into PromptIntelligenceEngine
        console.log(`[Tester] Feeding analyzer output into PromptIntelligenceEngine...`);
        const promptEngine = new PromptIntelligenceEngine({ apiKey: keyToUse });
        const promptResult = await promptEngine.process(intelResult.promptEngineInput);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          videoUnderstanding: intelResult.videoUnderstanding,
          promptEngineInput: intelResult.promptEngineInput,
          promptEngineOutput: promptResult
        }));
      } catch (err) {
        console.error("[Tester] Analysis or compilation failed:", err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /clips/:filename
  if (req.method === 'GET' && pathname.startsWith('/clips/')) {
    const filename = decodeURIComponent(pathname.slice(7));
    const filePath = path.join(outputClipsDir, filename);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Video Processing Tester Server running!`);
  console.log(`==================================================`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
