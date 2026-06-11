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

import { PromptIntelligenceEngine } from './index.js';

// Setup test input
const mockInput = {
  videoMetadata: {
    duration: 30,
    resolution: "1920x1080",
    fps: 30,
    overallDescription: "A vlog of a creator talking about tech while walking down the street.",
    clips: [
      {
        clipIndex: 0,
        timestamps: { start: 0, end: 10 },
        originalDescription: "The creator, a young man wearing a simple hoodie, walks down the sidewalk talking to the camera.",
        cameraShotType: "medium close up",
        speakerText: "Hey guys, today I am checking out the latest tech trends."
      },
      {
        clipIndex: 1,
        timestamps: { start: 10, end: 20 },
        originalDescription: "Close up of the creator pointing at a digital billboard showing stock market charts.",
        cameraShotType: "close up",
        speakerText: "Look at those charts, everything is going fully digital."
      },
      {
        clipIndex: 2,
        timestamps: { start: 20, end: 30 },
        originalDescription: "The creator walks away from the camera down a narrow alleyway, looking over his shoulder.",
        cameraShotType: "wide shot",
        speakerText: "Let's see where this road takes us."
      }
    ]
  },
  userPrompt: "Turn my vlog into a cyberpunk movie"
};

const mockGeminiResponse = {
  masterContext: {
    visualGenre: "Cyberpunk / Sci-Fi Dystopian",
    overallEnvironment: "Futuristic rain-slicked city streets with neon light overlays",
    editingStyle: "Paced, rhythmic cuts with occasional digital glitch overlays"
  },
  characterSheet: {
    identity: "Futuristic tech rebel / street hacker",
    clothing: "Reflective black vinyl hoodie with purple fiber-optic accents",
    face: "Spiky silver-grey hair, glowing cybernetic eye implant on the left side",
    accessories: "Holographic headset resting around the neck",
    bodyType: "Slim, athletic build"
  },
  visualDNA: {
    colorPalette: "Electric cyan, neon magenta, deep dark steel blues",
    lighting: "High-contrast neon underlighting, glowing street reflections, volumetric steam haze",
    cameraLanguage: "Anamorphic widescreen lens, subtle lens flares, organic handheld motion",
    editingStyle: "Rhythmic rapid cuts on action beats, seamless match-cuts"
  },
  editorDNA: {
    continuityRules: "Maintain character screen direction (180-degree rule). Enforce matching actions on cuts.",
    compositionRules: "Enforce the rule of thirds. Center subjects during direct address. Guard nose room and eye-line levels.",
    colorRules: "Protect skin tone fidelity. Match color balance across all cuts.",
    storytellingRules: "Ensure hook grabs attention in first 5s. Maintain character motivation and chronological clarity.",
    pacingRules: "Establish rhythmic cutting rates. Match scene changes on visual beats.",
    transitionRules: "Avoid visual jump-cuts unless stylistically motivated. Dissolve for temporal passages, cut for active narrative changes."
  },
  storyPlan: {
    hook: "Introduce tech hacker creator walking down neon street.",
    build: "Reveal stock market cybernetic boards emphasizing digital transformation.",
    payoff: "Hacker walks away into cyber alleyway, showing scale of dystopia.",
    clipRoles: [
      { clipIndex: 0, role: "Hook" },
      { clipIndex: 1, role: "Build" },
      { clipIndex: 2, role: "Payoff" }
    ]
  },
  cutPlanner: {
    recommendedCuts: [
      { timestamp: 5.5, reason: "Mid-clip subject gaze shift", confidence: 0.85 },
      { timestamp: 15.0, reason: "Focus shifts to digital billboard graphics", confidence: 0.9 }
    ]
  },
  clipPrompts: [
    {
      clipIndex: 0,
      timestamps: { start: 0, end: 10 },
      relationship: {
        previousClipSummary: "None",
        currentClipGoal: "Introduce the tech hacker creator speaking to his audience down a dark, neon-lit cyberpunk alleyway.",
        nextClipTransition: "Cut to extreme close-up of a digital billboard."
      },
      shotPlanner: {
        shotType: "Medium Close-up",
        framing: "Subject centered, rule of thirds matching eye-lines",
        cameraMovement: "Slow tracking dolly push-in",
        focalStyle: "Anamorphic shallow depth of field",
        purpose: "Establish character connection and dialogue delivery"
      },
      transitionPlanner: {
        transitionIn: "Fade from black",
        transitionOut: "Standard Match Action Cut",
        reason: "Narrative introduction starting"
      },
      threeLayerPrompt: {
        master: "",
        clip: "He walks down a wet, rain-slicked futuristic sidewalk, speaking directly to the camera.",
        technical: "Shot on wide anamorphic lens, shallow depth of field, subtle lens flare, wet ground reflections, 8k resolution, cinematic quality."
      },
      finalAssembledPrompt: ""
    },
    {
      clipIndex: 1,
      timestamps: { start: 10, end: 20 },
      relationship: {
        previousClipSummary: "Hacker walks down the alley talking to the camera.",
        currentClipGoal: "Focus on the hacker pointing at a glowing digital billboard displaying high-frequency stock charts.",
        nextClipTransition: "Whip pan transition to a wide alleyway."
      },
      shotPlanner: {
        shotType: "Close-up",
        framing: "Asymmetrical framing split between character and billboard",
        cameraMovement: "Static lock-off shot with panning emphasis",
        focalStyle: "Volumetric neon bloom focus",
        purpose: "Highlight digital interface interaction details"
      },
      transitionPlanner: {
        transitionIn: "Standard Match Action Cut",
        transitionOut: "Whip Pan Transition",
        reason: "Rhythmic fast pacing shift"
      },
      threeLayerPrompt: {
        master: "",
        clip: "Close-up of the hacker pointing his hand towards a glowing, high-contrast digital holographic billboard showing stock market charts.",
        technical: "Extreme close-up shot, shallow depth of field, neon bloom effect, volumetric steam haze, hyper-detailed."
      },
      finalAssembledPrompt: ""
    },
    {
      clipIndex: 2,
      timestamps: { start: 20, end: 30 },
      relationship: {
        previousClipSummary: "Hacker points at digital stocks billboard.",
        currentClipGoal: "Hacker walks away from the camera into a dark, foggy narrow street, turning back for a final look.",
        shotType: "Wide Shot",
        framing: "Asymmetrical wide framing showing scale of buildings",
        cameraMovement: "Low angle wide track back",
        focalStyle: "Deep background focus with dense fog",
        purpose: "Create thematic exit payoff visual resolution"
      },
      shotPlanner: {
        shotType: "Wide Shot",
        framing: "Asymmetrical wide framing showing scale of buildings",
        cameraMovement: "Low angle wide track back",
        focalStyle: "Deep background focus with dense fog",
        purpose: "Create thematic exit payoff visual resolution"
      },
      transitionPlanner: {
        transitionIn: "Whip Pan Transition",
        transitionOut: "Slow Fade to Black",
        reason: "Narrative finale resolution"
      },
      threeLayerPrompt: {
        master: "",
        clip: "Wide shot of the hacker walking away from the camera down a narrow, dark, foggy neon alleyway, pausing to look back over his shoulder.",
        technical: "Low angle wide shot, slow tracking push-in, volumetric lighting, dense fog, anamorphic lens flare, cinematic grain."
      },
      finalAssembledPrompt: ""
    }
  ],
  consistencyRules: []
};

