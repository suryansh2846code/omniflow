export class GenerationMonitor {
  constructor(client, options = {}) {
    this.client = client;
    this.timeoutMs = options.generationTimeoutMs || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Clicks the send/generate message button on the Gemini page.
   */
  async clickGenerate() {
    console.log("[GenerationMonitor] Attempting to click Generate/Send button...");
    const result = await this.client.send('Runtime.evaluate', {
      expression: `
        (() => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function findEditor() {
            const slate = document.querySelector('[data-slate-editor="true"]');
            if (slate) return slate;
            const ariaTextbox = document.querySelector('[role="textbox"][contenteditable="true"]');
            if (ariaTextbox) return ariaTextbox;
            const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
            return editables.find(isVisible) || document.querySelector('textarea') || null;
          }

          function isButtonUsable(el) {
            if (!isVisible(el)) return false;
            if (el.disabled) return false;
            if (el.getAttribute('aria-disabled') === 'true') return false;
            return true;
          }

          function findGenerateButton(editor) {
            // 1. Search up from editor context
            let parent = editor ? editor.parentElement : null;
            let level = 1;
            while (parent && parent !== document.body && level <= 15) {
              const btn = parent.querySelector('button[aria-label="Send message"]');
              if (btn && isButtonUsable(btn)) return btn;
              parent = parent.parentElement;
              level++;
            }

            // 2. Search globally by standard label
            const globalBtn = document.querySelector('button[aria-label="Send message"]');
            if (globalBtn && isButtonUsable(globalBtn)) return globalBtn;

            // 3. Fallback: match any button that suggests send or generate
            const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).filter(isButtonUsable);
            const matches = allButtons.find(btn => {
              const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
              return text.includes('generate') || text.includes('send') || text.includes('submit') || text.includes('run');
            });

            return matches || allButtons[0] || null;
          }

          const editor = findEditor();
          const button = findGenerateButton(editor);
          if (!button) {
            return { success: false, error: 'Send button not found' };
          }

          button.focus();
          button.click();

          return { success: true };
        })()
      `,
      returnByValue: true
    });

    const resVal = result.result.value;
    if (!resVal || !resVal.success) {
      throw new Error(`Clicking Generate failed: ${resVal?.error || 'Button not found'}`);
    }

    console.log("[GenerationMonitor] Generate button clicked.");
    return true;
  }

  /**
   * Monitors the generation state until completion or timeout.
   */
  async monitor() {
    console.log("[GenerationMonitor] Starting monitoring loop...");
    const start = Date.now();
    let generationStarted = false;

    while (Date.now() - start < this.timeoutMs) {
      const state = await this.client.send('Runtime.evaluate', {
        expression: `
          (() => {
            function isVisible(el) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
              }
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }

            // Check for progress indicators or stop/cancel buttons
            const stopButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
              if (!isVisible(btn)) return false;
              const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
              return text.includes('stop') || text.includes('cancel');
            });

            const progressSelectors = [
              'progress', 'mat-progress-bar', '[role="progressbar"]',
              '.progress', '.loading', '.shimmer', '.generating', '.spinner',
              '[class*="loading"]', '[class*="generating"]', '[class*="progress"]'
            ];
            const hasProgress = Array.from(document.querySelectorAll(progressSelectors.join(', '))).some(isVisible);
            
            const bodyText = document.body.innerText || '';
            const geminiIndicators = [
              "Generating your video",
              "I'm generating your video",
              "This could take a few minutes",
              "Generating video...",
              "Creating video..."
            ];
            const hasGeneratingText = geminiIndicators.some(ind => bodyText.includes(ind));

            const generating = !!(stopButton || hasProgress || hasGeneratingText);

            // Check for completion
            const buttonTexts = ['play video', 'share video', 'download video'];
            const completionButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
              if (!isVisible(btn)) return false;
              const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
              return buttonTexts.some(bt => text.includes(bt));
            });

            const hasCompletedText = bodyText.includes('Your video is ready!');
            const completionIndicator = !!(completionButton || hasCompletedText);

            const videoEl = document.querySelector('video');
            const videoUrl = videoEl ? videoEl.src : null;
            const hasValidVideoUrl = videoUrl && (videoUrl.startsWith('blob:') || videoUrl.startsWith('http'));

            const completed = !!(completionIndicator && hasValidVideoUrl);

            return { generating, completed, videoUrl };
          })()
        `,
        returnByValue: true
      });

      const { generating, completed, videoUrl } = state.result.value || {};

      if (generating) {
        generationStarted = true;
      }

      if (completed) {
        console.log(`[GenerationMonitor] Generation completed successfully.`);
        return {
          generationStarted: true,
          generationCompleted: true,
          videoUrl
        };
      }

      // If we've waited 20 seconds and never saw generation start
      if (!generationStarted && (Date.now() - start > 20000)) {
        throw new Error("No video generation activity detected within 20 seconds.");
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Video generation timed out after ${Math.round(this.timeoutMs / 1000)} seconds.`);
  }
}
