export class DataTranslator {
  /**
   * Translates the Video Intelligence payload into a structure compatible with
   * Prompt Intelligence Engine v2.
   * 
   * @param {Object} videoIntelPayload Output from Video Intelligence Layer
   * @param {string} userPrompt User editing instruction
   * @param {Object} [options] Optional resolution/fps overrides
   * @returns {Object} PromptIntelligenceInput object
   */
  static translate(videoIntelPayload, userPrompt, options = {}) {
    const { videoSummary, cameraStyle, sceneTimeline } = videoIntelPayload;
    
    // Determine overall duration from the end of the last timeline segment
    let duration = 30.0;
    if (Array.isArray(sceneTimeline) && sceneTimeline.length > 0) {
      duration = sceneTimeline[sceneTimeline.length - 1].end;
    }

    const clips = (sceneTimeline || []).map((scene, index) => {
      // Build descriptive scene sentence including character & location details
      const charStr = scene.characters && scene.characters.length > 0
        ? ` featuring ${scene.characters.join(', ')}`
        : '';
      const locStr = scene.location ? ` at ${scene.location}` : '';
      const originalDescription = `${scene.summary}${charStr}${locStr}.`;

      return {
        clipIndex: index,
        timestamps: {
          start: scene.start,
          end: scene.end
        },
        originalDescription: originalDescription.trim(),
        cameraShotType: cameraStyle || "standard shot",
        speakerText: "" // Optional metadata
      };
    });

    return {
      videoMetadata: {
        duration,
        resolution: options.resolution || "1920x1080",
        fps: options.fps || 30,
        overallDescription: videoSummary || "Analyzed video footage.",
        clips
      },
      userPrompt
    };
  }
}
