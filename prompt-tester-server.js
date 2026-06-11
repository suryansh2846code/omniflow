import http from 'http';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file if it exists
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}

import { PromptIntelligenceEngine } from './prompt-engine/index.js';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OmniFlow — Prompt Intelligence Tester</title>
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
      --primary: #a855f7;
      --primary-hover: #c084fc;
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

    /* Ambient background glows */
    .glow {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%);
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
      background: linear-gradient(135deg, #a855f7, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 8px rgba(168, 85, 247, 0.3));
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
      background: var(--error);
      box-shadow: 0 0 10px var(--error);
    }

    .status-dot.active {
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
      box-shadow: 0 0 8px rgba(168, 85, 247, 0.2);
    }

    textarea {
      resize: vertical;
      min-height: 80px;
    }

    .btn-compile {
      background: linear-gradient(135deg, #a855f7, #7c3aed);
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
      box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
    }

    .btn-compile:hover {
      background: linear-gradient(135deg, #c084fc, #8b5cf6);
      transform: translateY(-1px);
    }

    .btn-compile:active {
      transform: translateY(0);
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
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.3);
    }

    .tab-content {
      display: none;
      animation: fadeIn 0.3s ease;
    }

    .tab-content.active {
      display: block;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .meta-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }

    .meta-card-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }

    .meta-item:last-child {
      margin-bottom: 0;
    }

    .meta-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .meta-val {
      font-size: 13.5px;
      color: var(--text);
      line-height: 1.5;
    }

    .clip-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .clip-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }

    .clip-header {
      background: rgba(168, 85, 247, 0.05);
      border-bottom: 1px solid var(--border);
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .clip-index {
      font-weight: 700;
      color: #fff;
    }

    .clip-time {
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }

    .clip-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .clip-prompt-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(168, 85, 247, 0.2);
      border-radius: 8px;
      padding: 14px;
      font-size: 13.5px;
      line-height: 1.6;
      color: #fff;
      position: relative;
    }

    .clip-prompt-box::before {
      content: 'FINAL ASSEMBLED PROMPT';
      position: absolute;
      top: -8px;
      left: 12px;
      background: #7c3aed;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      overflow-x: auto;
      color: #34d399;
      border: 1px solid var(--border);
    }

    /* Loader */
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
      border: 3px solid rgba(168, 85, 247, 0.1);
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
      <div class="brand-icon">⚡</div>
      <div class="brand-text">
        <h1>Prompt Intelligence Tester</h1>
        <p>OmniFlow AI Editing Planner v3</p>
      </div>
    </div>
    <div class="status-badge">
      <span>Gemini API:</span>
      <div class="status-dot" id="apiKeyStatus"></div>
      <span id="apiKeyStatusText">Checking...</span>
    </div>
  </header>

  <main>
    <section class="panel">
      <div class="panel-title">⚙️ Inputs</div>
      
      <div class="form-group">
        <label for="apiKey">Gemini API Key</label>
        <input type="password" id="apiKey" placeholder="Enter key (leave blank to use system env key)">
      </div>

      <div class="form-group">
        <label for="userPrompt">Target Editing Instruction</label>
        <textarea id="userPrompt" placeholder="e.g. Turn my vlog into a cyberpunk movie"></textarea>
      </div>

      <div class="form-group">
        <label for="overallDescription">Video Overall Description</label>
        <textarea id="overallDescription" placeholder="Description of the full video input..."></textarea>
      </div>

      <div class="form-group">
        <label for="clipsData">Video Clips Timeline (JSON)</label>
        <textarea id="clipsData" style="height: 180px; font-family: 'JetBrains Mono', monospace; font-size: 11px;"></textarea>
      </div>

      <button id="compileBtn" class="btn-compile">⚡ Compile Prompts</button>
    </section>

    <section class="panel" style="min-height: 600px;">
      <div class="panel-title">📊 Output Planner Result</div>

      <div id="loader" class="loader">
        <div class="spinner"></div>
        <p style="color: var(--text-muted); font-size: 13px;">Analyzing video assets & generating consistency rules...</p>
      </div>

      <div id="resultsWrap" class="results-container" style="display: none;">
        <div class="tabs">
          <button class="tab active" onclick="switchTab('planner')">Planner DNA</button>
          <button class="tab" onclick="switchTab('prompts')">Compiled Prompts</button>
          <button class="tab" onclick="switchTab('json')">Raw JSON Response</button>
        </div>

        <!-- Planner DNA Tab -->
        <div id="tab-planner" class="tab-content active">
          <div class="grid-2" style="margin-bottom: 20px;">
            <div class="meta-card">
              <div class="meta-card-title">🌐 Master Context</div>
              <div class="meta-item">
                <span class="meta-label">Genre</span>
                <span class="meta-val" id="resGenre"></span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Overall Environment</span>
                <span class="meta-val" id="resEnv"></span>
              </div>
            </div>
            <div class="meta-card">
              <div class="meta-card-title">👤 Character Sheet</div>
              <div class="meta-item">
                <span class="meta-label">Identity</span>
                <span class="meta-val" id="resIdentity"></span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Clothing</span>
                <span class="meta-val" id="resClothing"></span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Face / Accessories</span>
                <span class="meta-val" id="resFace"></span>
              </div>
            </div>
          </div>

          <div class="meta-card" style="margin-bottom: 20px;">
            <div class="meta-card-title">🎞️ Editor & Story Planner</div>
            <div class="meta-item">
              <span class="meta-label">Story Plan (Hook/Build/Payoff)</span>
              <span class="meta-val" id="resStoryPlan"></span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Continuity Rules</span>
              <span class="meta-val" id="resContinuity"></span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Pacing Rules</span>
              <span class="meta-val" id="resPacing"></span>
            </div>
          </div>

          <div class="meta-card">
            <div class="meta-card-title">✂️ Cut Planner</div>
            <div class="meta-item">
              <span class="meta-label">Recommended Cut Points</span>
              <span class="meta-val" id="resCuts"></span>
            </div>
          </div>
        </div>

        <!-- Compiled Prompts Tab -->
        <div id="tab-prompts" class="tab-content">
          <div class="clip-list" id="resClipsList"></div>
        </div>

        <!-- Raw JSON Tab -->
        <div id="tab-json" class="tab-content">
          <pre><code id="resRawJson"></code></pre>
        </div>
      </div>
    </section>
  </main>

  <script>
    // Initial Pre-populated Default inputs
    const defaultClips = [
      {
        clipIndex: 0,
        timestamps: { start: 0, end: 10 },
        originalDescription: "The creator walks down the sidewalk talking to the camera.",
        cameraShotType: "medium close up"
      },
      {
        clipIndex: 1,
        timestamps: { start: 10, end: 20 },
        originalDescription: "Close up of the creator pointing at a digital billboard showing stock market charts.",
        cameraShotType: "close up"
      },
      {
        clipIndex: 2,
        timestamps: { start: 20, end: 30 },
        originalDescription: "The creator walks away from the camera down a narrow alleyway.",
        cameraShotType: "wide shot"
      }
    ];

    document.getElementById('userPrompt').value = "Turn my vlog into a cyberpunk movie";
    document.getElementById('overallDescription').value = "A vlog of a creator talking about tech while walking down the street.";
    document.getElementById('clipsData').value = JSON.stringify(defaultClips, null, 2);

    // Check key status on boot
    async function checkKeyStatus() {
      try {
        const res = await fetch('/api/key-status');
        const data = await res.json();
        const dot = document.getElementById('apiKeyStatus');
        const text = document.getElementById('apiKeyStatusText');
        if (data.configured) {
          dot.classList.add('active');
          text.textContent = 'Active (System Key)';
        } else {
          dot.classList.remove('active');
          text.textContent = 'Not Set (Provide key below)';
        }
      } catch (err) {}
    }
    checkKeyStatus();

    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const eventTab = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.toLowerCase().includes(tabName.toLowerCase()));
      if (eventTab) eventTab.classList.add('active');
      
      const targetContent = document.getElementById(\`tab-\${tabName}\`);
      if (targetContent) targetContent.classList.add('active');
    }

    document.getElementById('compileBtn').addEventListener('click', async () => {
      const apiKey = document.getElementById('apiKey').value.trim();
      const userPrompt = document.getElementById('userPrompt').value.trim();
      const overallDescription = document.getElementById('overallDescription').value.trim();
      let clips = [];

      try {
        clips = JSON.parse(document.getElementById('clipsData').value);
      } catch (e) {
        alert("Invalid JSON in Clips Timeline input: " + e.message);
        return;
      }

      // Show loader
      document.getElementById('loader').style.display = 'flex';
      document.getElementById('resultsWrap').style.display = 'none';

      try {
        const res = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            userPrompt,
            videoMetadata: {
              duration: clips[clips.length - 1]?.timestamps?.end || 30,
              resolution: "1920x1080",
              fps: 30,
              overallDescription,
              clips
            }
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Compilation request failed.");
        }

        const result = await res.json();
        
        // Populate results UI
        document.getElementById('resGenre').textContent = result.masterContext?.visualGenre || '—';
        document.getElementById('resEnv').textContent = result.masterContext?.overallEnvironment || '—';
        
        document.getElementById('resIdentity').textContent = result.characterSheet?.identity || '—';
        document.getElementById('resClothing').textContent = result.characterSheet?.clothing || '—';
        document.getElementById('resFace').textContent = \`\${result.characterSheet?.face || '—'} (Accessories: \${result.characterSheet?.accessories || '—'})\`;
        
        document.getElementById('resStoryPlan').innerHTML = \`
          <strong>Hook:</strong> \${result.storyPlan?.hook || '—'}<br>
          <strong>Build:</strong> \${result.storyPlan?.build || '—'}<br>
          <strong>Payoff:</strong> \${result.storyPlan?.payoff || '—'}
        \`;
        document.getElementById('resContinuity').textContent = result.editorDNA?.continuityRules || '—';
        document.getElementById('resPacing').textContent = result.editorDNA?.pacingRules || '—';

        // Recommended Cuts
        const cutsList = result.cutPlanner?.recommendedCuts || [];
        document.getElementById('resCuts').innerHTML = cutsList.length > 0 
          ? cutsList.map(c => \`⏰ <strong>\${c.timestamp}s</strong>: \${c.reason} (Confidence: \${Math.round(c.confidence * 100)}%)\`).join('<br>')
          : 'No cuts recommended.';

        // Assembled Clips prompts list
        const clipsWrap = document.getElementById('resClipsList');
        clipsWrap.innerHTML = '';
        result.clipPrompts.forEach(c => {
          const card = document.createElement('div');
          card.className = 'clip-card';
          card.innerHTML = \`
            <div class="clip-header">
              <span class="clip-index">Clip #\${c.clipIndex}</span>
              <span class="clip-time">\${c.timestamps.start}s - \${c.timestamps.end}s</span>
            </div>
            <div class="clip-body">
              <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
                <strong>Original description:</strong> "\${c.relationship?.currentClipGoal || '—'}"
              </div>
              <div class="clip-prompt-box">
                \${c.finalAssembledPrompt}
              </div>
            </div>
          \`;
          clipsWrap.appendChild(card);
        });

        // Raw JSON text
        document.getElementById('resRawJson').textContent = JSON.stringify(result, null, 2);

        // Hide loader, show results
        document.getElementById('loader').style.display = 'none';
        document.getElementById('resultsWrap').style.display = 'flex';
        switchTab('planner');

      } catch (err) {
        alert("Execution Error: " + err.message);
        document.getElementById('loader').style.display = 'none';
      }
    });
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/key-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ configured: !!process.env.GEMINI_API_KEY }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/compile') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const apiKey = payload.apiKey || process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: "Gemini API key is not configured. Please supply a key in the input field or set GEMINI_API_KEY in your environment." }));
          return;
        }

        console.log(`[Tester] Compiling prompts for target instruction: "${payload.userPrompt}"`);
        const engine = new PromptIntelligenceEngine({ apiKey });
        const result = await engine.process({
          videoMetadata: payload.videoMetadata,
          userPrompt: payload.userPrompt
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error("[Tester] Compilation failed:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Prompt Intelligence Tester Server running!`);
  console.log(`==================================================`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
