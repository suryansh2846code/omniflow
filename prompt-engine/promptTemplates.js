export const INTENT_MAPPINGS = {
  cinematic: {
    visualGenre: "Cinematic Drama / Feature Film",
    colorPalette: "Teal and orange cinematic color grade, rich skin tones, deep shadows",
    lighting: "Dramatic chiaroscuro lighting, highly directional key light, subtle rim highlighting, soft fill",
    cameraLanguage: "Anamorphic widescreen, shallow depth of field, steady track and slow camera slides",
    editingStyle: "Slow, deliberate pacing, smooth matched-action cuts, cinematic cross-dissolves"
  },
  cyberpunk: {
    visualGenre: "Cyberpunk / Sci-Fi Dystopian",
    colorPalette: "Electric cyan, neon magenta, deep violet, and dark chrome reflections",
    lighting: "High-contrast neon backlighting, glowing volumetric signs, rain-slicked floor reflections",
    cameraLanguage: "Wide anamorphic lenses, Dutch angles, heavy lens flare, subtle handheld drift",
    editingStyle: "Fast rhythmic cuts, stylized digital glitch transitions, frame jumps"
  },
  vintage: {
    visualGenre: "Vintage / Retro 70s Analog Film",
    colorPalette: "Desaturated warm tones, sepia shadows, faded pastels, yellow-green highlight cast",
    lighting: "Diffused golden-hour natural sunlight, soft ambient illumination, visible light leaks",
    cameraLanguage: "Super 16mm lens texture, organic film grain, soft focus, active manual zoom snaps",
    editingStyle: "Abrupt jump cuts, vintage film burns, visible frame-shake transitions"
  },
  action: {
    visualGenre: "High-Octane Action Blockbuster",
    colorPalette: "Saturated primary colors, high contrast black levels, cool steel blue tones",
    lighting: "Bright daylight, high-key directional lighting, harsh shadows",
    cameraLanguage: "Dynamic tracking shots, rapid whip-pans, close-up details, high shutter speed action freeze",
    editingStyle: "Rapid cuts, time remapping (speed ramps), smash cuts, frame-flash transitions"
  }
};

/**
 * Translates intent keywords in the user prompt to structured guidelines.
 * @param {string} prompt 
 * @returns {Object}
 */
export function translateIntent(prompt) {
  const normalized = (prompt || "").toLowerCase();
  
  // Default values if no matching keywords found
  const translation = {
    visualGenre: "Based on user style",
    colorPalette: "Cohesive palette matching prompt vibe",
    lighting: "Natural lighting, balanced highlights and shadows",
    cameraLanguage: "Standard dynamic camera angles",
    editingStyle: "Standard narrative pace and cuts"
  };

  // Check matching keywords
  for (const [key, mapping] of Object.entries(INTENT_MAPPINGS)) {
    if (normalized.includes(key) || (key === "cinematic" && (normalized.includes("movie") || normalized.includes("film")))) {
      return { ...mapping };
    }
  }

  return translation;
}

export const SYSTEM_INSTRUCTION = `You are a world-class AI Video Director and Lead Prompt Architect for OmniFlow.
Your task is to analyze an input video's clip-by-clip metadata alongside a user editing instruction (and its pre-translated structural guidelines) to produce a cohesive, structured "Prompt Intelligence" JSON payload.

You MUST follow these rules to maintain consistency and continuity across the video:

1. Intent & Context translation:
   - Understand the user editing intent. Use the pre-translated guidelines to style the world.
   - Describe the main characters, environment, lighting, camera, and motion styles.

2. Character Sheet Generator:
   - Identify the main character(s) in the clips (or create a consistent one if the clips imply a single speaker/actor).
   - Write a detailed visual identity, their clothing (colors, materials, items), their face features (hair, eyes, skin, features), their accessories, and their body type.
   - This sheet serves as the source of truth. Every clip where the character appears MUST refer to this exact specification.

3. Visual DNA Generator:
   - Define the visual "DNA" of the styled output: color palette, lighting style, camera language (lenses, shot types), and editing style.

4. Clip Relationship Engine:
   - For each clip, establish its chronological context:
     - previousClipSummary: What happened visually in the previous clip. (For clip 0, this is "None").
     - currentClipGoal: The primary visual/narrative action/focus of this clip.
     - nextClipTransition: How this clip flows or transitions to the next clip.

5. Three-Layer Prompt Architecture:
   - For every clip, generate three distinct prompt layers:
     a) master: Shared setting and character description (inherits directly from the Character Sheet and Visual DNA).
     b) clip: Specific action description, movement, actor performance, and clip goal (inherits from original clip metadata + relationship engine).
     c) technical: Quality tags, rendering style, specific camera movements, frame rate, lighting details, and lens specification.
   - The "finalAssembledPrompt" must be a clean concatenation of the three layers: "[master] [clip] [technical]".

6. Consistency Rules:
   - Output explicit consistency guidelines. For example: "Maintain blue denim jacket across all clips", "Ensure neon lighting highlights are magenta".

You MUST respond strictly in valid JSON matching the schema provided. No markdown code blocks surrounding the JSON unless requested, just return the JSON object directly.`;

/**
 * Builds the user prompt for the LLM.
 * @param {Object} videoMetadata 
 * @param {string} userPrompt 
 * @returns {string}
 */
export function buildUserPrompt(videoMetadata, userPrompt) {
  const structuredIntent = translateIntent(userPrompt);
  
  return JSON.stringify({
    videoMetadata: {
      duration: videoMetadata.duration,
      resolution: videoMetadata.resolution,
      fps: videoMetadata.fps,
      overallDescription: videoMetadata.overallDescription,
      clips: videoMetadata.clips.map(c => ({
        clipIndex: c.clipIndex,
        timestamps: c.timestamps,
        originalDescription: c.originalDescription,
        cameraShotType: c.cameraShotType || "standard",
        speakerText: c.speakerText || ""
      }))
    },
    userPrompt: userPrompt,
    preTranslatedDirectives: structuredIntent
  }, null, 2);
}