async function run() {
  console.log("==================================================");
  console.log("PROMPT INTELLIGENCE ENGINE V3 TEST HARNESS");
  console.log("==================================================");

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log("[Test] No GEMINI_API_KEY found in environment.");
    console.log("[Test] Running in DRY-RUN / MOCK MODE.");
    console.log("--------------------------------------------------");
    
    const engine = new PromptIntelligenceEngine({ apiKey: "mock-key" });
    
    engine.geminiService.generateStructuredPrompt = async function(meta, prompt) {
      console.log("[Mock Gemini] generateStructuredPrompt called.");
      console.log(`[Mock Gemini] User prompt target: "${prompt}"`);
      return mockGeminiResponse;
    };

    try {
      console.log("[Test] Processing inputs...");
      const result = await engine.process(mockInput);
      console.log("[Test] Execution successful!");
      console.log("\n--- RESULT PAYLOAD (V3 AI EDITING PLANNER) ---");
      console.log(JSON.stringify(result, null, 2));
      console.log("----------------------------------------------\n");

      // Verify structure assertions
      assertField(result, 'masterContext');
      assertField(result, 'characterSheet');
      assertField(result, 'visualDNA');
      assertField(result, 'editorDNA');
      assertField(result, 'storyPlan');
      assertField(result, 'cutPlanner');
      assertField(result, 'clipPrompts');
      assertField(result, 'consistencyRules');

      console.log("\n--- STITCHED 8-LAYER PROMPTS ---");
      result.clipPrompts.forEach(clip => {
        console.log(`\n[Clip ${clip.clipIndex}]`);
        console.log(`FINAL PROMPT: "${clip.finalAssembledPrompt}"`);
      });

      console.log("\n[Test] Assertion checklist passed successfully!");
    } catch (err) {
      console.error("[Test] Dry-run execution failed:", err);
      process.exit(1);
    }
  } else {
    console.log("[Test] Active GEMINI_API_KEY detected.");
    console.log("[Test] Running LIVE API verification...");
    console.log("--------------------------------------------------");

    const engine = new PromptIntelligenceEngine({ apiKey });
    try {
      const result = await engine.process(mockInput);
      console.log("[Test] Live execution successful!");
      console.log("\n--- LIVE RESULT PAYLOAD ---");
      console.log(JSON.stringify(result, null, 2));
      console.log("---------------------------\n");
      
      assertField(result, 'masterContext');
      assertField(result, 'characterSheet');
      assertField(result, 'visualDNA');
      assertField(result, 'editorDNA');
      assertField(result, 'storyPlan');
      assertField(result, 'cutPlanner');
      assertField(result, 'clipPrompts');
      assertField(result, 'consistencyRules');
      
      console.log("[Test] Live assertion checklist passed successfully!");
    } catch (err) {
      console.error("[Test] Live API execution failed:", err);
      process.exit(1);
    }
  }
}

function assertField(obj, key) {
  if (!obj[key]) {
    throw new Error(`Assertion failed: Missing required property "${key}" in output.`);
  }
  console.log(`[Assert] Property "${key}" exists ✓`);
}

run().catch(console.error);
