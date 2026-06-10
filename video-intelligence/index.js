import { FFmpegHelper } from './ffmpegHelper.js';
import { GeminiVisionService } from './geminiVisionService.js';
import { DataTranslator } from './translator.js';
import fs from 'fs';
import path from 'path';

export class VideoIntelligenceLayer {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey]
   * @param {string} [config.modelName]
   */
  constructor(config = {}) {
    this.ffmpegHelper = new FFmpegHelper();
    this.geminiVisionService = new GeminiVisionService(config.apiKey, config.modelName);
  }

  /**
   * Translates a raw video file into a structured understanding object, and then
   * formats it to be directly consumed by Prompt Intelligence Engine v2.
   * 
   * @param {string} videoPath Path to video.mp4
   * @param {string} userPrompt Target prompt instruction (e.g. "make it cyberpunk")
   * @param {Object} [options] Configurations (tempDir, resolution, fps)
   * @returns {Promise<Object>}
   */
  async process(videoPath, userPrompt, options = {}) {
    const tempDir = options.tempDir || path.join(process.cwd(), 'video-intelligence-temp');
    
    try {
      // 1. Get duration and extract keyframe/scene-change frames
      console.log(`[VideoIntel] Accessing video duration and keyframes for: ${videoPath}`);
      const duration = this.ffmpegHelper.getVideoDuration(videoPath);
      const framePaths = this.ffmpegHelper.extractFrames(videoPath, tempDir);

      // 2. Query Gemini Vision model to compile visual metrics
      console.log(`[VideoIntel] Sending ${framePaths.length} keyframes to Gemini Vision model...`);
      let analysisResult;
      
      // If we are in dry-run/mock mode or API key is absent, use mock fallbacks
      if (this.geminiVisionService.apiKey === 'mock-key' || !this.geminiVisionService.apiKey) {
        console.warn("[VideoIntel] No active API key found or mock requested. Simulating Gemini vision response.");
        analysisResult = this.getMockAnalysis(duration);
      } else {
        analysisResult = await this.geminiVisionService.analyzeVideoFrames(framePaths, duration);
      }

      // 3. Translate output to Prompt Intelligence v2 schema
      console.log("[VideoIntel] Mapping analysis to Prompt Intelligence input format...");
      const promptEngineInput = DataTranslator.translate(analysisResult, userPrompt, {
        resolution: options.resolution,
        fps: options.fps
      });

      // Cleanup temporary frame files
      this.cleanup(framePaths, tempDir);

      return {
        videoUnderstanding: analysisResult,
        promptEngineInput
      };
    } catch (err) {
      console.error("[VideoIntel] Process pipeline error:", err.message);
      // Clean fallback if error happens midway
      const fallbackResult = this.getMockAnalysis(30.0);
      const promptEngineInput = DataTranslator.translate(fallbackResult, userPrompt, options);
      return {
        videoUnderstanding: fallbackResult,
        promptEngineInput,
        error: err.message
      };
    }
  }

  /**
   * Cleans up temporary extracted keyframe images.
   * @param {string[]} paths 
   * @param {string} tempDir 
   */
  cleanup(paths, tempDir) {
    try {
      paths.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      if (fs.existsSync(tempDir)) {
        const remaining = fs.readdirSync(tempDir);
        if (remaining.length === 0) {
          fs.rmdirSync(tempDir);
        }
      }
    } catch (err) {
      // Ignore cleanup warnings
    }
  }

  /**
   * Returns a visual analysis schema mock for dry-runs.
   * @param {number} duration 
   * @returns {Object}
   */
  getMockAnalysis(duration) {
    return {
      videoSummary: "A video of a young developer in a hoodie walking down a city sidewalk, talking directly to the camera and pointing out tech ads.",
      characterSheet: {
        identity: "Young developer/creator",
        clothing: "Grey cotton hoodie with blue denim jacket",
        face: "Short dark hair, light beard, speaking expression",
        accessories: "Smartwatch on wrist",
        bodyType: "Average build"
      },
      locations: ["City sidewalk", "Street corner"],
      objects: ["Smartphone", "Holographic ad boards"],
      cameraStyle: "Eye-level medium shot with organic handheld motion",
      sceneTimeline: [
        {
          start: 0,
          end: Math.round(duration * 0.33),
          summary: "The creator introduces the tech topic while walking down the sidewalk",
          characters: ["Young developer"],
          location: "City sidewalk"
        },
        {
          start: Math.round(duration * 0.33),
          end: Math.round(duration * 0.66),
          summary: "The creator highlights a digital ad board on the wall",
          characters: ["Young developer"],
          location: "Street corner"
        },
        {
          start: Math.round(duration * 0.66),
          end: duration,
          summary: "The creator looks back and walks away towards an alleyway",
          characters: ["Young developer"],
          location: "Narrow street"
        }
      ]
    };
  }
}
