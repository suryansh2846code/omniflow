import fs from 'fs';
import path from 'path';

export class DownloadManager {
  constructor(client, options = {}) {
    this.client = client;
    this.downloadTimeoutMs = options.downloadTimeoutMs || 60000; // 60 seconds
  }

  /**
   * Downloads a video from the browser context to the local filesystem.
   * Handles both blob: URLs and regular HTTP URLs by triggering a browser-native download.
   * 
   * @param {string} videoUrl - The source URL of the video (e.g. blob:https://...)
   * @param {string} outputDir - Directory to save the file
   * @param {string} filename - Desired filename (e.g. "clip_1_generated.mp4")
   * @returns {Promise<string>} Absolute path to the downloaded file
   */
  async downloadVideo(videoUrl, outputDir, filename) {
    const absoluteOutputDir = path.resolve(outputDir);
    
    if (!fs.existsSync(absoluteOutputDir)) {
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
    }

    const finalPath = path.join(absoluteOutputDir, filename);
    console.log(`[DownloadManager] Preparing to download ${videoUrl} to ${finalPath}`);

    // Clean up existing file if it exists to avoid confusion
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }

    // Create a unique temporary subdirectory for this download to avoid races/collisions
    const uniqueSubdirName = `download-${filename.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
    const uniqueSubdirPath = path.join(absoluteOutputDir, uniqueSubdirName);
    fs.mkdirSync(uniqueSubdirPath, { recursive: true });

    // Configure Chrome to silently download to our unique directory
    await this.client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: uniqueSubdirPath
    });

    let downloadGuid = null;
    let actualFilename = null;

    // Listen for download events to track completion
    const onDownloadWillBegin = (params) => {
      // params contains: { frameId, guid, url, suggestedFilename }
      downloadGuid = params.guid;
      actualFilename = params.suggestedFilename;
      console.log(`[DownloadManager] Download began. GUID: ${downloadGuid}, SuggestedFilename: ${actualFilename}`);
    };

    let downloadCompletePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Download timed out."));
      }, this.downloadTimeoutMs);

      const onDownloadProgress = (params) => {
        // params contains: { guid, totalBytes, receivedBytes, state }
        if (params.guid === downloadGuid && params.state === 'completed') {
          clearTimeout(timeout);
          resolve();
        } else if (params.guid === downloadGuid && params.state === 'canceled') {
          clearTimeout(timeout);
          reject(new Error("Download was canceled."));
        }
      };

      this.client.on('Page.downloadWillBegin', onDownloadWillBegin);
      this.client.on('Page.downloadProgress', onDownloadProgress);
      
      // Store timeout so we can clear it if JS fails early
      this._currentTimeout = timeout;
    });

    // Inject JS into the page to trigger the download programmatically
    await this.client.send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const url = "${videoUrl}";
            
            // Do NOT use fetch() because of CORS on usercontent.google.com URLs.
            // Just create an anchor element pointing to the URL and click it.
            // Chrome's Page.setDownloadBehavior will intercept it.
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = "${filename}";
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
              document.body.removeChild(a);
            }, 1000);
            
            return { success: true };
          } catch (err) {
            return { success: false, error: err.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    }).catch(err => {
      if (this._currentTimeout) clearTimeout(this._currentTimeout);
      throw err;
    }).then(result => {
      const resVal = result.result?.value;
      if (resVal && !resVal.success) {
        if (this._currentTimeout) clearTimeout(this._currentTimeout);
        throw new Error("JS Trigger Error: " + resVal.error);
      }
    });

    try {
      console.log(`[DownloadManager] Waiting for download to complete...`);
      await downloadCompletePromise;
      
      // Wait a tiny bit for the OS filesystem to catch up
      await new Promise(r => setTimeout(r, 1000));
      
      let downloadedFile = null;
      if (actualFilename) {
        const expectedChromePath = path.join(uniqueSubdirPath, actualFilename);
        if (fs.existsSync(expectedChromePath)) {
          downloadedFile = expectedChromePath;
        }
      }
      
      if (!downloadedFile) {
        // Fallback: Check if there's only one mp4 in the directory
        const files = fs.readdirSync(uniqueSubdirPath);
        
        // Let's try to find a file that starts with the base name
        const baseName = actualFilename ? path.parse(actualFilename).name : 'video';
        const matchingFiles = files.filter(f => f.startsWith(baseName) && f.endsWith('.mp4'));
        
        if (matchingFiles.length > 0) {
          // Rename the most recently created one
          const mostRecent = matchingFiles.map(f => {
            const p = path.join(uniqueSubdirPath, f);
            return { path: p, mtime: fs.statSync(p).mtime.getTime() };
          }).sort((a, b) => b.mtime - a.mtime)[0];
          
          downloadedFile = mostRecent.path;
        }
      }

      if (!downloadedFile || !fs.existsSync(downloadedFile)) {
        throw new Error("Download completed event fired, but file was not found in unique temp directory: " + uniqueSubdirPath);
      }
      
      // Move the file from unique temp directory to the final destination path
      fs.renameSync(downloadedFile, finalPath);
      
      console.log(`[DownloadManager] Download successfully saved to: ${finalPath}`);
      return finalPath;
    } finally {
       // Reset behavior to default
       await this.client.send('Page.setDownloadBehavior', {
         behavior: 'default'
       }).catch(() => {});
       
       // Clean up the unique temp directory
       if (fs.existsSync(uniqueSubdirPath)) {
         try {
           fs.rmSync(uniqueSubdirPath, { recursive: true, force: true });
         } catch (e) {
           console.error(`[DownloadManager] Error cleaning up temporary directory ${uniqueSubdirPath}:`, e.message);
         }
       }
       
       if (this._currentTimeout) {
         clearTimeout(this._currentTimeout);
       }
    }
  }
}
