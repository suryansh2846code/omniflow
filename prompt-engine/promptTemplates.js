export const EDITOR_DNA_DEFAULTS = {
  continuityRules: "Maintain character screen direction (180-degree rule). Enforce matching actions on cuts.",
  compositionRules: "Enforce the rule of thirds. Center subjects during direct address. Guard nose room and eye-line levels.",
  colorRules: "Protect skin tone fidelity. Match color balance across all cuts.",
  storytellingRules: "Ensure hook grabs attention in first 5s. Maintain character motivation and chronological clarity.",
  pacingRules: "Establish rhythmic cutting rates. Match scene changes on visual beats.",
  transitionRules: "Avoid visual jump-cuts unless stylistically motivated. Dissolve for temporal passages, cut for active narrative changes."
};

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

  for (const [key, mapping] of Object.entries(INTENT_MAPPINGS)) {
    if (normalized.includes(key) || (key === "cinematic" && (normalized.includes("movie") || normalized.includes("film")))) {
      return { ...mapping };
    }
  }

  return translation;
}

export const SYSTEM_INSTRUCTION = `You are a world-class AI Video Director and Lead Prompt Architect for OmniFlow.
Your task is to analyze an input video's clip-by-clip metadata alongside a user editing instruction (and its pre-translated structural guidelines) to produce a cohesive, structured "AI Editing Planner" JSON payload.

You MUST follow these rules to maintain visual and narrative consistency:

1. Intent & Context translation:
   - Understand the user editing intent. Use the pre-translated guidelines to style the world.

2. Character Sheet Generator:
   - Identify the main character(s) in the clips.
   - Describe a clear, distinct visual identity (clothing, face, accessories, body type) that can be easily described in words.

3. Visual DNA Generator:
   - Define the visual "DNA" of the styled output: color palette, lighting style, camera language, and editing style.

4. Editor DNA Engine:
   - Provide editing guidelines mapping to professional standards.

5. Story Planner:
   - Design a structural narrative arc (hook, build, payoff) for the clips, including mapping each clip to a narrative role.

6. Cut Planner:
   - Recommend logical cut timestamps (in seconds) to improve visual pacing.

7. Clip-Specific Planners (For each clip):
   - relationship: previousClipSummary, currentClipGoal, nextClipTransition.
   - shotPlanner: Define visual staging (shotType, framing, cameraMovement, focalStyle, purpose).
   - transitionPlanner: Define entry/exit transitions.
   - threeLayerPrompt: Create high-quality, elegant, and natural cinematic prompt layers. Avoid robotic prefix headers or metadata codes.
      - master: Natural prose describing the setting and character in detail. Start this prompt by explicitly directing Gemini to generate a video rather than text (e.g. "Create a video clip of: A retro-futuristic synthwave city street at dusk, neon signs reflecting off wet pavement. A young woman with a leather jacket and neon visor looks around.").
      - clip: Clean, fluid, and natural description of the specific action goal of the character in this clip (e.g. "She accesses a pocket hologram device, illuminating her face as she walks dynamically through the crowds.").
      - technical: Direct visual rendering, color, lighting, and camera lens instructions (e.g. "volumetric lighting, cool magenta and blue highlights, cinematic depth of field, captured on a 24mm camera lens with slow panning motion").

You MUST prefix all generated final prompts with: "Create a video of: " to explicitly force Gemini into video rendering mode. Do NOT allow conversational analyses or descriptive reviews.

You MUST respond strictly in valid JSON matching the schema provided. No markdown wrapping unless requested.`;

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
    preTranslatedDirectives: structuredIntent,
    editorDnaDefaults: EDITOR_DNA_DEFAULTS
  }, null, 2);
}
