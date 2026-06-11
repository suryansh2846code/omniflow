// ─────────────────────────────────────────────────────────
// OmniFlow — content.js  (Phase 2.1)
// Handles three messages:
//   OMNIFLOW_SCAN     → Phase 0: DOM scan + candidate scoring
//   OMNIFLOW_INJECT   → Phase 1: Prompt injection into editor
//   OMNIFLOW_GENERATE → Phase 2: Inject prompt + click generate button
// ─────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Duplicate-listener guard ─────────────────────────────
  if (window.__omniflowListenerRegistered) {
    console.log('[OmniFlow][Content] Listener already registered — skipping re-attach.');
    return;
  }
  window.__omniflowListenerRegistered = true;

  // Global state object for Phase 3/3.1 generation tracking
  window.__omniflowGenState = window.__omniflowGenState || {
    status: 'waiting',
    startTime: null,
    endTime: null,
    checkIntervalId: null,
    logs: [],
    promptAccepted: false,
    generationStarted: false,
    generationCompleted: false
  };

  // Global generate lock to prevent concurrent generate operations
  window.__omniflowGenerateInProgress = window.__omniflowGenerateInProgress || false;

  function generateLog(msg, type = 'info') {
    console.log(`[OmniFlow][Generate] ${msg}`);
    if (window.__omniflowGenState && window.__omniflowGenState.logs) {
      window.__omniflowGenState.logs.push({ text: `[Generate] ${msg}`, type });
    }
  }

  console.log('[OmniFlow][Content] Content script initialised (Phase 3).');

  // ════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ════════════════════════════════════════════════════════

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isLarge(el) {
    const rect = el.getBoundingClientRect();
    return (rect.height > 60) || (rect.width > 200 && el.tagName === 'TEXTAREA');
  }

  function collectElementInfo(el) {
    return {
      tagName:         el.tagName.toLowerCase(),
      id:              el.id || '',
      className:       el.className || '',
      placeholder:     el.getAttribute('placeholder') || '',
      ariaLabel:       el.getAttribute('aria-label') || '',
      type:            el.getAttribute('type') || '',
      contenteditable: el.getAttribute('contenteditable') === 'true',
      visible:         isVisible(el),
      large:           isLarge(el),
    };
  }

  /**
   * Check if the page is currently generating a video (Phase 3).
   * Scans for loading states, progress bars, and stop/cancel indicators.
   *
   * @returns {{ generating: boolean, rule: string }}
   */
  function isPageGenerating() {
    // 1. Check for visible stop/cancel buttons
    const stopButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
      if (!isVisible(btn)) return false;
      const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      return text.includes('stop') || text.includes('cancel');
    });
    if (stopButton) {
      return { generating: true, rule: 'stop_button' };
    }

    // 2. Check for active progress bar or loading indicators
    const progressSelectors = [
      'progress', 'mat-progress-bar', '[role="progressbar"]',
      '.progress', '.loading', '.shimmer', '.generating', '.spinner',
      '[class*="loading"]', '[class*="generating"]', '[class*="progress"]'
    ];
    const progressIndicators = Array.from(
      document.querySelectorAll(progressSelectors.join(', '))
    ).filter(isVisible);

    if (progressIndicators.length > 0) {
      return { generating: true, rule: 'progress_indicator' };
    }

    // 3. Check for specific text indicators in page content
    const bodyText = document.body.innerText || '';
    
    // Gemini-specific text indicators
    const geminiIndicators = [
      "Generating your video",
      "I'm generating your video",
      "This could take a few minutes"
    ];
    
    for (const indicator of geminiIndicators) {
      if (bodyText.includes(indicator)) {
        return { generating: true, rule: `gemini_text:${indicator}` };
      }
    }

    if (bodyText.includes('Generating video...') || bodyText.includes('Creating video...')) {
      return { generating: true, rule: 'general_text' };
    }

    return { generating: false, rule: 'none' };
  }

  /**
   * Check if video generation has completed (Phase 4).
   * @returns {boolean}
   */
  function isGenerationCompleted() {
    // 1. Check for Play, Share, or Download buttons
    const buttonTexts = ['play video', 'share video', 'download video'];
    const completionButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
      if (!isVisible(btn)) return false;
      const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      return buttonTexts.some(bt => text.includes(bt));
    });
    if (completionButton) {
      console.log(`[OmniFlow][Monitor] Video ready detected via button: "${completionButton.textContent.trim()}"`);
      return true;
    }

    // 2. Check for "Your video is ready!" text on the page
    const bodyText = document.body.innerText || '';
    if (bodyText.includes('Your video is ready!')) {
      console.log('[OmniFlow][Monitor] Video ready detected via page text: "Your video is ready!"');
      return true;
    }

    return false;
  }

  /**
   * Helper to log DOM details before event execution.
   */
  function logClickDiagnostics(button) {
    if (!button) return;
    const activeBefore = document.activeElement;
    const activeText = activeBefore ? `<${activeBefore.tagName.toLowerCase()}> id="${activeBefore.id}" class="${activeBefore.className}"` : 'none';
    
    const diagLogs = [
      'Click Diagnostics:',
      `  activeElement: ${activeText}`,
      `  button.disabled: ${button.disabled}`,
      `  aria-disabled: ${button.getAttribute('aria-disabled')}`,
      `  button type: ${button.getAttribute('type') || 'none'}`,
      `  button role: ${button.getAttribute('role') || 'none'}`
    ];
    
    // Dispatch test click to check returnValue
    try {
      const clickEv = new MouseEvent('click', { bubbles: true, cancelable: true });
      const dispatched = button.dispatchEvent(clickEv);
      diagLogs.push(`  test click dispatch result: ${dispatched} (preventDefault: ${clickEv.defaultPrevented})`);
    } catch (e) {
      diagLogs.push(`  test click dispatch error: ${e.message}`);
    }

    diagLogs.forEach(line => {
      console.log(`[OmniFlow][Diag] ${line}`);
      if (window.__omniflowGenState && window.__omniflowGenState.logs) {
        window.__omniflowGenState.logs.push({ text: `[Diag] ${line}`, type: 'info' });
      }
    });
  }

  /**
   * Starts monitoring the video generation progress (Phase 4.1).
   * Strictly reads DOM state, does not simulate clicks/triggers.
   * @param {Element} button
   * @param {Element} editor
   */
  function startGenerationMonitoring(button, editor) {
    console.log('[OmniFlow][Monitor] Generation started');
    
    // Clear any existing monitor
    if (window.__omniflowGenState.checkIntervalId) {
      clearInterval(window.__omniflowGenState.checkIntervalId);
    }

    // Preserve existing logs and promptAccepted status if present
    window.__omniflowGenState = {
      status: 'waiting',
      startTime: Date.now(),
      endTime: null,
      checkIntervalId: null,
      logs: window.__omniflowGenState.logs || [],
      promptAccepted: window.__omniflowGenState.promptAccepted || false,
      generationStarted: false,
      generationCompleted: false
    };

    window.__omniflowGenState.checkIntervalId = setInterval(() => {
      const elapsed = (Date.now() - window.__omniflowGenState.startTime) / 1000;
      const genInfo = isPageGenerating();
      const currentlyGenerating = genInfo.generating;
      const currentlyCompleted = isGenerationCompleted();

      console.log(
        `[OmniFlow][Monitor] Generation status: ${window.__omniflowGenState.status}, ` +
        `currentlyGenerating: ${currentlyGenerating}, currentlyCompleted: ${currentlyCompleted}, ` +
        `elapsed: ${elapsed.toFixed(1)}s`
      );

      if (window.__omniflowGenState.status === 'waiting') {
        if (currentlyCompleted) {
          window.__omniflowGenState.status = 'completed';
          window.__omniflowGenState.generationStarted = true;
          window.__omniflowGenState.promptAccepted = true;
          window.__omniflowGenState.generationCompleted = true;
          window.__omniflowGenState.endTime = Date.now();
          
          console.log('[OmniFlow][Monitor] Video ready detected');
          console.log('[OmniFlow][Monitor] Generation completed');
          if (window.__omniflowGenState.logs) {
            window.__omniflowGenState.logs.push({ text: '[Monitor] Video ready detected', type: 'ok' });
            window.__omniflowGenState.logs.push({ text: '[Monitor] Generation completed', type: 'ok' });
          }
          
          // Release generate lock
          window.__omniflowGenerateInProgress = false;
          generateLog('Generate lock released', 'ok');
          
          clearInterval(window.__omniflowGenState.checkIntervalId);
          window.__omniflowGenState.checkIntervalId = null;
        } else if (currentlyGenerating) {
          window.__omniflowGenState.status = 'generating';
          window.__omniflowGenState.generationStarted = true;
          window.__omniflowGenState.promptAccepted = true;
          
          if (genInfo.rule.startsWith('gemini_text:')) {
            console.log('[OmniFlow][Monitor] Gemini text generation indicator detected');
            if (window.__omniflowGenState.logs) {
              window.__omniflowGenState.logs.push({ text: '[Monitor] Gemini text generation indicator detected', type: 'info' });
            }
          }
          
          console.log('[OmniFlow][Monitor] Generation started');
          if (window.__omniflowGenState.logs) {
            window.__omniflowGenState.logs.push({ text: '[Monitor] Generation started', type: 'ok' });
          }
        } else {
          // If no generation indicators appear within 15 seconds
          if (elapsed > 15) {
            window.__omniflowGenState.status = 'no_gen_detected';
            window.__omniflowGenState.endTime = Date.now();
            console.warn('[OmniFlow][Monitor] Generation aborted: No generation detected within 15 seconds.');
            if (window.__omniflowGenState.logs) {
              window.__omniflowGenState.logs.push({ text: '[Monitor] Generation aborted: No generation detected within 15 seconds.', type: 'warn' });
            }
            
            // Release generate lock
            window.__omniflowGenerateInProgress = false;
            generateLog('Generate lock released', 'warn');
            
            clearInterval(window.__omniflowGenState.checkIntervalId);
            window.__omniflowGenState.checkIntervalId = null;
          }
        }
      } else if (window.__omniflowGenState.status === 'generating') {
        if (currentlyCompleted) {
          window.__omniflowGenState.status = 'completed';
          window.__omniflowGenState.generationCompleted = true;
          window.__omniflowGenState.endTime = Date.now();
          
          console.log('[OmniFlow][Monitor] Video ready detected');
          console.log('[OmniFlow][Monitor] Generation completed');
          if (window.__omniflowGenState.logs) {
            window.__omniflowGenState.logs.push({ text: '[Monitor] Video ready detected', type: 'ok' });
            window.__omniflowGenState.logs.push({ text: '[Monitor] Generation completed', type: 'ok' });
            window.__omniflowGenState.logs.push({ text: `[Monitor] Total time: ${elapsed.toFixed(1)}s`, type: 'info' });
          }
          
          // Release generate lock
          window.__omniflowGenerateInProgress = false;
          generateLog('Generate lock released', 'ok');
          
          clearInterval(window.__omniflowGenState.checkIntervalId);
          window.__omniflowGenState.checkIntervalId = null;
        } else if (currentlyGenerating) {
          // Maximum monitoring time: 5 minutes (300 seconds)
          if (elapsed > 300) {
            window.__omniflowGenState.status = 'timeout';
            window.__omniflowGenState.endTime = Date.now();
            console.error('[OmniFlow][Monitor] Generation aborted: Timed out after 5 minutes.');
            if (window.__omniflowGenState.logs) {
              window.__omniflowGenState.logs.push({ text: '[Monitor] Generation aborted: Timed out after 5 minutes.', type: 'error' });
            }
            
            // Release generate lock
            window.__omniflowGenerateInProgress = false;
            generateLog('Generate lock released', 'error');
            
            clearInterval(window.__omniflowGenState.checkIntervalId);
            window.__omniflowGenState.checkIntervalId = null;
          }
        } else {
          // Indicators disappeared, assume completion
          window.__omniflowGenState.status = 'completed';
          window.__omniflowGenState.generationCompleted = true;
          window.__omniflowGenState.endTime = Date.now();
          console.log('[OmniFlow][Monitor] Generation completed');
          if (window.__omniflowGenState.logs) {
            window.__omniflowGenState.logs.push({ text: '[Monitor] Generation completed', type: 'ok' });
            window.__omniflowGenState.logs.push({ text: `[Monitor] Total time: ${elapsed.toFixed(1)}s`, type: 'info' });
          }
          
          // Release generate lock
          window.__omniflowGenerateInProgress = false;
          generateLog('Generate lock released', 'ok');
          
          clearInterval(window.__omniflowGenState.checkIntervalId);
          window.__omniflowGenState.checkIntervalId = null;
        }
      }
    }, 1000);
  }

  // ════════════════════════════════════════════════════════
  //  PHASE 0 — DOM SCANNER
  // ════════════════════════════════════════════════════════

  const PROMPT_KEYWORDS = [
    'prompt', 'message', 'input', 'chat', 'query', 'ask',
    'describe', 'type here', 'enter', 'write', 'text',
  ];

  function scoreElement(info) {
    let score = 0;
    const signals = {};

    if (info.visible) { score += 20; signals.visible = true; }
    else { signals.visible = false; score -= 5; }

    if (info.contenteditable) { score += 30; signals.contenteditable = true; }
    else { signals.contenteditable = false; }

    if (info.placeholder) {
      score += 15; signals.hasPlaceholder = true;
      if (PROMPT_KEYWORDS.some(kw => info.placeholder.toLowerCase().includes(kw))) score += 15;
    } else { signals.hasPlaceholder = false; }

    if (info.ariaLabel) {
      score += 10; signals.hasAriaLabel = true;
      if (PROMPT_KEYWORDS.some(kw => info.ariaLabel.toLowerCase().includes(kw))) score += 10;
    } else { signals.hasAriaLabel = false; }

    if (info.tagName === 'textarea') score += 20;
    if (info.tagName === 'input' && (!info.type || info.type === 'text' || info.type === 'search')) score += 10;

    if (info.large) { score += 10; signals.large = true; }
    else { signals.large = false; }

    const idClass = `${info.id} ${info.className}`.toLowerCase();
    if (PROMPT_KEYWORDS.some(kw => idClass.includes(kw))) score += 10;

    return { score: Math.max(0, Math.min(100, score)), signals };
  }

  function scanPage() {
    console.log('[OmniFlow][Content] Beginning DOM scan…');
    const rawElements = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
    console.log(`[OmniFlow][Content] Raw elements found: ${rawElements.length}`);

    const results = rawElements.map((el, i) => {
      const info = collectElementInfo(el);
      const { score, signals } = scoreElement(info);
      console.log(`[OmniFlow][Content] Element #${i + 1}: <${info.tagName}> id="${info.id}" score=${score}`);
      return { ...info, score, signals };
    });

    results.sort((a, b) => b.score - a.score);
    console.log(`[OmniFlow][Content] Scan complete. Candidates: ${results.length}`);
    return results;
  }

  // ════════════════════════════════════════════════════════
  //  PHASE 1 — PROMPT INJECTION
  // ════════════════════════════════════════════════════════

  /**
   * Find the best prompt editor on the page.
   * Priority: Slate → ARIA textbox → visible contenteditable → visible textarea
   * @returns {Element|null}
   */
  function findEditor() {
    console.log('[OmniFlow][Content] Locating editor…');

    const slate = document.querySelector('[data-slate-editor="true"]');
    if (slate) {
      console.log('[OmniFlow][Content] Editor found via data-slate-editor.');
      return slate;
    }

    const ariaTextbox = document.querySelector('[role="textbox"][contenteditable="true"]');
    if (ariaTextbox) {
      console.log('[OmniFlow][Content] Editor found via role=textbox+contenteditable.');
      return ariaTextbox;
    }

    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const visibleEditable = editables.find(isVisible);
    if (visibleEditable) {
      console.log('[OmniFlow][Content] Editor found via visible contenteditable.');
      return visibleEditable;
    }

    const textareas = Array.from(document.querySelectorAll('textarea'));
    const visibleTextarea = textareas.find(isVisible);
    if (visibleTextarea) {
      console.log('[OmniFlow][Content] Editor found via visible textarea.');
      return visibleTextarea;
    }

    console.warn('[OmniFlow][Content] No editor found.');
    return null;
  }

  function readEditorText(editor) {
    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
      return editor.value;
    }
    return editor.innerText || editor.textContent || '';
  }

  function fireKeyEvent(el, type, init = {}) {
    el.dispatchEvent(new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      ...init,
    }));
  }

  function injectIntoContentEditable(editor, text) {
    editor.focus();
    fireKeyEvent(editor, 'keydown', { key: 'a', ctrlKey: true, metaKey: true });
    document.execCommand('selectAll');

    const execResult = document.execCommand('insertText', false, text);
    console.log(`[OmniFlow][Content] execCommand('insertText') result: ${execResult}`);
    if (execResult) return true;

    console.log('[OmniFlow][Content] execCommand failed — trying paste event strategy.');
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData: dt,
      });
      editor.textContent = '';
      editor.dispatchEvent(pasteEvent);
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: text,
      }));
    } catch (e) {
      console.warn('[OmniFlow][Content] Paste strategy error:', e);
    }

    console.log('[OmniFlow][Content] Trying direct innerText assignment strategy.');
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.innerText = text;
      editor.focus();
      fireKeyEvent(editor, 'keydown', { key: 'Process', bubbles: true });
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: text,
      }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      fireKeyEvent(editor, 'keyup', { key: 'Process', bubbles: true });
    } catch (e) {
      console.warn('[OmniFlow][Content] Direct assignment strategy error:', e);
    }

    return false;
  }

  function injectIntoTextarea(editor, text) {
    editor.focus();
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputSetter) {
      nativeInputSetter.call(editor, text);
    } else {
      editor.value = text;
    }
    editor.dispatchEvent(new Event('input',  { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[OmniFlow][Content] textarea/input value set via nativeSetter.');
  }

  function performInjection(text) {
    console.log(`[OmniFlow][Content] Starting injection. Text: "${text}"`);

    const editor = findEditor();
    if (!editor) {
      return { success: false, text: '', error: 'Editor not found. Make sure you are on a Flow/Omni editor page.' };
    }
    console.log('[OmniFlow][Content] Editor found ✓');

    try {
      editor.focus();
      console.log('[OmniFlow][Content] Editor focused ✓');
    } catch (e) {
      return { success: false, text: '', error: `Focus failed: ${e.message}` };
    }

    try {
      const isContentEditable =
        editor.getAttribute('contenteditable') === 'true' || editor.isContentEditable;
      if (isContentEditable) {
        console.log('[OmniFlow][Content] Using contenteditable injection path.');
        injectIntoContentEditable(editor, text);
      } else {
        console.log('[OmniFlow][Content] Using textarea/input injection path.');
        injectIntoTextarea(editor, text);
      }
      console.log('[OmniFlow][Content] Text injected ✓');
    } catch (e) {
      return { success: false, text: '', error: `Injection failed: ${e.message}` };
    }

    const detected = readEditorText(editor).trim();
    console.log(`[OmniFlow][Content] Verification — detected text: "${detected}"`);

    if (detected === text.trim()) {
      console.log('[OmniFlow][Content] Verification PASSED ✓');
    } else {
      console.warn(
        `[OmniFlow][Content] Text mismatch: expected "${text}" got "${detected}". ` +
        'This may be normal for async frameworks — check the editor visually.'
      );
    }

    return { success: true, text: detected || text };
  }

  // ════════════════════════════════════════════════════════
  //  PHASE 2.1 — GENERATE BUTTON DETECTION & CLICK
  //  Scope: composer container only. Never scans the global page.
  // ════════════════════════════════════════════════════════

  /**
   * Check if a button-like element is visible and not disabled.
   * @param {Element} el
   * @returns {boolean}
   */
  function isButtonUsable(el) {
    if (!isVisible(el)) return false;
    if (el.disabled) return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;
    return true;
  }

  /**
   * Walk upward through multiple ancestors from the Slate editor.
   * Inspects each ancestor, counts usable buttons, and returns
   * the largest ancestor representing the prompt composer region.
   *
   * @param {Element} editor
   * @returns {Element|null}
   */
  function discoverComposerContainer(editor) {
    if (!editor) return null;

    const ancestors = [];
    let ancestor = editor.parentElement;
    let level = 1;

    console.log('[OmniFlow][Inspect] Editor found');

    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement && level <= 15) {
      const buttons = Array.from(
        ancestor.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
      ).filter(isButtonUsable);

      const rect = ancestor.getBoundingClientRect();
      console.log(`[OmniFlow][Inspect] Ancestor level ${level} -> ${buttons.length} buttons`);

      ancestors.push({
        element: ancestor,
        level,
        buttons,
        rect
      });

      ancestor = ancestor.parentElement;
      level++;
    }

    // Largest ancestor representing prompt composer region
    // Constraint: height <= 350px or 45% of viewport
    const maxH = Math.max(350, window.innerHeight * 0.45);
    const candidates = ancestors.filter(ans => {
      return ans.buttons.length > 0 && ans.rect.height <= maxH;
    });

    let chosen = null;
    if (candidates.length > 0) {
      // Sort descending by level (highest ancestor first)
      candidates.sort((a, b) => b.level - a.level);
      chosen = candidates[0];
    } else if (ancestors.length > 0) {
      // Fallback: first ancestor with buttons
      chosen = ancestors.find(ans => ans.buttons.length > 0) || null;
    }

    if (chosen) {
      console.log('[OmniFlow][Inspect] Composer selected');
    }

    return chosen ? chosen.element : null;
  }

  /**
   * Scans the editor's composer area and lists all buttons inside it.
   * Does not click anything.
   *
   * @returns {Object} inspect result
   */
  function performInspectComposer() {
    const editor = findEditor();
    if (!editor) {
      return { success: false, error: 'Editor not found. Make sure you are on a Flow/Omni editor page.' };
    }

    const composerContainer = discoverComposerContainer(editor);
    if (!composerContainer) {
      return { success: false, editorFound: true, error: 'Composer container not found.' };
    }

    // Collect ALL buttons inside composer container (no filter!)
    const allButtons = Array.from(
      composerContainer.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
    );

    const buttons = allButtons.map((btn, i) => {
      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
      const rect = btn.getBoundingClientRect();
      const btnInfo = {
        index: i + 1,
        text: text || '(no text)',
        ariaLabel: btn.getAttribute('aria-label') || '',
        role: btn.getAttribute('role') || '',
        disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom)
      };

      console.log(`[OmniFlow][Inspect] Button #${btnInfo.index}`);
      console.log(`text="${btnInfo.text}"`);

      return btnInfo;
    });

    return {
      success: true,
      editorFound: true,
      composerFound: true,
      buttonsCount: buttons.length,
      buttons
    };
  }

  /**
   * Future Strategy #1 Button filtering logic (prepared for Phase 3/future activation).
   * It only allows specific keywords and explicitly rejects utility/mode buttons.
   *
   * @param {Element[]} buttons
   * @returns {Element[]}
   */
  function futureStrategyButtonFilter(buttons) {
    const ALLOWED = ['arrow_forward', 'generate', 'submit', 'send'];
    const REJECTED = ['create', 'agent', 'video', 'settings', 'more'];

    return buttons.filter(btn => {
      const text = (
        btn.textContent || btn.value || btn.getAttribute('aria-label') || ''
      ).trim().toLowerCase();

      const isAllowed = ALLOWED.some(label => text.includes(label));
      const isRejected = REJECTED.some(label => text.includes(label));

      return isAllowed && !isRejected;
    });
  }

  /**
   * Find the generate button using the new composer discovery logic.
   *
   * @returns {{ button: Element|null, strategy: string, buttonText: string }}
   */
  function findGenerateButton() {
    console.log('[OmniFlow][Generate] Searching for generate button inside composer…');

    const editor = findEditor();
    if (!editor) {
      console.warn('[OmniFlow][Generate] Cannot find generate button — editor not found.');
      return { button: null, strategy: 'none', buttonText: '' };
    }

    const composerContainer = discoverComposerContainer(editor);
    if (!composerContainer) {
      console.warn('[OmniFlow][Generate] No composer container found.');
      return { button: null, strategy: 'none', buttonText: '' };
    }

    console.log(
      `[OmniFlow][Generate] Composer container: <${composerContainer.tagName.toLowerCase()}> ` +
      `class="${composerContainer.className}"`
    );

    // Collect all usable buttons inside composer
    const composerButtons = Array.from(
      composerContainer.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
    ).filter(isButtonUsable);

    console.log(`[OmniFlow][Generate] ${composerButtons.length} usable button(s) inside composer:`);
    composerButtons.forEach((btn, i) => {
      const txt  = btn.textContent.trim() || btn.getAttribute('aria-label') || btn.getAttribute('type') || '(no text)';
      const rect = btn.getBoundingClientRect();
      const tag  = btn.tagName.toLowerCase();
      const role = btn.getAttribute('role') || '';
      console.log(
        `[OmniFlow][Generate]   [${i + 1}] <${tag}>${role ? ` role="${role}"` : ''} ` +
        `text="${txt}" left=${Math.round(rect.left)} right=${Math.round(rect.right)}`
      );
    });

    // Prefer keyword-matching button (rightmost)
    const GENERATE_LABELS = [
      'arrow_forward', 'generate', 'create', 'submit', 'run', 'send', 'go',
    ];

    const keywordButtons = composerButtons.filter(btn => {
      const text = (
        btn.textContent || btn.value || btn.getAttribute('aria-label') || ''
      ).trim().toLowerCase();
      return GENERATE_LABELS.some(label => text.includes(label));
    });

    if (keywordButtons.length > 0) {
      keywordButtons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      const btn         = keywordButtons[0];
      const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || 'button';
      console.log(`[OmniFlow][Generate] Strategy: keyword_rightmost — chose "${displayText}"`);
      return { button: btn, strategy: 'keyword_rightmost', buttonText: displayText };
    }

    // Fallback — rightmost button inside composer
    composerButtons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    const btn         = composerButtons[0];
    const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || 'button';
    console.log(`[OmniFlow][Generate] Strategy: container_rightmost — chose "${displayText}"`);
    return { button: btn, strategy: 'container_rightmost', buttonText: displayText };
  }

  /**
   * Full Phase 2 automation:
   *   1. Find editor
   *   2. Inject prompt text
   *   3. Find generate button (composer-scoped)
   *   4. Click it
   *   5. Return structured result
   *
   * @returns {Object} result object matching the OMNIFLOW_GENERATE spec
   */
  async function performGenerate() {
    // ── Check global generate lock ─────────────────────────
    if (window.__omniflowGenerateInProgress) {
      generateLog('Ignoring duplicate generate request', 'warn');
      return {
        success: false,
        error: 'Duplicate generate request ignored. Active generation is in progress.',
        timestamp: Date.now()
      };
    }

    // Acquire lock
    window.__omniflowGenerateInProgress = true;
    generateLog('Generate lock acquired', 'ok');

    const INJECT_TEXT = 'Create a 5-second cinematic video of a red sports car driving through a futuristic neon-lit city at night, realistic lighting, smooth camera movement, high quality.';

    const result = {
      success:        false,
      editorFound:    false,
      promptInjected: false,
      buttonFound:    false,
      buttonClicked:  false,
      promptAccepted: false,
      clickStrategy:  '',
      buttonText:     '',
      timestamp:      Date.now(),
    };

    // ── Step 1: Find editor ───────────────────────────────
    console.log('[OmniFlow][Generate] Locating editor…');
    const editor = findEditor();
    if (!editor) {
      result.error = 'Editor not found. Make sure you are on a Flow/Omni editor page.';
      console.warn('[OmniFlow][Generate] Editor not found.');
      window.__omniflowGenerateInProgress = false;
      generateLog('Generate lock released', 'warn');
      return result;
    }
    result.editorFound = true;
    console.log('[OmniFlow][Generate] Editor found ✓');

    // ── Step 2: Inject prompt ─────────────────────────────
    console.log('[OmniFlow][Generate] Injecting prompt…');
    try {
      const isContentEditable =
        editor.getAttribute('contenteditable') === 'true' || editor.isContentEditable;

      if (isContentEditable) {
        injectIntoContentEditable(editor, INJECT_TEXT);
      } else {
        injectIntoTextarea(editor, INJECT_TEXT);
      }

      // Verification check: verify prompt was actually injected
      const detected = readEditorText(editor).trim().toLowerCase();
      const expected = INJECT_TEXT.trim().toLowerCase();
      if (!detected.includes(expected.substring(0, 40))) {
        result.error = 'Prompt verification failed: expected prompt text not found in editor DOM.';
        console.warn(`[OmniFlow][Generate] Verification failed. Expected: "${INJECT_TEXT}" Detected: "${detected}"`);
        window.__omniflowGenerateInProgress = false;
        generateLog('Generate lock released', 'warn');
        return result;
      }

      result.promptInjected = true;
      generateLog('Prompt injected', 'ok');
    } catch (e) {
      result.error = `Prompt injection failed: ${e.message}`;
      console.error('[OmniFlow][Generate] Injection error:', e);
      window.__omniflowGenerateInProgress = false;
      generateLog('Generate lock released', 'error');
      return result;
    }

    // ── Step 3: Wait 500ms ────────────────────────────────
    await new Promise(resolve => setTimeout(resolve, 500));

    // ── Step 4: Locate button[aria-label="Send message"] ──
    console.log('[OmniFlow][Generate] Searching generate button [aria-label="Send message"]…');
    
    // First query within composer container
    const composerContainer = discoverComposerContainer(editor);
    let button = null;
    if (composerContainer) {
      button = composerContainer.querySelector('button[aria-label="Send message"]');
    }
    
    // Fallback: global query
    if (!button) {
      button = document.querySelector('button[aria-label="Send message"]');
    }
    
    // Second fallback: findGenerateButton scorer logic
    if (!button) {
      const fb = findGenerateButton();
      button = fb.button;
      result.clickStrategy = fb.strategy;
      result.buttonText = fb.buttonText;
    } else {
      result.clickStrategy = 'aria_label_send';
      result.buttonText = button.textContent.trim() || button.getAttribute('aria-label') || 'Send message';
    }

    if (!button) {
      result.error = 'Send button not found.';
      window.__omniflowGenerateInProgress = false;
      generateLog('Generate lock released', 'warn');
      return result;
    }
    result.buttonFound = true;
    console.log('[OmniFlow][Generate] Send button found');
    if (window.__omniflowGenState && window.__omniflowGenState.logs) {
      window.__omniflowGenState.logs.push({ text: '[Generate] Send button found', type: 'info' });
    }

    // ── Step 5: Before click log ──────────────────────────
    const activeBefore = document.activeElement;
    const activeText = activeBefore ? `<${activeBefore.tagName.toLowerCase()}> id="${activeBefore.id}" class="${activeBefore.className}"` : 'none';
    const rect = button.getBoundingClientRect();
    
    const clickDiagLogs = [
      `Send button text: "${result.buttonText}"`,
      `aria-label: "${button.getAttribute('aria-label') || 'none'}"`,
      `disabled state: ${button.disabled}`,
      `bounding box: left=${Math.round(rect.left)} right=${Math.round(rect.right)} top=${Math.round(rect.top)} bottom=${Math.round(rect.bottom)}`,
      `activeElement: ${activeText}`
    ];
    
    clickDiagLogs.forEach(line => {
      console.log(`[OmniFlow][Generate] ${line}`);
      if (window.__omniflowGenState && window.__omniflowGenState.logs) {
        window.__omniflowGenState.logs.push({ text: `[Diag] ${line}`, type: 'info' });
      }
    });

    // Helper to evaluate acceptance
    function checkAcceptance() {
      const textRemaining = readEditorText(editor).trim();
      const isDisappeared = textRemaining.length === 0;
      const isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
      const genInfo = isPageGenerating();
      const isGenerating = genInfo.generating;
      
      console.log(
        `[OmniFlow][Generate] Acceptance check: ` +
        `textRemainingLength=${textRemaining.length}, isButtonDisabled=${isDisabled}, currentlyGenerating=${isGenerating}`
      );
      
      return isDisappeared || isDisabled || isGenerating;
    }

    // ── Step 6: Execute click sequence ────────────────────
    // Execute Primary Click Strategy: focus() and single click()
    console.log('[OmniFlow][Generate] Executing primary click…');
    try {
      button.focus();
      button.click();
      result.buttonClicked = true;
      generateLog('Primary click executed', 'info');
    } catch (e) {
      result.error = `Primary click failed: ${e.message}`;
      console.error('[OmniFlow][Generate] Primary click error:', e);
      window.__omniflowGenerateInProgress = false;
      generateLog('Generate lock released', 'error');
      return result;
    }

    // ── Step 7: Wait 2000ms ───────────────────────────────
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ── Step 8: Check acceptance ──────────────────────────
    let accepted = checkAcceptance();

    // ── Step 9: Fallback click strategy ───────────────────
    if (!accepted) {
      console.log('[OmniFlow][Generate] Prompt not accepted after primary click. Attempting fallback MouseEvent click…');
      try {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        generateLog('Fallback click executed', 'info');
      } catch (e) {
        console.error('[OmniFlow][Generate] Fallback click error:', e);
      }
      
      // Wait another 1500ms
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check acceptance again
      accepted = checkAcceptance();
    }

    // ── Step 10: Final Acceptance Evaluation ──────────────
    if (accepted) {
      result.promptAccepted = true;
      result.success = true;
      window.__omniflowGenState.promptAccepted = true;
      generateLog('Prompt accepted', 'ok');

      // Start background status tracking automatically
      startGenerationMonitoring(button, editor);
    } else {
      result.error = 'Prompt did not seem to be accepted by Gemini (prompt remains in editor, button is active, and no generation indicators appeared).';
      console.warn('[OmniFlow][Generate] Prompt not accepted after primary and fallback click attempts.');
      generateLog('Prompt not accepted', 'warn');
      
      // Release generate lock since it was never accepted
      window.__omniflowGenerateInProgress = false;
      generateLog('Generate lock released', 'warn');
    }

    return result;
  }

  // ════════════════════════════════════════════════════════
  //  MESSAGE ROUTER
  // ════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // ── OMNIFLOW_SCAN (Phase 0) ───────────────────────────
    if (message.type === 'OMNIFLOW_SCAN') {
      console.log('[OmniFlow][Content] Received OMNIFLOW_SCAN.');
      try {
        const candidates = scanPage();
        sendResponse({
          title:        document.title,
          url:          location.href,
          elementCount: candidates.length,
          candidates,
        });
      } catch (err) {
        console.error('[OmniFlow][Content] Scan error:', err);
        sendResponse({ error: `Scan failed: ${err.message}` });
      }
      return true;
    }

    // ── OMNIFLOW_INJECT (Phase 1) ─────────────────────────
    if (message.type === 'OMNIFLOW_INJECT') {
      console.log('[OmniFlow][Content] Received OMNIFLOW_INJECT.');
      const text = message.text || 'Hello from OmniFlow';
      try {
        const result = performInjection(text);
        console.log('[OmniFlow][Content] Sending injection result:', result);
        sendResponse(result);
      } catch (err) {
        console.error('[OmniFlow][Content] Inject error:', err);
        sendResponse({ success: false, text: '', error: `Unexpected error: ${err.message}` });
      }
      return true;
    }

    // ── OMNIFLOW_GENERATE (Phase 2) ───────────────────────
    if (message.type === 'OMNIFLOW_GENERATE') {
      console.log('[OmniFlow][Generate] Received OMNIFLOW_GENERATE.');
      (async () => {
        try {
          const result = await performGenerate();
          console.log('[OmniFlow][Generate] Sending generate result:', result);
          sendResponse(result);
        } catch (err) {
          console.error('[OmniFlow][Generate] Error:', err);
          sendResponse({
            success: false, editorFound: false, promptInjected: false,
            buttonFound: false, buttonClicked: false, promptAccepted: false,
            error: `Unexpected error: ${err.message}`,
            timestamp: Date.now(),
          });
        }
      })();
      return true;
    }

    // ── OMNIFLOW_RESET (Phase 4.1 Lock Reset) ──────────────
    if (message.type === 'OMNIFLOW_RESET') {
      console.log('[OmniFlow][Generate] Received OMNIFLOW_RESET message.');
      window.__omniflowGenerateInProgress = false;
      if (window.__omniflowGenState) {
        window.__omniflowGenState.status = 'waiting';
        window.__omniflowGenState.promptAccepted = false;
        window.__omniflowGenState.generationStarted = false;
        window.__omniflowGenState.generationCompleted = false;
        if (window.__omniflowGenState.checkIntervalId) {
          clearInterval(window.__omniflowGenState.checkIntervalId);
          window.__omniflowGenState.checkIntervalId = null;
        }
      }
      generateLog('Generate lock released', 'info');
      sendResponse({ success: true });
      return true;
    }

    // ── OMNIFLOW_INSPECT_COMPOSER (Phase 2.2) ─────────────
    if (message.type === 'OMNIFLOW_INSPECT_COMPOSER') {
      console.log('[OmniFlow][Inspect] Received OMNIFLOW_INSPECT_COMPOSER.');
      try {
        const result = performInspectComposer();
        console.log('[OmniFlow][Inspect] Sending inspect result:', result);
        sendResponse(result);
      } catch (err) {
        console.error('[OmniFlow][Inspect] Error:', err);
        sendResponse({
          success: false,
          error: `Unexpected error: ${err.message}`,
          timestamp: Date.now(),
        });
      }
      return true;
    }

    // ── OMNIFLOW_GET_STATUS (Phase 3.1) ───────────────────
    if (message.type === 'OMNIFLOW_GET_STATUS') {
      const state = window.__omniflowGenState || { status: 'waiting', startTime: null, logs: [], promptAccepted: false, generationStarted: false, generationCompleted: false };
      const elapsedSeconds = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;
      
      const logsToSend = state.logs || [];
      state.logs = []; // Consume/clear retrieved logs to avoid repeats
      
      sendResponse({
        status: state.status,
        elapsedSeconds: elapsedSeconds,
        logs: logsToSend,
        promptAccepted: state.promptAccepted,
        generationStarted: state.generationStarted,
        generationCompleted: state.generationCompleted
      });
      return true;
    }

    // ── OMNIFLOW_SYNC_RUN_CLIP (Phase 5 CLI Sync) ──────────
    if (message.type === 'OMNIFLOW_SYNC_RUN_CLIP') {
      console.log(`[OmniFlow][Sync] Received command to run Clip #${message.index}`);
      (async () => {
        try {
          const result = await performSyncGenerateForClip(message.index, message.prompt);
          sendResponse(result);
        } catch (err) {
          console.error(`[OmniFlow][Sync] Failed for Clip #${message.index}:`, err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }
  });

  async function performSyncGenerateForClip(clipIndex, clipPrompt) {
    // 1. Reset locks and state
    window.__omniflowGenerateInProgress = false;
    if (window.__omniflowGenState) {
      window.__omniflowGenState.status = 'waiting';
      window.__omniflowGenState.promptAccepted = false;
      window.__omniflowGenState.generationStarted = false;
      window.__omniflowGenState.generationCompleted = false;
    }

    // Acquire lock
    window.__omniflowGenerateInProgress = true;
    
    // Find editor
    const editor = findEditor();
    if (!editor) {
      window.__omniflowGenerateInProgress = false;
      throw new Error('Editor not found. Make sure you are on a Flow/Omni editor page.');
    }

    // Inject prompt
    const isContentEditable = editor.getAttribute('contenteditable') === 'true' || editor.isContentEditable;
    if (isContentEditable) {
      injectIntoContentEditable(editor, clipPrompt);
    } else {
      injectIntoTextarea(editor, clipPrompt);
    }

    // Wait 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find button
    let button = null;
    const composerContainer = discoverComposerContainer(editor);
    if (composerContainer) {
      button = composerContainer.querySelector('button[aria-label="Send message"]');
    }
    if (!button) {
      button = document.querySelector('button[aria-label="Send message"]');
    }
    if (!button) {
      const fb = findGenerateButton();
      button = fb.button;
    }

    if (!button) {
      window.__omniflowGenerateInProgress = false;
      throw new Error('Send/Generate button not found.');
    }

    // Click button
    button.focus();
    button.click();

    // Helper to check acceptance
    function checkAcceptance() {
      const textRemaining = readEditorText(editor).trim();
      const isDisappeared = textRemaining.length === 0;
      const isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
      const genInfo = isPageGenerating();
      return isDisappeared || isDisabled || genInfo.generating;
    }

    // Wait up to 4s for acceptance
    let accepted = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (checkAcceptance()) {
        accepted = true;
        break;
      }
    }

    // Try fallback click if not accepted
    if (!accepted) {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (checkAcceptance()) {
          accepted = true;
          break;
        }
      }
    }

    if (!accepted) {
      window.__omniflowGenerateInProgress = false;
      throw new Error('Prompt was not accepted by the editor.');
    }

    window.__omniflowGenState.promptAccepted = true;
    console.log(`[OmniFlow][Sync] Clip #${clipIndex} prompt accepted. Monitoring generation...`);

    // Poll until generation completes
    let startTime = Date.now();
    let generationDetected = false;
    
    while (true) {
      // Check timeout (5 minutes)
      if (Date.now() - startTime > 5 * 60 * 1000) {
        window.__omniflowGenerateInProgress = false;
        throw new Error('Generation timed out (exceeded 5 minutes).');
      }

      const genInfo = isPageGenerating();
      const completed = isGenerationCompleted();

      if (genInfo.generating) {
        generationDetected = true;
        window.__omniflowGenState.status = 'generating';
        window.__omniflowGenState.generationStarted = true;
      }

      if (completed) {
        window.__omniflowGenState.status = 'completed';
        window.__omniflowGenState.generationCompleted = true;
        break;
      }

      // If we waited 20s and no generation is detected at all, error out
      if (!generationDetected && (Date.now() - startTime > 20000)) {
        window.__omniflowGenerateInProgress = false;
        throw new Error('No video generation activity detected within 20 seconds.');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[OmniFlow][Sync] Clip #${clipIndex} generation complete! Finding video file...`);

    // Locate video element
    const videoEl = document.querySelector('video');
    if (!videoEl || !videoEl.src) {
      window.__omniflowGenerateInProgress = false;
      throw new Error('Generation complete, but no video element or source URL found on page.');
    }

    const videoSrc = videoEl.src;
    console.log(`[OmniFlow][Sync] Found video src: ${videoSrc}`);

    // If it's a blob url, we must fetch it here in content context
    if (videoSrc.startsWith('blob:')) {
      console.log(`[OmniFlow][Sync] Fetching same-origin blob: ${videoSrc}`);
      const res = await fetch(videoSrc);
      const blob = await res.blob();
      
      console.log(`[OmniFlow][Sync] Same-origin blob fetched (${blob.size} bytes). Uploading...`);
      await uploadBlobToCli(blob, clipIndex);
    } else {
      // It's a remote URL. Try to fetch in content script first
      try {
        console.log(`[OmniFlow][Sync] Attempting to fetch remote URL: ${videoSrc}`);
        const res = await fetch(videoSrc);
        const blob = await res.blob();
        await uploadBlobToCli(blob, clipIndex);
      } catch (corsErr) {
        console.warn(`[OmniFlow][Sync] CORS error in page context. Delegating remote fetch to popup: ${videoSrc}`);
        window.__omniflowGenerateInProgress = false;
        return {
          success: true,
          delegateFetch: true,
          videoUrl: videoSrc,
          index: clipIndex
        };
      }
    }

    // Reset generate lock
    window.__omniflowGenerateInProgress = false;
    return { success: true };
  }

  async function uploadBlobToCli(blob, clipIndex) {
    const res = await fetch(`http://localhost:3001/upload-clip?index=${clipIndex}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4'
      },
      body: blob
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Orchestrator server rejected upload: ${txt}`);
    }
  }

  console.log('[OmniFlow][Content] Message router ready (OMNIFLOW_SCAN + OMNIFLOW_INJECT + OMNIFLOW_GENERATE + OMNIFLOW_INSPECT_COMPOSER + OMNIFLOW_GET_STATUS).');

})();

