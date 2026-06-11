const fs = require('fs');

let code = fs.readFileSync('generation-tester-server.js', 'utf8');

// 1. Add Batch toggle to UI
code = code.replace(
  '<div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">',
  `<div class="form-group" style="flex-direction: row; align-items: center; gap: 8px; margin-bottom: 8px;">
        <input type="checkbox" id="runBatch" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);">
        <label for="runBatch" style="cursor: pointer; text-transform: none; font-size: 13px; font-weight: 500;">Run in Batch Mode (3 Parallel Tabs)</label>
      </div>
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">`
);

// 2. Modify results container to allow multiple result cards
code = code.replace(
  '<!-- Result Visualizer -->',
  `<!-- Result Visualizer -->
      <div id="resultsContainer" style="display: flex; flex-direction: column; gap: 16px;"></div>`
);

// 3. Update the script section to handle batch mode and dynamic cards
const scriptStart = code.indexOf('<script>');
const scriptEnd = code.indexOf('</script>');
const newScript = `<script>
    const runBtn = document.getElementById('runBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const consoleBox = document.getElementById('console');
    const resultsContainer = document.getElementById('resultsContainer');
    const useSampleCheckbox = document.getElementById('useSample');
    const videoPathGroup = document.getElementById('videoPathGroup');
    const runBatchCheckbox = document.getElementById('runBatch');

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
      setStatus('running', isBatch ? 'Automating 3 Tabs...' : 'Automating...');
      consoleBox.innerHTML = '';

      const tasks = isBatch ? [1, 2, 3] : [1];
      let completed = 0;
      let hasError = false;

      tasks.forEach(index => {
        const clipId = isBatch ? baseClipId + "_" + index : baseClipId;
        const currentPrompt = isBatch ? prompt + " (Variation " + index + ")" : prompt;
        const currentVideoPath = videoPath; // backend handles sample generation via sampleIndex
        
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
            }
          } catch (err) {
            log('Error parsing event data: ' + err.message, 'error');
          }
        };

        sse.onerror = (err) => {
          sse.close();
          completed++;
          
          if (completed === tasks.length) {
             runBtn.disabled = false;
             if (hasError) {
               setStatus('error', 'Failed');
             } else {
               setStatus('success', 'Completed');
             }
          }
        };
      });
    });
  </script>`;

code = code.substring(0, scriptStart) + newScript + code.substring(scriptEnd + 9);

// 4. Update the server backend to generate different sample clips based on sampleIndex
code = code.replace(
  "const useSample = parsedUrl.searchParams.get('useSample');",
  "const useSample = parsedUrl.searchParams.get('useSample');\n    const sampleIndex = parsedUrl.searchParams.get('sampleIndex') || '1';"
);

code = code.replace(
  "const samplePath = path.join(tempDir, 'sample_test_clip.mp4');",
  "const samplePath = path.join(tempDir, `sample_test_clip_${sampleIndex}.mp4`);"
);

// We need to also clean up the old single resultsCard from HTML if it exists, but the replace of <!-- Result Visualizer --> handled it.
// Wait, the old results card was:
/*
      <!-- Result Visualizer -->
      <div id="resultsCard" class="results-card">
...
      </div>
*/
// The replace above might only replace the comment. Let's do a better replace:
const resultsCardRegex = /<!-- Result Visualizer -->[\s\S]*?(?=<\/section>)/;
code = code.replace(resultsCardRegex, `<!-- Result Visualizer -->
      <div id="resultsContainer" style="display: flex; flex-direction: column; gap: 16px; width: 100%;"></div>
    `);

fs.writeFileSync('generation-tester-server.js', code);
console.log("Successfully patched generation-tester-server.js for Batch mode!");
