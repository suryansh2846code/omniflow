import { execSync } from 'child_process';

export class VideoMetadataExtractor {
  constructor() {
    this.hasFFprobe = this.detectFFprobe();
    this.hasFFmpeg = this.detectFFmpeg();
  }

  detectFFprobe() {
    try {
      execSync('ffprobe -version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
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
   * Extract video metadata.
   * @param {string} videoPath 
   * @returns {Object} { duration, fps, codec, resolution }
   */
  extract(videoPath) {
    if (this.hasFFprobe) {
      try {
        // Get duration
        const durationOut = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
          { encoding: 'utf8' }
        );
        const duration = parseFloat(durationOut.trim());

        // Get video stream details
        const streamOut = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,r_frame_rate,width,height -of json "${videoPath}"`,
          { encoding: 'utf8' }
        );
        const streamData = JSON.parse(streamOut);
        const stream = streamData.streams?.[0] || {};

        const codec = stream.codec_name || 'unknown';
        const width = stream.width || 1920;
        const height = stream.height || 1080;
        const resolution = `${width}x${height}`;

        // Parse frame rate
        let fps = 30;
        if (stream.r_frame_rate) {
          const parts = stream.r_frame_rate.split('/');
          if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            if (den !== 0) fps = Math.round(num / den);
          } else {
            const parsed = parseFloat(stream.r_frame_rate);
            if (!isNaN(parsed)) fps = Math.round(parsed);
          }
        }

        return {
          duration: isNaN(duration) ? 10.0 : duration,
          fps,
          codec,
          resolution
        };
      } catch (err) {
        // Fallback to ffmpeg
      }
    }

    if (this.hasFFmpeg) {
      try {
        // Run info check command
        let output;
        try {
          output = execSync(`ffmpeg -i "${videoPath}" 2>&1`, { encoding: 'utf8' });
        } catch (execErr) {
          output = execErr.stdout || execErr.stderr || '';
        }
        
        let duration = 10.0;
        const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1], 10);
          const minutes = parseInt(durationMatch[2], 10);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        let codec = 'unknown';
        let resolution = '1920x1080';
        let fps = 30;

        const videoMatch = output.match(/Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_-]+).*?\s+(\d+x\d+)/);
        if (videoMatch) {
          codec = videoMatch[1];
          resolution = videoMatch[2];
        }

        const fpsMatch = output.match(/,\s*(\d+(\.\d+)?)\s*fps/);
        if (fpsMatch) {
          fps = Math.round(parseFloat(fpsMatch[1]));
        }

        return { duration, fps, codec, resolution };
      } catch (err) {
        // Fallback to mock
      }
    }

    console.warn("[VideoMetadataExtractor] Neither ffprobe nor ffmpeg is available. Returning mock metadata.");
    return {
      duration: 30.0,
      fps: 30,
      codec: 'h264',
      resolution: '1920x1080'
    };
  }
}
