import { EDITOR_DNA_DEFAULTS } from './promptTemplates.js';

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
    editorDNA: {
      continuityRules: output.editorDNA?.continuityRules || EDITOR_DNA_DEFAULTS.continuityRules,
      compositionRules: output.editorDNA?.compositionRules || EDITOR_DNA_DEFAULTS.compositionRules,
      colorRules: output.editorDNA?.colorRules || EDITOR_DNA_DEFAULTS.colorRules,
      storytellingRules: output.editorDNA?.storytellingRules || EDITOR_DNA_DEFAULTS.storytellingRules,
      pacingRules: output.editorDNA?.pacingRules || EDITOR_DNA_DEFAULTS.pacingRules,
      transitionRules: output.editorDNA?.transitionRules || EDITOR_DNA_DEFAULTS.transitionRules
    },
    storyPlan: {
      hook: output.storyPlan?.hook || "Introduce characters and context.",
      build: output.storyPlan?.build || "Develop action and theme tension.",
      payoff: output.storyPlan?.payoff || "Deliver visual and emotional resolution.",
      clipRoles: Array.isArray(output.storyPlan?.clipRoles) ? output.storyPlan.clipRoles.map(r => ({
        clipIndex: typeof r.clipIndex === 'number' ? r.clipIndex : 0,
        role: r.role || "Build"
      })) : []
    },
    cutPlanner: {
      recommendedCuts: Array.isArray(output.cutPlanner?.recommendedCuts) ? output.cutPlanner.recommendedCuts.map(c => ({
        timestamp: typeof c.timestamp === 'number' ? c.timestamp : 0,
        reason: c.reason || "Optimal visual pacing shift",
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.8
      })) : []
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
        shotPlanner: {
          shotType: c.shotPlanner?.shotType || "Medium Shot",
          framing: c.shotPlanner?.framing || "Rule of Thirds centered",
          cameraMovement: c.shotPlanner?.cameraMovement || "Static / Locked-off",
          focalStyle: c.shotPlanner?.focalStyle || "Standard focus depth",
          purpose: c.shotPlanner?.purpose || "Show main character visual state"
        },
        transitionPlanner: {
          transitionIn: c.transitionPlanner?.transitionIn || "Standard Cut",
          transitionOut: c.transitionPlanner?.transitionOut || "Standard Cut",
          reason: c.transitionPlanner?.reason || "Logical chronological flow"
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
