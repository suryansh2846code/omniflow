export class ClipRulesEngine {
  /**
   * Applies the clip rules to segment duration choices.
   * @returns {Object} Rules settings
   */
  static getRules() {
    return {
      maxClipLengthSeconds: 10,
      hardMaxSeconds: 10
    };
  }

  /**
   * Checks if a clip segment conforms to splitting rules.
   * @param {number} start 
   * @param {number} end 
   * @returns {boolean}
   * @throws {Error} if clip segment violates any rule
   */
  static validateSegment(start, end) {
    if (start < 0) {
      throw new Error(`Start time cannot be negative: ${start}`);
    }
    if (end <= start) {
      throw new Error(`End time (${end}) must be greater than start time (${start})`);
    }

    const duration = end - start;
    const rules = this.getRules();

    // Rounding safety margin (e.g. 10.001s is okay due to keyframe snapping)
    if (duration > rules.hardMaxSeconds + 0.05) {
      throw new Error(`Clip duration ${duration.toFixed(2)}s exceeds the maximum limit of ${rules.hardMaxSeconds}s`);
    }

    return true;
  }
}
