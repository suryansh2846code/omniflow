import { TabManager } from './tabManager.js';
import { UploadManager } from './uploadManager.js';
import { PromptInjector } from './promptInjector.js';
import { GenerationMonitor } from './generationMonitor.js';
import { DownloadManager } from './downloadManager.js';

export class JobManager {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Runs a complete end-to-end generation job for a single clip.
   * @param {Object} jobConfig
   * @param {string} jobConfig.clipId
   * @param {string} jobConfig.videoPath
   * @param {string} jobConfig.prompt
   * @param {string} [jobConfig.geminiUrl="https://gemini.google.com"]
   * @param {string} [jobConfig.downloadOutputDir]
   */
  async runJob(jobConfig) {
    const { clipId, videoPath, prompt, geminiUrl = 'https://gemini.google.com', downloadOutputDir } = jobConfig;
    console.log(`[JobManager] Starting job for Clip: ${clipId}`);

    const tabManager = new TabManager(this.options);
    let tabId = null;
    let client = null;

    const status = {
      clipId,
      tabId: null,
      uploaded: false,
      promptInserted: false,
      generationStarted: false,
      generationCompleted: false
    };

    try {
      // 1. Open tab
      const tabInfo = await tabManager.openTab(geminiUrl);
      tabId = tabInfo.tabId;
      client = tabInfo.client;
      status.tabId = tabId;

      // Wait 2 seconds to ensure page initial JS runs
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. Upload video
      const uploadManager = new UploadManager(client, this.options);
      await uploadManager.upload(videoPath);
      status.uploaded = true;

      // 3. Inject prompt
      const promptInjector = new PromptInjector(client);
      await promptInjector.inject(prompt);
      status.promptInserted = true;

      // Short delay before submit click
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. Click Generate and monitor progress
      const monitor = new GenerationMonitor(client, this.options);
      await monitor.clickGenerate();
      status.generationStarted = true;

      const monitorResult = await monitor.monitor();
      status.generationCompleted = monitorResult.generationCompleted;
      status.videoUrl = monitorResult.videoUrl;

      if (status.generationCompleted && status.videoUrl && downloadOutputDir) {
        console.log(`[JobManager] Downloading generated video for ${clipId}...`);
        const downloadManager = new DownloadManager(client, this.options);
        const downloadedPath = await downloadManager.downloadVideo(
          status.videoUrl, 
          downloadOutputDir, 
          `${clipId}_generated.mp4`
        );
        status.downloadedPath = downloadedPath;
      }

      console.log(`[JobManager] Job completed successfully for Clip: ${clipId}`);
    } catch (err) {
      console.error(`[JobManager] Job failed for Clip ${clipId}:`, err.message);
      status.error = err.message;
    } finally {
      await tabManager.close();
    }

    return status;
  }
}
