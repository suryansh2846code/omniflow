export class ConsistencyEngine {
  /**
   * Enforces consistency policies and compiles the final 8-layer prompt.
   * @param {Object} data 
   * @returns {Object}
   */
  static enforce(data) {
    const { masterContext, characterSheet, visualDNA, editorDNA, storyPlan, clipPrompts } = data;

    // 1. Compile MASTER_CONTEXT layer
    const masterContextStr = `Genre: ${masterContext.visualGenre || 'Cinematic'}. Setting: ${masterContext.overallEnvironment || 'ambient setting'}.`;

    // 2. Compile CHARACTER_SHEET layer
    const charSheetStr = [
      characterSheet.identity,
      characterSheet.face ? `Face: ${characterSheet.face}` : '',
      characterSheet.clothing ? `Clothing: ${characterSheet.clothing}` : '',
      characterSheet.accessories ? `Accessories: ${characterSheet.accessories}` : '',
      characterSheet.bodyType ? `Build: ${characterSheet.bodyType}` : ''
    ].filter(Boolean).join('. ');

    // 3. Compile VISUAL_DNA layer
    const visualDNAStr = `Visual theme: ${visualDNA.colorPalette || 'cohesive grading'}. Lighting: ${visualDNA.lighting || 'balanced lights'}. Style: ${visualDNA.cameraLanguage || 'standard lenses'}.`;

    // 4. Compile EDITOR_DNA layer
    const editorDNAStr = `Editor rules: [Continuity: ${editorDNA.continuityRules}] [Composition: ${editorDNA.compositionRules}] [Color: ${editorDNA.colorRules}] [Pacing: ${editorDNA.pacingRules}].`;

    // Post-process each clip
    data.clipPrompts = clipPrompts.map(clip => {
      // 5. Compile STORY_PLAN layer
      // Find role assigned to this clip
      const roleObj = (storyPlan.clipRoles || []).find(r => r.clipIndex === clip.clipIndex);
      const role = roleObj ? roleObj.role : "Build";
      let storyPlanStr = "";
      if (role === "Hook") {
        storyPlanStr = `Story Hook: ${storyPlan.hook || 'Grab attention'}.`;
      } else if (role === "Payoff") {
        storyPlanStr = `Story Payoff: ${storyPlan.payoff || 'Resolve narrative climax'}.`;
      } else {
        storyPlanStr = `Story Build: ${storyPlan.build || 'Develop narrative tension'}.`;
      }

      // 6. Compile SHOT_PLAN layer
      const shot = clip.shotPlanner;
      const shotPlanStr = `Framing: ${shot.shotType} (${shot.framing}). Camera motion: ${shot.cameraMovement} with ${shot.focalStyle} focal length (Purpose: ${shot.purpose}).`;

      // 7. Compile CLIP_GOAL layer
      let { master, clip: action, technical } = clip.threeLayerPrompt || {};
      if (!action || action.trim().length === 0) {
        action = clip.relationship.currentClipGoal || "The subject proceeds with the action.";
      }
      const clipGoalStr = `Action Goal: ${action}`;

      // 8. Compile TECHNICAL_PROMPT layer
      if (!technical || technical.trim().length === 0) {
        technical = `Transition: entrance ${clip.transitionPlanner.transitionIn}, exit ${clip.transitionPlanner.transitionOut}. Render: 8k resolution, cinematic focus, ultra-detailed.`;
      }
      const technicalPromptStr = `Technical: ${technical}`;

      // Normalize all clauses
      const normalizedMasterContext = this.normalizeClause(masterContextStr);
      const normalizedCharSheet = this.normalizeClause(charSheetStr);
      const normalizedVisualDNA = this.normalizeClause(visualDNAStr);
      const normalizedEditorDNA = this.normalizeClause(editorDNAStr);
      const normalizedStoryPlan = this.normalizeClause(storyPlanStr);
      const normalizedShotPlan = this.normalizeClause(shotPlanStr);
      const normalizedClipGoal = this.normalizeClause(clipGoalStr);
      const normalizedTechnicalPrompt = this.normalizeClause(technicalPromptStr);

      // Stitch all 8 layers programmatically
      const finalAssembledPrompt = [
        normalizedMasterContext,
        normalizedCharSheet,
        normalizedVisualDNA,
        normalizedEditorDNA,
        normalizedStoryPlan,
        normalizedShotPlan,
        normalizedClipGoal,
        normalizedTechnicalPrompt
      ].join(' ');

      // Also ensure threeLayerPrompt values are set/updated
      clip.threeLayerPrompt = {
        master: `${normalizedMasterContext} ${normalizedCharSheet} ${normalizedVisualDNA}`.trim(),
        clip: `${normalizedStoryPlan} ${normalizedShotPlan} ${normalizedClipGoal}`.trim(),
        technical: normalizedTechnicalPrompt
      };

      return {
        ...clip,
        finalAssembledPrompt
      };
    });

    // Make sure we generate rules if missing
    if (!data.consistencyRules || data.consistencyRules.length === 0) {
      data.consistencyRules = [
        {
          ruleId: "rule_char_identity",
          propertyName: "identity",
          description: "Maintain core subject demographics and facial profile",
          targetValue: characterSheet.identity
        },
        {
          ruleId: "rule_char_clothing",
          propertyName: "clothing",
          description: "Maintain consistent apparel items, textures and color schemes",
          targetValue: characterSheet.clothing
        },
        {
          ruleId: "rule_style_palette",
          propertyName: "colorPalette",
          description: "Enforce identical color grading across clips",
          targetValue: visualDNA.colorPalette
        }
      ];
    }

    return data;
  }

  /**
   * Cleans up spacing and ensures a trailing period for clauses.
   * @param {string} clause 
   * @returns {string}
   */
  static normalizeClause(clause) {
    if (!clause) return "";
    let trimmed = clause.trim();
    if (trimmed.length === 0) return "";
    
    // Ensure it ends with punctuation
    if (!/[.!?]$/.test(trimmed)) {
      trimmed += ".";
    }
    return trimmed;
  }
}
