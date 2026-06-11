import http from 'http';
import fs from 'fs';
import path from 'path';
import { GenerationEngine } from './index.js';

const PORT = 3005;
const MOCK_URL = `http://localhost:${PORT}/`;

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <title>Mock Gemini Interface</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: sans-serif; padding: 40px; }
    .composer { border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 12px; margin-top: 20px; background: rgba(20,20,25,0.6); }
    [contenteditable] { border: 1px solid rgba(255,255,255,0.12); min-height: 80px; padding: 12px; border-radius: 8px; background: #000; color: #fff; outline: none; }
    [contenteditable]:focus { border-color: #3b82f6; }
    button { margin-top: 16px; padding: 10px 20px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    button:disabled { background: #27272a; color: #71717a; cursor: not-allowed; }
    .status { margin-top: 20px; color: #a1a1aa; font-size: 14px; }
    .progress { height: 6px; width: 100%; background: #27272a; border-radius: 3px; margin-top: 12px; display: none; overflow: hidden; }
    .progress-bar { height: 100%; width: 0; background: #3b82f6; }
  </style>
</head>
<body>
  <h1>Gemini Mock Workspace</h1>
  <div class="composer">
    <!-- File Input -->
    <input type="file" id="file-uploader" accept="video/*">
    <div id="upload-status" class="status">No file uploaded.</div>
    <div id="upload-progress" class="progress"><div class="progress-bar" id="progress-bar"></div></div>
    <div id="file-chip-container" style="margin-top: 10px;"></div>

    <!-- Prompt Editor -->
    <p style="margin-top: 16px; font-weight: 600;">Prompt Editor:</p>
    <div id="editor" data-slate-editor="true" contenteditable="true"></div>

    <!-- Action Button -->
    <button id="send-btn" aria-label="Send message">Send message</button>
  </div>

  <div id="generation-status" class="status"></div>
  <div id="result-container" style="margin-top: 20px;"></div>

  <script>
    const fileUploader = document.getElementById('file-uploader');
    const uploadStatus = document.getElementById('upload-status');
    const uploadProgress = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const fileChipContainer = document.getElementById('file-chip-container');
    const sendBtn = document.getElementById('send-btn');
    const editor = document.getElementById('editor');
    const genStatus = document.getElementById('generation-status');
    const resultContainer = document.getElementById('result-container');

    // Handle File Upload
    fileUploader.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        uploadStatus.innerText = 'Uploading video...';
        uploadProgress.style.display = 'block';
        let width = 0;
        const interval = setInterval(() => {
          width += 10;
          progressBar.style.width = width + '%';
          if (width >= 100) {
            clearInterval(interval);
            uploadStatus.innerText = 'Upload complete.';
            uploadProgress.style.display = 'none';
            // Render thumbnail container with mock video element
            fileChipContainer.innerHTML = '<video id="uploaded-clip" src="/mock-video.mp4" width="100" height="100"></video><div class="file-thumbnail">clip.mp4</div>';
          }
        }, 100);
      }
    });

    // Handle Send / Generate Click
    sendBtn.addEventListener('click', () => {
      sendBtn.disabled = true;
      sendBtn.setAttribute('aria-disabled', 'true');
      
      genStatus.innerText = "Generating your video... This could take a few minutes";
      
      // Render progress indicator
      const loader = document.createElement('div');
      loader.className = 'generating';
      loader.role = 'progressbar';
      loader.innerText = 'Progress bar loading...';
      document.body.appendChild(loader);

      setTimeout(() => {
        loader.remove();
        genStatus.innerText = "Your video is ready!";
        
        // Render completed output
        resultContainer.innerHTML = '<video src="/mock-video.mp4" controls autoplay></video><button>Download video</button>';
      }, 2500);
    });
  </script>
</body>
</html>
`;

// Start Mock Server
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
  } else if (req.url === '/mock-video.mp4') {
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    res.end(Buffer.alloc(1024)); // dummy video bytes
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, async () => {
  console.log(`[TestMockServer] Mock Gemini running at ${MOCK_URL}`);

  // Create temporary test file
  const tempClipPath = path.resolve('./omniflow-temp/test-clip-source.mp4');
  if (!fs.existsSync(path.dirname(tempClipPath))) {
    fs.mkdirSync(path.dirname(tempClipPath), { recursive: true });
  }
  fs.writeFileSync(tempClipPath, 'fake mp4 bytes');

  try {
    const engine = new GenerationEngine({
      chromePort: 9222,
      uploadTimeoutMs: 10000,
      generationTimeoutMs: 15000
    });

    console.log("[Test] Running E2E Generation Engine job...");
    const result = await engine.runJob({
      clipId: 'test_clip_1',
      videoPath: tempClipPath,
      prompt: 'Produce a futuristic neon style tracking shot.',
      geminiUrl: MOCK_URL
    });

    console.log("\n==================================================");
    console.log("TEST RUN COMPLETE. RESULT PAYLOAD:");
    console.log(JSON.stringify(result, null, 2));
    console.log("==================================================\n");

    // Perform Assertions
    if (!result.uploaded) throw new Error("Assertion failed: video was not uploaded.");
    if (!result.promptInserted) throw new Error("Assertion failed: prompt was not inserted.");
    if (!result.generationStarted) throw new Error("Assertion failed: generation did not start.");
    if (!result.generationCompleted) throw new Error("Assertion failed: generation did not complete.");
    if (!result.videoUrl || !result.videoUrl.includes('mock-video.mp4')) {
      throw new Error(`Assertion failed: videoUrl is invalid: ${result.videoUrl}`);
    }

    console.log("🎉 ALL E2E AUTOMATION TEST ASSERTIONS PASSED SUCCESSFULLY!");
    process.exitCode = 0;
  } catch (err) {
    console.error("❌ TEST RUN FAILED:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup files
    if (fs.existsSync(tempClipPath)) {
      try {
        fs.unlinkSync(tempClipPath);
      } catch (e) {}
    }
    server.close(() => {
      console.log("[TestMockServer] Mock server stopped.");
      process.exit();
    });
  }
});
