import { VideoIntelligenceLayer } from './index.js';
import { PromptIntelligenceEngine } from '../prompt-engine/index.js';
import path from 'path';

async function run() {
  console.log("==================================================");
  console.log("VIDEO INTELLIGENCE LAYER TEST HARNESS");
  console.log("==================================================");

  const apiKey = process.env.GEMINI_API_KEY || "mock-key";
  const videoIntel = new VideoIntelligenceLayer({ apiKey });

  const dummyVideoPath = path.join(process.cwd(), 'dummy_video.mp4');
  const userPrompt = "Make it look like a vintage film";

  console.log(`[Test] Processing target video: "${dummyVideoPath}"`);
  console.log(`[Test] Edit prompt instructions: "${userPrompt}"`);
  console.log("--------------------------------------------------");

  try {
    // 1. Run the Video Intelligence pipeline
    const result = await videoIntel.process(dummyVideoPath, userPrompt);
    
    console.log("[Test] Video Intelligence processing complete!");
    console.log("\n--- VIDEO UNDERSTANDING ---");
    console.log(JSON.stringify(result.videoUnderstanding, null, 2));
    
    console.log("\n--- TRANSLATED PROMPT ENGINE INPUT ---");
    console.log(JSON.stringify(result.promptEngineInput, null, 2));
    console.log("--------------------------------------\n");

    // 2. Perform validations
    const intel = result.videoUnderstanding;
    assertField(intel, 'videoSummary');
    assertField(intel, 'characterSheet');
    assertField(intel, 'locations');
    assertField(intel, 'objects');
    assertField(intel, 'cameraStyle');
    assertField(intel, 'sceneTimeline');

    // 3. Demonstrate direct compatibility with Prompt Intelligence Engine
    console.log("\n[Test] Connecting E2E: Feeding metadata to Prompt Intelligence Engine v2...");
    const promptEngine = new PromptIntelligenceEngine({ apiKey });

    // Mock Prompt Intelligence Engine LLM service if in dry run mode
    if (apiKey === 'mock-key') {
      promptEngine.geminiService.generateStructuredPrompt = async function(meta, prompt) {
        console.log("[Mock PromptEngine] generateStructuredPrompt called with translated metadata.");
        return {
          masterContext: {
            visualGenre: "Vintage / Retro 70s Analog Film",
            overallEnvironment: "Warm desaturated city sidewalk and corners",
            editingStyle: "Vintage film pacing with visible frame jitter"
          },
          characterSheet: {
            identity: "Young developer/creator",
            clothing: "Grey cotton hoodie and retro denim jacket",
            face: "Short dark hair, light beard, natural eyes",
            accessories: "Smartwatch on wrist",
            bodyType: "Average build"
          },
          visualDNA: {
            colorPalette: "Desaturated sepia warm tones, faded pastels",
            lighting: "Soft ambient sunlight, natural low contrast shadows",
            cameraLanguage: "16mm film lens grain, soft focus lens, handheld shake",
            editingStyle: "Jump cuts, analog film burn transitions"
          },
          clipPrompts: meta.clips.map((clip, i) => ({
            clipIndex: clip.clipIndex,
            timestamps: clip.timestamps,
            relationship: {
              previousClipSummary: i === 0 ? "None" : "Subject walked down retro sidewalk.",
              currentClipGoal: `Represent action: ${clip.originalDescription}`,
              nextClipTransition: "Matched jump cut."
            },
            threeLayerPrompt: {
              master: `1970s analog film scene featuring the young developer creator. Style: desaturated sepia tones.`,
              clip: `He moves on screen: ${clip.originalDescription}`,
              technical: `16mm lens texture, active handheld drift, organic grain.`
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
  }
}

function assertField(obj, key) {
  if (!obj[key]) {
    throw new Error(`Assertion failed: Missing required property "${key}" in output.`);
  }
  console.log(`[Assert] Video Intelligence field "${key}" exists ✓`);
}

run().catch(console.error);
