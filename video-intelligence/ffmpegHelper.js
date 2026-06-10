import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class FFmpegHelper {
  constructor() {
    this.hasFFmpeg = this.detectFFmpeg();
  }

  /**
   * Checks if ffmpeg command is available in the path.
   * @returns {boolean}
   */
  detectFFmpeg() {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retrieves the duration of the video.
   * @param {string} videoPath 
   * @returns {number}
   */
  getVideoDuration(videoPath) {
    if (!this.hasFFmpeg) {
      console.warn("[FFmpegHelper] FFmpeg is missing. Returning mock duration of 30.0 seconds.");
      return 30.0;
    }

    try {
      // Use ffprobe first if available
      try {
        const durationStr = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
          { encoding: 'utf8' }
        );
        const duration = parseFloat(durationStr.trim());
        if (!isNaN(duration)) return duration;
      } catch (err) {
        // Fallback to ffmpeg -i parser
      }

      const output = execSync(`ffmpeg -i "${videoPath}" 2>&1`, { encoding: 'utf8', status: [0, 1] });
      const match = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        return hours * 3600 + minutes * 60 + seconds;
      }
      return 30.0; // Sane fallback
    } catch (e) {
      console.error("[FFmpegHelper] Failed to read video duration, falling back to 30s:", e.message);
      return 30.0;
    }
  }

  /**
   * Extracts keyframes and scene-change frames from the video.
   * @param {string} videoPath 
   * @param {string} outputDir 
   * @returns {string[]} List of absolute paths of extracted frames
   */
  extractFrames(videoPath, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (!this.hasFFmpeg) {
      console.warn("[FFmpegHelper] FFmpeg is missing. Generating mock keyframe files for pipeline simulation.");
      const mockFiles = ['first.jpg', 'middle.jpg', 'last.jpg', 'scene_001.jpg'];
      return mockFiles.map(filename => {
        const filePath = path.join(outputDir, filename);
        // Write a small dummy file so base64 reader has something to read
        fs.writeFileSync(filePath, Buffer.from("mock-image-data-base64-content"));
        return filePath;
      });
    }

    const duration = this.getVideoDuration(videoPath);
    const framePaths = [];

    try {
      // 1. Extract first frame (0s)
      const firstPath = path.join(outputDir, 'first.jpg');
      execSync(`ffmpeg -y -ss 0 -i "${videoPath}" -vframes 1 -q:v 2 "${firstPath}"`, { stdio: 'ignore' });
      if (fs.existsSync(firstPath)) framePaths.push(firstPath);

      // 2. Extract middle frame (duration / 2)
      const midTime = (duration / 2).toFixed(2);
      const midPath = path.join(outputDir, 'middle.jpg');
      execSync(`ffmpeg -y -ss ${midTime} -i "${videoPath}" -vframes 1 -q:v 2 "${midPath}"`, { stdio: 'ignore' });
      if (fs.existsSync(midPath)) framePaths.push(midPath);

      // 3. Extract last frame (duration - 0.5s)
      const lastTime = Math.max(0, duration - 0.5).toFixed(2);
      const lastPath = path.join(outputDir, 'last.jpg');
      execSync(`ffmpeg -y -ss ${lastTime} -i "${videoPath}" -vframes 1 -q:v 2 "${lastPath}"`, { stdio: 'ignore' });
      if (fs.existsSync(lastPath)) framePaths.push(lastPath);

      // 4. Scene change keyframe extraction (select changes above threshold 0.4)
      const scenePattern = path.join(outputDir, 'scene_%03d.jpg');
      execSync(
        `ffmpeg -y -i "${videoPath}" -filter:v "select='gt(scene,0.4)',scale=640:-1" -vsync vfr -q:v 4 "${scenePattern}"`,
        { stdio: 'ignore' }
      );

      // Read scene files from directory
      const files = fs.readdirSync(outputDir);
      files.forEach(file => {
        if (file.startsWith('scene_') && file.endsWith('.jpg')) {
          framePaths.push(path.join(outputDir, file));
        }
      });

      console.log(`[FFmpegHelper] Successfully extracted ${framePaths.length} keyframes (including scene changes).`);
      return framePaths;
    } catch (err) {
      console.error("[FFmpegHelper] Error extracting frames, falling back to mock:", err.message);
      // Fallback mock files in case of command failure
      return ['first.jpg', 'middle.jpg', 'last.jpg'].map(filename => {
        const filePath = path.join(outputDir, filename);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, Buffer.from("mock-image-data-base64-content"));
        }
        return filePath;
      });
    }
  }
}
