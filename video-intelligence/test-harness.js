import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

import { VideoIntelligenceLayer } from './index.js';
import { VideoProcessingEngine } from '../video-processing/index.js';
import { PromptIntelligenceEngine } from '../prompt-engine/index.js';

async function run() {
  console.log("==================================================");
  console.log("VIDEO INTELLIGENCE / ANALYZER TEST HARNESS");
  console.log("==================================================");

  const apiKey = process.env.GEMINI_API_KEY || "mock-key";
  const videoIntel = new VideoIntelligenceLayer({ apiKey });
  const processEngine = new VideoProcessingEngine();

  const testDir = path.join(process.cwd(), 'video-analyzer-test-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const sourceVideoPath = path.join(testDir, 'source_test.mp4');
  const clipsOutputDir = path.join(testDir, 'clips');
  const userPrompt = "Make it look like a high-tech cyberpunk action movie";

  console.log("[Test] 1. Preparing source test video...");
  const hasFFmpeg = videoIntel.ffmpegHelper.hasFFmpeg;
  if (hasFFmpeg) {
    try {
      execSync(
        `ffmpeg -y -f lavfi -i testsrc=duration=15:size=640x360:rate=30 -c:v libx264 -crf 23 -pix_fmt yuv420p "${sourceVideoPath}"`,
        { stdio: 'ignore' }
      );
      console.log(`[Test] Generated real 15s test video at: ${sourceVideoPath}`);
    } catch (err) {
      console.error("[Test] Failed to generate test video using FFmpeg, writing mock:", err.message);
      fs.writeFileSync(sourceVideoPath, Buffer.from("mock-video-source"));
    }
  } else {
    console.log("[Test] FFmpeg not available. Writing mock source file.");
    fs.writeFileSync(sourceVideoPath, Buffer.from("mock-video-source"));
  }

  console.log("[Test] 2. Splitting source video using VideoProcessingEngine...");
  const manifest = processEngine.process(sourceVideoPath, clipsOutputDir, { segmentLength: 10 });
  const clipPaths = manifest.clips.map(c => c.filePath);
  console.log(`[Test] Split complete. Resulting clips:\n - ${clipPaths.join('\n - ')}`);

  console.log("--------------------------------------------------");
  console.log("[Test] 3. Running VideoIntelligenceLayer.processClips...");
  try {
    const result = await videoIntel.processClips(clipPaths, userPrompt, { tempDir: path.join(testDir, 'intel-temp') });
    
    console.log("[Test] Video Analyzer clips processing complete!");
    console.log("\n--- VIDEO UNDERSTANDING ---");
    console.log(JSON.stringify(result.videoUnderstanding, null, 2));
    
    console.log("\n--- TRANSLATED PROMPT ENGINE INPUT ---");
    console.log(JSON.stringify(result.promptEngineInput, null, 2));
    console.log("--------------------------------------\n");

    // Perform Structured Output assertions
    console.log("[Test] 4. Performing Structured Output assertions...");
    const intel = result.videoUnderstanding;
    assertField(intel, 'videoSummary');
    assertField(intel, 'characterSheet');
    assertField(intel, 'locations');
    assertField(intel, 'objects');
    assertField(intel, 'cameraStyle');
    assertField(intel, 'sceneTimeline');

    // Assert Character Sheet properties including hair
    console.log("[Test] Asserting unified character sheet properties...");
    const char = intel.characterSheet;
    assertField(char, 'identity');
    assertField(char, 'clothing');
    assertField(char, 'face');
    assertField(char, 'hair');
    assertField(char, 'accessories');
    assertField(char, 'bodyType');

    // Assert timeline uses clipId mapping
    console.log("[Test] Asserting sceneTimeline properties...");
    assert(Array.isArray(intel.sceneTimeline), "sceneTimeline is an array");
    assert(intel.sceneTimeline.length === clipPaths.length, `Timeline items matches clip count (${clipPaths.length})`);
    
    intel.sceneTimeline.forEach((item, idx) => {
      assert(item.clipId === idx + 1, `sceneTimeline item ${idx} matches clipId ${idx + 1}`);
      assertField(item, 'summary');
      assert(Array.isArray(item.characters), `sceneTimeline item ${idx} characters is an array`);
      assertField(item, 'location');
    });

    // Verify Direct Compatibility with Prompt Intelligence Engine
    console.log("\n[Test] 5. Connecting E2E: Feeding metadata to Prompt Intelligence Engine v2...");
    const promptEngine = new PromptIntelligenceEngine({ apiKey });

    // Mock Prompt Intelligence Engine LLM service if in dry run mode
    if (apiKey === 'mock-key') {
      promptEngine.geminiService.generateStructuredPrompt = async function(meta, prompt) {
        console.log("[Mock PromptEngine] generateStructuredPrompt called with translated metadata.");
        return {
          masterContext: {
            visualGenre: "Cyberpunk Action Narrative",
            overallEnvironment: "Neonic rain-slicked skyscrapers and dark alleys",
            editingStyle: "High-paced stylized jump cuts"
          },
          characterSheet: {
            identity: "Young Creator",
            clothing: "Grey cotton hoodie and dark wash jeans",
            face: "Short beard, light eyes",
            hair: "Short dark curly hair, neatly styled",
            accessories: "Smart glasses, smartwatch",
            bodyType: "Athletic build"
          },
          visualDNA: {
            colorPalette: "Cyan, magenta, and deep black neon grades",
            lighting: "High-contrast neon backlighting, moody shadows",
            cameraLanguage: "Anamorphic lens flares, dynamic dutch angles",
            editingStyle: "Paced stylistic fast cuts"
          },
          clipPrompts: meta.clips.map((clip, i) => ({
            clipIndex: clip.clipIndex,
            timestamps: clip.timestamps,
            relationship: {
              previousClipSummary: i === 0 ? "None" : "Prior cyberpunk sequence.",
              currentClipGoal: `Depict cyberpunk version of: ${clip.originalDescription}`,
              nextClipTransition: "Fast neon transition."
            },
            threeLayerPrompt: {
              master: `Cyberpunk action aesthetic. Subject wearing grey hoodie, cybernetic details.`,
              clip: `Action sequence: ${clip.originalDescription}`,
              technical: `Anamorphic lens flares, cyan/magenta color grading, high-speed shutter.`
            },
            finalAssembledPrompt: ""
          })),
          consistencyRules: []
        };
      };
    }

    const promptEngineOutput = await promptEngine.process(result.promptEngineInput);

    console.log("[Test] Prompt Intelligence Engine v2 successfully completed E2E processing!");
    console.log("\n--- FINAL LAYERED PROMPT RESULTS ---");
    promptEngineOutput.clipPrompts.forEach(clip => {
      console.log(`\n[Clip ${clip.clipIndex}] Timestamps: ${clip.timestamps.start}s - ${clip.timestamps.end}s`);
      console.log(`- Master Layer: "${clip.threeLayerPrompt.master}"`);
      console.log(`- Clip Layer:   "${clip.threeLayerPrompt.clip}"`);
      console.log(`- Tech Layer:   "${clip.threeLayerPrompt.technical}"`);
      console.log(`- FINAL ASSEMBLED PROMPT:\n  "${clip.finalAssembledPrompt}"`);
    });
    console.log("------------------------------------\n");
    console.log("[Test] E2E integration verified successfully! ✓");

  } catch (err) {
    console.error("[Test] Verification execution failed:", err);
    process.exit(1);
  } finally {
    cleanup(testDir);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[Assert] ${message} ✓`);
}

function assertField(obj, key) {
  if (!obj || obj[key] === undefined) {
    throw new Error(`Assertion failed: Missing required property "${key}" in output.`);
  }
  console.log(`[Assert] Property "${key}" exists ✓`);
}

function cleanup(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("[Test] Failed to clean up temp dir:", e.message);
  }
}

run().catch(console.error);
