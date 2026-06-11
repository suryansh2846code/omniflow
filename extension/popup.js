const API_BASE = 'http://localhost:3007';

document.addEventListener('DOMContentLoaded', () => {
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

  // File input handler
  fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) {
    fileLabel.textContent = `Selected: ${file.name} (${(file.size / (1024*1024)).toFixed(2)} MB)`;
    checkForm();
  } else {
    fileLabel.textContent = "Drag & drop source video";
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
  logOutput.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
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

    const res = await fetch(`${API_BASE}/api/process-full-pipeline?${queryParams.toString()}`, {
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
    log(`Backend pipeline success! Generated ${data.tasks.length} clip instructions.`);

    // --- PHASE 4: Parallel Video Generation (Frontend Automation) ---
    updateStep('gen', 'active', `Triggering ${data.tasks.length} Gemini tabs in parallel...`);
    generatedClipsExpected = data.tasks.length;
    generatedClipsFound = [];
    
    let hasError = false;
    const chromePort = chromePortInput.value.trim() || '9222';
    
    const runningPromises = data.tasks.map((task, index) => {
      return new Promise((resolve) => {
        log(`Starting SSE event listener for ${task.clipId}...`);
        const params = new URLSearchParams({
          clipId: task.clipId,
          videoPath: task.videoPath,
          prompt: task.prompt,
          chromePort: chromePort
        });
        const sse = new EventSource(`${API_BASE}/api/run-stream?${params.toString()}`);

        sse.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'log') {
              log(`[${task.clipId}] ${payload.data}`);
            } else if (payload.type === 'error') {
              log(`[${task.clipId}] ERROR: ${payload.data}`);
              hasError = true;
            } else if (payload.type === 'result') {
              if (payload.data.downloadedPath) {
                generatedClipsFound.push(payload.data.downloadedPath);
                log(`Detected completed clip: ${payload.data.downloadedPath.split('/').pop() || payload.data.downloadedPath.split('\\\\').pop()}`);
                updateStep('gen', 'active', `Generated ${generatedClipsFound.length} of ${generatedClipsExpected} clips...`);
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

// --- PHASE 5: Post-Processing & Merge ---
async function triggerMergePhase(clipPaths) {
  updateStep('merge', 'active', 'Sending generated clips to FFmpeg merger...');
  log('Calling /api/run-merge...');

  try {
    const mergeRes = await fetch(`${API_BASE}/api/run-merge`, {
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
    const videoUrl = `${API_BASE}/merged-output/${encodeURIComponent(videoFilename)}`;
    
    document.getElementById('finalVideo').src = videoUrl;
    document.getElementById('downloadLink').href = videoUrl;
    
    resultPanel.style.display = 'block';

  } catch (err) {
    log('Error during merge: ' + err.message);
    updateStep('merge', 'error', err.message);
  }
}
});
