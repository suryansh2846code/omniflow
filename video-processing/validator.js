import fs from 'fs';
import path from 'path';

export class VideoValidator {
  /**
   * Validates video file path and format.
   * @param {string} videoPath 
   * @returns {string} Absolute resolved path
   * @throws {Error} if video input is invalid
   */
  static validate(videoPath) {
    if (!videoPath) {
      throw new Error("Video path is required.");
    }

    const absolutePath = path.resolve(videoPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Video file does not exist at path: ${absolutePath}`);
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size === 0) {
      throw new Error(`Video file is empty (0 bytes) at path: ${absolutePath}`);
    }

    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(absolutePath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`Unsupported video format: "${ext}". Supported extensions: ${allowedExtensions.join(', ')}`);
    }

    return absolutePath;
  }
}
