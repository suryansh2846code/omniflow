export class ConsistencyEngine {
  /**
   * Enforces consistency policies on the validated output, post-processing
   * and compiling the final prompt for each clip.
   * @param {Object} data 
   * @returns {Object}
   */
  static enforce(data) {
    const { characterSheet, visualDNA, clipPrompts } = data;

    // Build the master context string based on the Character Sheet and Visual DNA
    const masterSubject = [
      characterSheet.identity,
      characterSheet.face ? `face: ${characterSheet.face}` : '',
      characterSheet.bodyType ? `body: ${characterSheet.bodyType}` : '',
      characterSheet.clothing ? `clothing: ${characterSheet.clothing}` : '',
      characterSheet.accessories ? `accessories: ${characterSheet.accessories}` : ''
    ].filter(Boolean).join(', ');

    const masterAesthetic = [
      `style: ${visualDNA.colorPalette || 'Cohesive color grade'}`,
      `lighting: ${visualDNA.lighting || 'Balanced lighting'}`,
      `genre: ${data.masterContext?.visualGenre || 'Cinematic'}`
    ].filter(Boolean).join(', ');

    // Post-process each clip
    data.clipPrompts = clipPrompts.map(clip => {
      let { master, clip: action, technical } = clip.threeLayerPrompt || {};

      // If the model returned empty prompt layers, construct them dynamically to guarantee consistency
      if (!master || master.trim().length === 0) {
        master = `Scene features ${masterSubject}. Overall environment: ${data.masterContext.overallEnvironment || 'the scene'}. Visual style: ${masterAesthetic}.`;
      }

      if (!action || action.trim().length === 0) {
        action = `Action: ${clip.relationship.currentClipGoal || 'The subject proceeds with the scene.'}`;
      }

      if (!technical || technical.trim().length === 0) {
        technical = `Camera: ${visualDNA.cameraLanguage || 'cinematic lens, standard motion'}. Quality: highly detailed, realistic, high fidelity, 8k resolution.`;
      }

      // Clean and normalize spacing/punctuation
      const cleanMaster = this.normalizeClause(master);
      const cleanAction = this.normalizeClause(action);
      const cleanTechnical = this.normalizeClause(technical);

      // Programmatically assemble the final prompt from the three layers
      const finalAssembledPrompt = `${cleanMaster} ${cleanAction} ${cleanTechnical}`;

      return {
        ...clip,
        threeLayerPrompt: {
          master: cleanMaster,
          clip: cleanAction,
          technical: cleanTechnical
        },
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
