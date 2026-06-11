import { ClipRulesEngine } from './rulesEngine.js';

export class TimelinePlanner {
  /**
   * Plans the split timeline segments.
   * @param {number} totalDuration 
   * @param {Object} [options] 
   * @param {number} [options.segmentLength]
   * @param {Array} [options.scenes] Placeholder list of custom scene timestamps: [0, 8.5, 17.0, 25.0, ...]
   * @returns {Array} List of segment objects { clipId, start, end, duration }
   */
  static plan(totalDuration, options = {}) {
    const rules = ClipRulesEngine.getRules();
    const targetLength = options.segmentLength || rules.maxClipLengthSeconds;
    const segments = [];

    // Scene-aware splitting logic
    if (options.scenes && options.scenes.length > 0) {
      const markers = [...new Set([0, ...options.scenes, totalDuration])]
        .filter(t => t >= 0 && t <= totalDuration)
        .sort((a, b) => a - b);

      let clipId = 1;
      for (let i = 0; i < markers.length - 1; i++) {
        let start = markers[i];
        let end = markers[i + 1];

        // Sub-split a scene segment if it exceeds rules.maxClipLengthSeconds
        while (end - start > rules.maxClipLengthSeconds + 0.05) {
          const subEnd = start + targetLength;
          segments.push({
            clipId,
            start,
            end: subEnd,
            duration: targetLength
          });
          ClipRulesEngine.validateSegment(start, subEnd);
          clipId++;
          start = subEnd;
        }

        const duration = end - start;
        if (duration > 0.05) {
          segments.push({
            clipId,
            start,
            end,
            duration: parseFloat(duration.toFixed(2))
          });
          ClipRulesEngine.validateSegment(start, end);
          clipId++;
        }
      }
    } else {
      // Standard linear N-second segments
      let start = 0;
      let clipId = 1;

      while (start < totalDuration - 0.05) {
        let end = start + targetLength;
        if (end > totalDuration) {
          end = totalDuration;
        }

        const duration = end - start;
        segments.push({
          clipId,
          start,
          end,
          duration: parseFloat(duration.toFixed(2))
        });

        ClipRulesEngine.validateSegment(start, end);

        clipId++;
        start = end;
      }
    }

    return segments;
  }
}
