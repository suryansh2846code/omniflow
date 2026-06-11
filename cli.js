import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

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

import { VideoIntelligenceLayer } from './video-intelligence/index.js';
import { PromptIntelligenceEngine } from './prompt-engine/index.js';

// Parse arguments
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const val = process.argv[i + 1];
    if (val && !val.startsWith('--')) {
      args[key] = val;
      i++;
    } else {
      args[key] = true;
    }
  }
}

const videoPath = args.video;
if (!videoPath) {
  console.error("Error: --video <path> is required.");
  process.exit(1);
}
const absoluteVideoPath = path.resolve(videoPath);

const prompt = args.prompt;
if (!prompt) {
  console.error("Error: --prompt <instruction> is required.");
  process.exit(1);
}

const output = args.output || 'output.mp4';
const absoluteOutputPath = path.resolve(output);

const tempDir = args.tempDir || './omniflow-temp';
const absoluteTempDir = path.resolve(tempDir);

const segmentLength = parseInt(args.segmentLength || '10', 10);
const port = parseInt(args.port || '3001', 10);
const apiKey = args.apiKey || process.env.GEMINI_API_KEY || 'mock-key';

if (!fs.existsSync(absoluteTempDir)) {
  fs.mkdirSync(absoluteTempDir, { recursive: true });
}

let projectManifest = {
  videoPath: absoluteVideoPath,
  outputPath: absoluteOutputPath,
  tempDir: absoluteTempDir,
  prompt,
  segmentLength,
  status: 'initializing', // 'initializing', 'processing', 'completed'
  clips: []
};

function writeManifest() {
  fs.writeFileSync(
    path.join(absoluteTempDir, 'project_manifest.json'),
    JSON.stringify(projectManifest, null, 2)
  );
}

function checkCompletionAndStitch(server) {
  const allDone = projectManifest.clips.every(c => c.status === 'completed');
  if (allDone) {
    console.log("\n[CLI] All clips have been processed and uploaded successfully!");
    console.log("[CLI] Step 4: Stitching/Merging clips into final output video...");
    projectManifest.status = 'completed';
    writeManifest();

    const videoIntel = new VideoIntelligenceLayer({ apiKey });
    const ffmpeg = videoIntel.ffmpegHelper;

    const processedPaths = projectManifest.clips.map(c => c.processedPath);
    try {
      ffmpeg.mergeVideos(processedPaths, absoluteOutputPath, absoluteTempDir);
      console.log(`\n==================================================`);
      console.log(`🎉 SUCCESS: Final video output: ${absoluteOutputPath}`);
      console.log(`==================================================\n`);
      
      // Stop server and exit CLI
      server.close(() => {
        console.log("[CLI] Server stopped. Goodbye!");
        process.exit(0);
      });
    } catch (err) {
      console.error("[CLI] Merging failed:", err.message);
      process.exit(1);
    }
  }
}

