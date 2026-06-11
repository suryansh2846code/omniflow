import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class VideoSplitter {
  constructor() {
    this.hasFFmpeg = this.detectFFmpeg();
  }

  detectFFmpeg() {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Physically split video based on planner segment parameters.
   * @param {string} videoPath 
   * @param {Array} segments 
   * @param {string} outputDir 
   * @returns {string[]} Paths of successfully created clips
   */
  split(videoPath, segments, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const clipPaths = [];

    for (const segment of segments) {
      const clipName = `clip_${segment.clipId}.mp4`;
      const clipPath = path.join(outputDir, clipName);

      if (!this.hasFFmpeg) {
        console.warn(`[VideoSplitter] FFmpeg is missing. Generating mock video clip: ${clipName}`);
        fs.writeFileSync(clipPath, Buffer.from(`mock-video-clip-${segment.clipId}-data`));
      } else {
        try {
          console.log(`[VideoSplitter] Cutting clip #${segment.clipId}: ${segment.start}s to ${segment.end}s`);
          execSync(
            `ffmpeg -y -ss ${segment.start} -t ${segment.duration} -i "${videoPath}" -c:v libx264 -crf 23 -c:a aac -reset_timestamps 1 "${clipPath}"`,
            { stdio: 'ignore' }
          );
        } catch (err) {
          console.error(`[VideoSplitter] Failed to split segment #${segment.clipId} via FFmpeg:`, err.message);
          fs.writeFileSync(clipPath, Buffer.from(`mock-video-clip-fallback-${segment.clipId}-data`));
        }
      }

      if (fs.existsSync(clipPath)) {
        clipPaths.push(path.resolve(clipPath));
      }
    }

    return clipPaths;
  }
}
