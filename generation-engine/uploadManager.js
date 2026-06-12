import path from 'path';

let fileChooserMutex = Promise.resolve();

export class UploadManager {
  constructor(client, options = {}) {
    this.client = client;
    this.timeoutMs = options.uploadTimeoutMs || 30000; // 30 seconds default
  }

  /**
   * Uploads a video file to the tab using Page.setInterceptFileChooserDialog and DOM.setFileInputFiles.
   * @param {string} videoPath Absolute path to the video clip
   */
  async upload(videoPath) {
    const absolutePath = path.resolve(videoPath);
    console.log(`[UploadManager] Preparing upload for: ${absolutePath}`);

    // Acquire global mutex to prevent concurrent file chooser dialogs across tabs
    let releaseLock;
    const nextLock = new Promise(resolve => { releaseLock = resolve; });
    const prevLock = fileChooserMutex;
    
    // Ensure the mutex chain never stores a rejected promise
    fileChooserMutex = prevLock.then(() => nextLock, () => nextLock);
    
    try {
      await prevLock;
    } catch (e) {
      // Ignore errors from the previous lock holder
    }
    
    try {
      await this._triggerAndInject(absolutePath);
      // Wait a short moment to let Chrome complete the file chooser closing transition
      await new Promise(r => setTimeout(r, 1500));
    } finally {
      releaseLock();
    }

    console.log("[UploadManager] File injected. Monitoring upload completion...");

    // 6. Monitor completion
    const uploadCompleted = await this.waitForUploadCompletion();
    if (!uploadCompleted) {
      console.warn("[UploadManager] Upload completion monitoring timed out or didn't find clear confirmation, but file was injected.");
    } else {
      console.log("[UploadManager] Video clip uploaded successfully.");
    }
    
    return true;
  }

  async _triggerAndInject(absolutePath) {
    // 0. Bring page to front so mouse events work reliably
    await this.client.send('Page.bringToFront');
    await new Promise(r => setTimeout(r, 1000));

    // 1. Intercept file chooser
    await this.client.send('Page.enable');
    await this.client.send('DOM.enable');
    await this.client.send('Page.setInterceptFileChooserDialog', { enabled: true });

    let fileChooserBackendNodeId = null;

    // We can only have one listener that triggers.
    // If the client class has multiple event listeners, we might need to remove it later,
    // but for this simple script we can just use `on`.
    const onFileChooser = (params) => {
      console.log(`[UploadManager] File chooser opened. backendNodeId: ${params.backendNodeId}`);
      fileChooserBackendNodeId = params.backendNodeId;
    };
    this.client.on('Page.fileChooserOpened', onFileChooser);

    console.log("[UploadManager] Triggering upload menu...");

    // 2. Click the + button
    await this.client.send('Runtime.evaluate', {
      expression: `
        (() => {
          function deepQuerySelectorAll(sel, root = document) {
            const results = Array.from(root.querySelectorAll(sel));
            const elements = Array.from(root.querySelectorAll('*'));
            for (const el of elements) {
              if (el.shadowRoot) results.push(...deepQuerySelectorAll(sel, el.shadowRoot));
            }
            return results;
          }
          const plusSvg = document.querySelector('svg path[d*="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"]');
          if (plusSvg) {
              let cur = plusSvg;
              while(cur && cur.tagName !== 'BUTTON') cur = cur.parentNode;
              if (cur) cur.click();
          } else {
             // Fallback: finding any button labeled 'upload media' or similar if + isn't there
             const buttons = deepQuerySelectorAll('button');
             for (const b of buttons) {
                 const label = (b.getAttribute('aria-label') || '').toLowerCase();
                 if (label.includes('upload') || label.includes('image')) {
                     b.click();
                 }
             }
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1000));

    // 3. Trusted click on "Upload files" menu item
    const menuEval = await this.client.send('Runtime.evaluate', {
      expression: `
        (() => {
          function deepQuerySelectorAll(sel, root = document) {
            const results = Array.from(root.querySelectorAll(sel));
            const elements = Array.from(root.querySelectorAll('*'));
            for (const el of elements) {
              if (el.shadowRoot) results.push(...deepQuerySelectorAll(sel, el.shadowRoot));
            }
            return results;
          }
          const items = deepQuerySelectorAll('[role="menuitem"]');
          if (items.length > 0) {
              let target = items.find(i => {
                const text = (i.textContent || '').toLowerCase();
                return text.includes('create video') || text.includes('video');
              });
              if (!target) {
                target = items.find(i => (i.textContent || '').toLowerCase().includes('upload'));
              }
              if (!target) target = items[0];
              const rect = target.getBoundingClientRect();
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
          }
          return { found: false };
        })()
      `,
      returnByValue: true
    });

    const mRes = menuEval?.result?.value;
    if (mRes && mRes.found) {
       await this.client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: mRes.x, y: mRes.y });
       await this.client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: mRes.x, y: mRes.y });
    }

    // 4. Wait for file chooser
    const startTime = Date.now();
    while (!fileChooserBackendNodeId && Date.now() - startTime < 10000) {
      await new Promise(r => setTimeout(r, 200));
    }

    // Remove listener
    this.client.removeListener('Page.fileChooserOpened', onFileChooser);

    if (!fileChooserBackendNodeId) {
      await this.client.send('Page.setInterceptFileChooserDialog', { enabled: false });
      throw new Error("Timeout waiting for file chooser to open.");
    }

    console.log(`[UploadManager] Injecting file: ${absolutePath}`);

    // 5. Submit file using the official DOM.setFileInputFiles API
    await this.client.send('DOM.setFileInputFiles', {
      files: [absolutePath],
      backendNodeId: fileChooserBackendNodeId
    });
    
    await this.client.send('Page.setInterceptFileChooserDialog', { enabled: false });
  }

  async waitForUploadCompletion() {
    const start = Date.now();
    let uploadStarted = false;

    while (Date.now() - start < this.timeoutMs) {
      const state = await this.client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const progressSelectors = [
              'progress', 'mat-progress-bar', '[role="progressbar"]',
              '.progress', '.loading', '.shimmer', '.upload-progress',
              '[class*="upload"]', '[class*="progress"]', '[class*="loading"]'
            ];
            
            function deepQuerySelectorAll(sel, root = document) {
              const results = Array.from(root.querySelectorAll(sel));
              const elements = Array.from(root.querySelectorAll('*'));
              for (const el of elements) {
                if (el.shadowRoot) results.push(...deepQuerySelectorAll(sel, el.shadowRoot));
              }
              return results;
            }

            const hasProgress = deepQuerySelectorAll(progressSelectors.join(', ')).some(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
            });

            // Check for attachment chips/thumbnails/video tags
            const hasAttachment = deepQuerySelectorAll('video, [data-testid="file-chip"], .file-thumbnail, img[src^="blob:"]').length > 0;

            return { hasProgress, hasAttachment };
          })()
        `,
        returnByValue: true
      });

      const { hasProgress, hasAttachment } = state.result?.value || {};

      if (hasProgress) uploadStarted = true;

      // If we see attachment, it's done
      if (hasAttachment || (uploadStarted && !hasProgress)) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }
}
