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
      const lastItem = sceneTimeline[sceneTimeline.length - 1];
      duration = lastItem.end !== undefined ? lastItem.end : (lastItem.timestamps?.end || 30.0);
    }

    const clips = (sceneTimeline || []).map((scene, index) => {
      // Build descriptive scene sentence including character & location details
      const charStr = scene.characters && scene.characters.length > 0
        ? ` featuring ${scene.characters.join(', ')}`
        : '';
      const locStr = scene.location ? ` at ${scene.location}` : '';
      const summaryText = scene.summary || 'Analyzed activity.';
      const originalDescription = `${summaryText}${charStr}${locStr}.`;

      return {
        clipIndex: index,
        timestamps: {
          start: scene.start !== undefined ? scene.start : (scene.timestamps?.start || 0),
          end: scene.end !== undefined ? scene.end : (scene.timestamps?.end || 0)
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

  /**
   * Translates the multi-clip Video Intelligence payload into a structure compatible with
   * Prompt Intelligence Engine v2.
   * 
   * @param {Object} videoIntelPayload Output from Video Intelligence Layer
   * @param {string} userPrompt User editing instruction
   * @param {Object[]} clipsMetadata Physical metadata for each clip
   * @returns {Object} PromptIntelligenceInput object
   */
  static translateClips(videoIntelPayload, userPrompt, clipsMetadata) {
    const { videoSummary, cameraStyle, sceneTimeline } = videoIntelPayload;
    
    const clips = clipsMetadata.map((meta, index) => {
      // Find matching timeline item (clipId is 1-indexed)
      const timelineItem = (sceneTimeline || []).find(t => t.clipId === index + 1) || {};
      
      const charStr = timelineItem.characters && timelineItem.characters.length > 0
        ? ` featuring ${timelineItem.characters.join(', ')}`
        : '';
      const locStr = timelineItem.location ? ` at ${timelineItem.location}` : '';
      const summaryText = timelineItem.summary || 'Analyzed activity.';
      const originalDescription = `${summaryText}${charStr}${locStr}.`;

      return {
        clipIndex: index,
        timestamps: {
          start: meta.start,
          end: meta.end
        },
        originalDescription: originalDescription.trim(),
        cameraShotType: cameraStyle || "standard shot",
        speakerText: ""
      };
    });

    const duration = clipsMetadata.length > 0 ? clipsMetadata[clipsMetadata.length - 1].end : 0.0;
    const resolution = clipsMetadata.length > 0 ? clipsMetadata[0].resolution : "1920x1080";
    const fps = clipsMetadata.length > 0 ? clipsMetadata[0].fps : 30;

    return {
      videoMetadata: {
        duration,
        resolution,
        fps,
        overallDescription: videoSummary || "Analyzed video footage.",
        clips
      },
      userPrompt
    };
  }
}

