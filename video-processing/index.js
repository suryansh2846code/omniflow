import { VideoValidator } from './validator.js';
import { VideoMetadataExtractor } from './metadata.js';
import { TimelinePlanner } from './timelinePlanner.js';
import { VideoSplitter } from './splitter.js';
import { ProcessManifest } from './manifest.js';

export class VideoProcessingEngine {
  constructor() {
    this.extractor = new VideoMetadataExtractor();
    this.splitter = new VideoSplitter();
  }

  /**
   * Orchestrates the video processing pipeline.
   * @param {string} videoPath Source video file path
   * @param {string} outputDir Directory where manifest and clips will be written
   * @param {Object} [options] Split configurations (segmentLength, scenes)
   * @returns {Object} Manifest data
   */
  process(videoPath, outputDir, options = {}) {
    console.log(`[VideoProcessingEngine] Processing: "${videoPath}" -> "${outputDir}"`);
    
    // 1. Validate
    const absoluteVideoPath = VideoValidator.validate(videoPath);

    // 2. Extract Metadata
    const metadata = this.extractor.extract(absoluteVideoPath);
    console.log(`[VideoProcessingEngine] Extracted Metadata: duration=${metadata.duration}s, fps=${metadata.fps}, resolution=${metadata.resolution}, codec=${metadata.codec}`);

    // 3. Plan Timeline
    const segments = TimelinePlanner.plan(metadata.duration, options);
    console.log(`[VideoProcessingEngine] Generated split plan: ${segments.length} segments.`);

    // 4. Split Clips
    const clipPaths = this.splitter.split(absoluteVideoPath, segments, outputDir);

    // 5. Generate Manifest
    const manifest = ProcessManifest.generate(absoluteVideoPath, metadata, segments, clipPaths, outputDir);

    return manifest;
  }
}