async function run() {
  console.log("==================================================");
  console.log("OMNIFLOW PIPELINE RUNNER");
  console.log("==================================================");
  console.log(`Input video:    ${absoluteVideoPath}`);
  console.log(`Target prompt:  "${prompt}"`);
  console.log(`Temp workspace: ${absoluteTempDir}`);
  console.log(`Output video:   ${absoluteOutputPath}`);
  console.log("--------------------------------------------------");

  // Verify input file exists (or mock it if it doesn't exist AND we are in dry-run mode)
  if (!fs.existsSync(absoluteVideoPath)) {
    if (apiKey === 'mock-key') {
      console.warn(`[CLI] Input video not found at ${absoluteVideoPath}. Creating dummy mock input video.`);
      fs.writeFileSync(absoluteVideoPath, Buffer.from("mock-video-binary-content"));
    } else {
      console.error(`Error: Input video file does not exist at ${absoluteVideoPath}`);
      process.exit(1);
    }
  }

  const videoIntel = new VideoIntelligenceLayer({ apiKey });
  const ffmpeg = videoIntel.ffmpegHelper;

  // 1. Split video into segments
  console.log("[CLI] Step 1: Splitting source video into N-second segments...");
  const clipsDir = path.join(absoluteTempDir, 'source_clips');
  const clipPaths = ffmpeg.splitVideo(absoluteVideoPath, clipsDir, segmentLength);
  console.log(`[CLI] Created ${clipPaths.length} source clip files.`);

  // 2. Perform Video Intelligence analysis & Prompt assembly
  console.log("[CLI] Step 2: Running Video Intelligence & Prompt Compiler...");
  const intelResult = await videoIntel.process(absoluteVideoPath, prompt, { tempDir: path.join(absoluteTempDir, 'frames') });
  
  console.log("[CLI] Translating metadata to Prompt Intelligence Engine...");
  const promptEngine = new PromptIntelligenceEngine({ apiKey });

  // If in dry-run/mock mode, override promptEngine's service to avoid API errors
  if (apiKey === 'mock-key') {
    promptEngine.geminiService.generateStructuredPrompt = async function(meta, pr) {
      console.log("[Mock PromptEngine] Generating mock prompt engine response...");
      return {
        masterContext: {
          visualGenre: "Cinematic film edit",
          overallEnvironment: "Warm visual atmosphere",
          editingStyle: "Rhythmic pacing"
        },
        characterSheet: { identity: "Unknown subject", clothing: "Normal clothing", face: "Neutral face", accessories: "None", bodyType: "Average" },
        visualDNA: { colorPalette: "Natural", lighting: "Standard", cameraLanguage: "Organic tracking", editingStyle: "Clean cuts" },
        editorDNA: {
          continuityRules: "Standard continuity.",
          compositionRules: "Rule of thirds.",
          colorRules: "Grade consistency.",
          storytellingRules: "Narrative clarity.",
          pacingRules: "Rhythmic beats.",
          transitionRules: "Clean cuts."
        },
        storyPlan: {
          hook: "Scene hook",
          build: "Build actions",
          payoff: "Resolution payoff",
          clipRoles: clipPaths.map((_, i) => ({ clipIndex: i, role: i === 0 ? "Hook" : (i === clipPaths.length - 1 ? "Payoff" : "Build") }))
        },
        cutPlanner: { recommendedCuts: [] },
        clipPrompts: clipPaths.map((cp, i) => ({
          clipIndex: i,
          timestamps: { start: i * segmentLength, end: (i + 1) * segmentLength },
          relationship: { previousClipSummary: "None", currentClipGoal: "Visual action", nextClipTransition: "Standard Cut" },
          shotPlanner: { shotType: "Medium", framing: "Centered", cameraMovement: "Tracking", focalStyle: "Shallow", purpose: "Staging" },
          transitionPlanner: { transitionIn: "Cut", transitionOut: "Cut", reason: "Standard pace" },
          threeLayerPrompt: { master: "Style theme", clip: `Segment ${i}`, technical: "Cinematic details" },
          finalAssembledPrompt: `Genre: Cinematic. Visual theme: Natural. Editor rules: Rule of thirds. Story role: Build. Framing: Center. Action Goal: Segment ${i}. Technical: Cinematic.`
        })),
        consistencyRules: []
      };
    };
  }

  const promptResult = await promptEngine.process(intelResult.promptEngineInput);
  console.log("[CLI] Prompt Engine compilation complete.");

  // Map generated prompts into the manifest
  const processedClipsDir = path.join(absoluteTempDir, 'processed_clips');
  if (!fs.existsSync(processedClipsDir)) {
    fs.mkdirSync(processedClipsDir, { recursive: true });
  }

  projectManifest.clips = clipPaths.map((cp, index) => {
    // Find matching prompt from prompt engine
    const clipPromptObj = promptResult.clipPrompts.find(c => c.clipIndex === index) || {
      finalAssembledPrompt: `Process clip ${index} with target prompt: ${prompt}`
    };

    return {
      index,
      sourcePath: cp,
      fileName: path.basename(cp),
      prompt: clipPromptObj.finalAssembledPrompt,
      status: 'pending', // 'pending', 'generating', 'completed'
      processedPath: path.join(processedClipsDir, `clip_${String(index).padStart(3, '0')}_processed.mp4`)
    };
  });

  projectManifest.status = 'processing';
  writeManifest();

  // 3. Start local HTTP server
  console.log("[CLI] Step 3: Starting local orchestrator server...");
  const server = http.createServer((req, res) => {
    // CORS headers
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

    // GET /project -> returns manifest
    if (req.method === 'GET' && pathname === '/project') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projectManifest));
      return;
    }

    // POST /upload-clip?index=N -> accepts video binary upload
    if (req.method === 'POST' && pathname === '/upload-clip') {
      const indexStr = parsedUrl.searchParams.get('index');
      const index = parseInt(indexStr, 10);
      
      const clip = projectManifest.clips.find(c => c.index === index);
      if (!clip) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid clip index: ${indexStr}` }));
        return;
      }

      console.log(`[Server] Upload starting for Clip #${index}...`);
      const fileStream = fs.createWriteStream(clip.processedPath);
      req.pipe(fileStream);

      fileStream.on('error', (err) => {
        console.error(`[Server] Error saving file for Clip #${index}:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Failed to save clip: ${err.message}` }));
      });

      req.on('end', () => {
        console.log(`[Server] Clip #${index} uploaded successfully.`);
        clip.status = 'completed';
        writeManifest();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, index }));

        // Check if all clips are complete
        checkCompletionAndStitch(server);
      });
      return;
    }

    // POST /log -> receives browser diagnostic log
    if (req.method === 'POST' && pathname === '/log') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const logPayload = JSON.parse(body);
          console.log(`[Browser][${logPayload.level || 'info'}] ${logPayload.message}`);
        } catch (e) {
          console.log(`[Browser] Raw log: ${body}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    // Default route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`[Server] Orchestrator running on http://localhost:${port}`);
    console.log(`==================================================`);
    console.log(`1. Open Chrome and navigate to the Omni site (e.g. omni.so).`);
    console.log(`2. Click the OmniFlow extension icon.`);
    console.log(`3. Under "CLI Sync Mode", click "Sync with CLI".`);
    console.log(`4. Follow the checklist on screen as OmniFlow automates generation.`);
    console.log(`==================================================\n`);
  });
}

run().catch(err => {
  console.error("[CLI] Execution failed:", err);
  process.exit(1);
});
