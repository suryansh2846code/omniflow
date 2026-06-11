import { JobManager } from './jobManager.js';

export class GenerationEngine {
  constructor(options = {}) {
    this.jobManager = new JobManager(options);
  }

  /**
   * Run a single Gemini generation job end-to-end.
   * @param {Object} jobConfig
   * @param {string} jobConfig.clipId
   * @param {string} jobConfig.videoPath
   * @param {string} jobConfig.prompt
   * @param {string} [jobConfig.geminiUrl]
   * @returns {Promise<Object>} Status update JSON
   */
  async runJob(jobConfig) {
    return this.jobManager.runJob(jobConfig);
  }
}
