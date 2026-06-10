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
    checkIntervalId: null
  };

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
   * @returns {boolean}
   */
  function isPageGenerating() {
    // 1. Check for visible stop/cancel buttons
    const stopButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => {
      if (!isVisible(btn)) return false;
      const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      return text.includes('stop') || text.includes('cancel');
    });
    if (stopButton) return true;

    // 2. Check for active progress bar or loading indicators
    const progressSelectors = [
      'progress', 'mat-progress-bar', '[role="progressbar"]',
      '.progress', '.loading', '.shimmer', '.generating', '.spinner',
      '[class*="loading"]', '[class*="generating"]', '[class*="progress"]'
    ];
    const progressIndicators = Array.from(
      document.querySelectorAll(progressSelectors.join(', '))
    ).filter(isVisible);

    if (progressIndicators.length > 0) return true;

    // 3. Check for specific text indicators in page content
    const bodyText = document.body.innerText || '';
    if (bodyText.includes('Generating video...') || bodyText.includes('Creating video...')) {
      return true;
    }

    return false;
  }

  /**
   * Starts monitoring the video generation progress.
   */
  function startGenerationMonitoring() {
    console.log('[OmniFlow][Monitor] Generation started');
    
    // Clear any existing monitor
    if (window.__omniflowGenState.checkIntervalId) {
      clearInterval(window.__omniflowGenState.checkIntervalId);
    }

    window.__omniflowGenState = {
      status: 'waiting',
      startTime: Date.now(),
      endTime: null,
      checkIntervalId: null
    };

    window.__omniflowGenState.checkIntervalId = setInterval(() => {
      const elapsed = (Date.now() - window.__omniflowGenState.startTime) / 1000;
      const currentlyGenerating = isPageGenerating();

      console.log(`[OmniFlow][Monitor] Generation status: ${window.__omniflowGenState.status}, currentlyGenerating: ${currentlyGenerating}, elapsed: ${elapsed.toFixed(1)}s`);

      if (window.__omniflowGenState.status === 'waiting') {
        if (currentlyGenerating) {
          window.__omniflowGenState.status = 'generating';
          console.log('[OmniFlow][Monitor] Generation in progress');
        } else {
          // If no generation indicators appear within 15 seconds
          if (elapsed > 15) {
            window.__omniflowGenState.status = 'no_gen_detected';
            window.__omniflowGenState.endTime = Date.now();
            console.warn('[OmniFlow][Monitor] Generation aborted: No generation detected within 15 seconds.');
            clearInterval(window.__omniflowGenState.checkIntervalId);
            window.__omniflowGenState.checkIntervalId = null;
          }
        }
      } else if (window.__omniflowGenState.status === 'generating') {
        if (currentlyGenerating) {
          // Maximum monitoring time: 5 minutes (300 seconds)
          if (elapsed > 300) {
            window.__omniflowGenState.status = 'timeout';
            window.__omniflowGenState.endTime = Date.now();
            console.error('[OmniFlow][Monitor] Generation aborted: Timed out after 5 minutes.');
            clearInterval(window.__omniflowGenState.checkIntervalId);
            window.__omniflowGenState.checkIntervalId = null;
          }
        } else {
          // Generation completed
          window.__omniflowGenState.status = 'completed';
          window.__omniflowGenState.endTime = Date.now();
          console.log(`[OmniFlow][Monitor] Generation completed. Total time: ${elapsed.toFixed(1)}s`);
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
  function performGenerate() {
    const INJECT_TEXT = 'Create a 5-second cinematic video of a red sports car driving through a futuristic neon-lit city at night, realistic lighting, smooth camera movement, high quality.';

    const result = {
      success:        false,
      editorFound:    false,
      promptInjected: false,
      buttonFound:    false,
      buttonClicked:  false,
      strategyUsed:   '',
      buttonText:     '',
      timestamp:      Date.now(),
    };

    // ── Step 1: Find editor ───────────────────────────────
    console.log('[OmniFlow][Generate] Locating editor…');
    const editor = findEditor();
    if (!editor) {
      result.error = 'Editor not found. Make sure you are on a Flow/Omni editor page.';
      console.warn('[OmniFlow][Generate] Editor not found.');
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
        return result;
      }

      result.promptInjected = true;
      console.log('[OmniFlow][Generate] Prompt injected and verified ✓');
    } catch (e) {
      result.error = `Prompt injection failed: ${e.message}`;
      console.error('[OmniFlow][Generate] Injection error:', e);
      return result;
    }

    // ── Step 3: Find generate button ─────────────────────
    console.log('[OmniFlow][Generate] Searching generate button…');
    const { button, strategy, buttonText } = findGenerateButton();

    result.strategyUsed = strategy;
    result.buttonText   = buttonText;

    if (!button) {
      result.error = 'Generate button not found inside composer container.';
      return result;
    }
    result.buttonFound = true;
    console.log(`[OmniFlow][Generate] Button found via strategy: ${strategy} ✓`);

    // ── Step 4: Click ─────────────────────────────────────
    console.log('[OmniFlow][Generate] Clicking button…');
    try {
      button.focus();
      button.click();

      // Fire pointer/mouse events for frameworks that intercept them
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mousedown',    { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mouseup',      { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('click',        { bubbles: true, cancelable: true }));

      result.buttonClicked = true;
      result.success       = true;
      console.log('[OmniFlow][Generate] Generation trigger completed ✓');

      // Start background state tracking
      startGenerationMonitoring();
    } catch (e) {
      result.error = `Button click failed: ${e.message}`;
      console.error('[OmniFlow][Generate] Click error:', e);
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
      try {
        const result = performGenerate();
        console.log('[OmniFlow][Generate] Sending generate result:', result);
        sendResponse(result);
      } catch (err) {
        console.error('[OmniFlow][Generate] Error:', err);
        sendResponse({
          success: false, editorFound: false, promptInjected: false,
          buttonFound: false, buttonClicked: false,
          error: `Unexpected error: ${err.message}`,
          timestamp: Date.now(),
        });
      }
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
      const state = window.__omniflowGenState || { status: 'waiting', startTime: null };
      const elapsedSeconds = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;
      
      sendResponse({
        status: state.status,
        elapsedSeconds: elapsedSeconds
      });
      return true;
    }
  });

  console.log('[OmniFlow][Content] Message router ready (OMNIFLOW_SCAN + OMNIFLOW_INJECT + OMNIFLOW_GENERATE + OMNIFLOW_INSPECT_COMPOSER + OMNIFLOW_GET_STATUS).');

})();
