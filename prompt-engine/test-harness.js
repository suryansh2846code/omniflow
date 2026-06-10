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
  clipPrompts: [
    {
      clipIndex: 0,
      timestamps: { start: 0, end: 10 },
      relationship: {
        previousClipSummary: "None",
        currentClipGoal: "Introduce the tech hacker creator speaking to his audience down a dark, neon-lit cyberpunk alleyway.",
        nextClipTransition: "Cut to extreme close-up of a digital billboard."
      },
      threeLayerPrompt: {
        master: "Sci-Fi cyberpunk scene featuring a slim athletic street hacker with spiky silver-grey hair and a glowing cybernetic left eye. He is wearing a reflective black vinyl hoodie with purple fiber-optic accents and a holographic headset around his neck. Style: Electric cyan and neon magenta color palette, dark steel blues, high-contrast neon underlighting.",
        clip: "He walks down a wet, rain-slicked futuristic sidewalk, speaking directly to the camera in a medium close-up shot.",
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
      threeLayerPrompt: {
        master: "Sci-Fi cyberpunk scene featuring a slim athletic street hacker with spiky silver-grey hair and a glowing cybernetic left eye. He is wearing a reflective black vinyl hoodie with purple fiber-optic accents. Style: Electric cyan and neon magenta lighting.",
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
        nextClipTransition: "Slow fade to black."
      },
      threeLayerPrompt: {
        master: "Sci-Fi cyberpunk scene featuring a slim athletic street hacker in a reflective black vinyl hoodie with purple fiber-optic accents. Style: Electric cyan and neon magenta color palette, dark steel blues, moody neon lights.",
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
  console.log("PROMPT INTELLIGENCE ENGINE V2 TEST HARNESS");
  console.log("==================================================");

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log("[Test] No GEMINI_API_KEY found in environment.");
    console.log("[Test] Running in DRY-RUN / MOCK MODE.");
    console.log("--------------------------------------------------");
    
    // Create an engine instance that mocks the service
    const engine = new PromptIntelligenceEngine({ apiKey: "mock-key" });
    
    // Inject mock generator behavior
    engine.geminiService.generateStructuredPrompt = async function(meta, prompt) {
      console.log("[Mock Gemini] generateStructuredPrompt called.");
      console.log(`[Mock Gemini] User prompt target: "${prompt}"`);
      return mockGeminiResponse;
    };

    try {
      console.log("[Test] Processing inputs...");
      const result = await engine.process(mockInput);
      console.log("[Test] Execution successful!");
      console.log("\n--- RESULT PAYLOAD ---");
      console.log(JSON.stringify(result, null, 2));
      console.log("----------------------\n");

      // Verify structure assertions
      assertField(result, 'masterContext');
      assertField(result, 'characterSheet');
      assertField(result, 'visualDNA');
      assertField(result, 'clipPrompts');
      assertField(result, 'consistencyRules');

      console.log("[Test] Assertion checklist passed successfully!");
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
