/**
 * Validates the input payload to the Prompt Intelligence Engine.
 * @param {Object} input 
 */
export function validateInput(input) {
  if (!input) {
    throw new Error("Input payload is required.");
  }

  const { videoMetadata, userPrompt } = input;

  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    throw new Error("Input must contain a non-empty string userPrompt.");
  }

  if (!videoMetadata || typeof videoMetadata !== 'object') {
    throw new Error("Input must contain a videoMetadata object.");
  }

  if (typeof videoMetadata.duration !== 'number' || videoMetadata.duration <= 0) {
    throw new Error("videoMetadata must contain a numeric duration > 0.");
  }

  if (!Array.isArray(videoMetadata.clips) || videoMetadata.clips.length === 0) {
    throw new Error("videoMetadata.clips must be a non-empty array.");
  }

  videoMetadata.clips.forEach((clip, index) => {
    if (typeof clip.clipIndex !== 'number') {
      throw new Error(`Clip at index ${index} must have a numeric clipIndex.`);
    }
    if (!clip.timestamps || typeof clip.timestamps !== 'object') {
      throw new Error(`Clip ${clip.clipIndex} must have a timestamps object.`);
    }
    if (typeof clip.timestamps.start !== 'number' || typeof clip.timestamps.end !== 'number') {
      throw new Error(`Clip ${clip.clipIndex} must contain numeric start and end timestamps.`);
    }
    if (!clip.originalDescription || typeof clip.originalDescription !== 'string' || clip.originalDescription.trim().length === 0) {
      throw new Error(`Clip ${clip.clipIndex} must contain a non-empty string originalDescription.`);
    }
  });
}

/**
 * Validates the output from the LLM or engine and patches defaults if missing.
 * @param {Object} output 
 * @returns {Object}
 */
export function validateOutput(output) {
  if (!output || typeof output !== 'object') {
    throw new Error("Output is missing or is not a valid object.");
  }

  // Define defaults and parse safely
  const clean = {
    masterContext: {
      visualGenre: output.masterContext?.visualGenre || "Cinematic Narrative",
      overallEnvironment: output.masterContext?.overallEnvironment || "Styled Scene",
      editingStyle: output.masterContext?.editingStyle || "Cohesive Pacing"
    },
    characterSheet: {
      identity: output.characterSheet?.identity || "Primary Subject",
      clothing: output.characterSheet?.clothing || "Styled clothing",
      face: output.characterSheet?.face || "Clear facial details",
      accessories: output.characterSheet?.accessories || "None",
      bodyType: output.characterSheet?.bodyType || "Unspecified build"
    },
    visualDNA: {
      colorPalette: output.visualDNA?.colorPalette || "Natural grading",
      lighting: output.visualDNA?.lighting || "Cohesive balanced lighting",
      cameraLanguage: output.visualDNA?.cameraLanguage || "Dynamic lens angles",
      editingStyle: output.visualDNA?.editingStyle || "Standard matched cuts"
    },
    clipPrompts: Array.isArray(output.clipPrompts) ? output.clipPrompts.map((c, i) => {
      return {
        clipIndex: typeof c.clipIndex === 'number' ? c.clipIndex : i,
        timestamps: {
          start: c.timestamps?.start || 0,
          end: c.timestamps?.end || 0
        },
        relationship: {
          previousClipSummary: c.relationship?.previousClipSummary || (i === 0 ? "None" : "Prior scene context"),
          currentClipGoal: c.relationship?.currentClipGoal || "Progress the narrative action",
          nextClipTransition: c.relationship?.nextClipTransition || "Cut to next action"
        },
        threeLayerPrompt: {
          master: c.threeLayerPrompt?.master || "",
          clip: c.threeLayerPrompt?.clip || "",
          technical: c.threeLayerPrompt?.technical || ""
        },
        finalAssembledPrompt: c.finalAssembledPrompt || ""
      };
    }) : [],
    consistencyRules: Array.isArray(output.consistencyRules) ? output.consistencyRules.map((r, i) => {
      return {
        ruleId: r.ruleId || `rule_${i}`,
        propertyName: r.propertyName || "Aesthetic Theme",
        description: r.description || "Maintain style continuity",
        targetValue: r.targetValue || "Cohesive visual appearance"
      };
    }) : []
  };

  return clean;
}
