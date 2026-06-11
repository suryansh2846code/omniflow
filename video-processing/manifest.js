import fs from 'fs';
import path from 'path';

export class ProcessManifest {
  /**
   * Generates and writes processing manifest file.
   * @param {string} sourceVideo 
   * @param {Object} metadata 
   * @param {Array} segments 
   * @param {string[]} clipPaths 
   * @param {string} outputDir 
   * @returns {Object} Manifest structure
   */
  static generate(sourceVideo, metadata, segments, clipPaths, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const clips = segments.map((seg, i) => {
      return {
        clipId: seg.clipId,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        filePath: clipPaths[i] || ''
      };
    });

    const manifestData = {
      sourceVideo: path.resolve(sourceVideo),
      metadata,
      clips
    };

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
    console.log(`[ProcessManifest] Saved processing manifest to ${manifestPath}`);

    return manifestData;
  }
}
