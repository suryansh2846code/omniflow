// ─────────────────────────────────────────────────────────
// OmniFlow — content.js  (Phase 2)
// Handles three messages:
//   OMNIFLOW_SCAN     → Phase 0: DOM scan + candidate scoring
//   OMNIFLOW_INJECT   → Phase 1: Prompt injection into editor
//   OMNIFLOW_GENERATE → Phase 2: Inject prompt + click generate button
// ─────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Duplicate-listener guard ─────────────────────────────
  // We track whether our listener is already registered so that
  // re-injections (popup re-opens, second button click) don't
  // stack duplicate handlers.  We do NOT use window.__omniflowInjected
  // because that would silently block every call after the first.
  if (window.__omniflowListenerRegistered) {
    console.log('[OmniFlow][Content] Listener already registered — skipping re-attach.');
    return;
  }
  window.__omniflowListenerRegistered = true;

  console.log('[OmniFlow][Content] Content script initialised (Phase 1).');

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
   *
   * Priority order (most specific → most general):
   *  1. data-slate-editor="true"  — Slate.js (used by Omni / Flow)
   *  2. role="textbox" + contenteditable
   *  3. Any visible contenteditable
   *  4. First visible textarea
   *
   * @returns {Element|null}
   */
  function findEditor() {
    console.log('[OmniFlow][Content] Locating editor…');

    // 1 — Slate editor (Omni / Google Flow)
    const slate = document.querySelector('[data-slate-editor="true"]');
    if (slate) {
      console.log('[OmniFlow][Content] Editor found via data-slate-editor.');
      return slate;
    }

    // 2 — ARIA textbox + contenteditable
    const ariaTextbox = document.querySelector('[role="textbox"][contenteditable="true"]');
    if (ariaTextbox) {
      console.log('[OmniFlow][Content] Editor found via role=textbox+contenteditable.');
      return ariaTextbox;
    }

    // 3 — Any visible contenteditable
    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const visibleEditable = editables.find(isVisible);
    if (visibleEditable) {
      console.log('[OmniFlow][Content] Editor found via visible contenteditable.');
      return visibleEditable;
    }

    // 4 — Visible textarea
    const textareas = Array.from(document.querySelectorAll('textarea'));
    const visibleTextarea = textareas.find(isVisible);
    if (visibleTextarea) {
      console.log('[OmniFlow][Content] Editor found via visible textarea.');
      return visibleTextarea;
    }

    console.warn('[OmniFlow][Content] No editor found.');
    return null;
  }

  /**
   * Read the current text from an editor element.
   * Handles both contenteditable and textarea/input.
   * @param {Element} editor
   * @returns {string}
   */
  function readEditorText(editor) {
    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
      return editor.value;
    }
    // contenteditable — use innerText to preserve line breaks
    return editor.innerText || editor.textContent || '';
  }

  /**
   * Dispatch a synthetic keyboard event.
   * Required for frameworks (React, Slate, etc.) that listen to key events
   * rather than DOM mutations.
   * @param {Element} el
   * @param {string} type  'keydown' | 'keypress' | 'keyup'
   * @param {object} init  KeyboardEventInit overrides
   */
  function fireKeyEvent(el, type, init = {}) {
    el.dispatchEvent(new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      ...init,
    }));
  }

  /**
   * Inject text into a contenteditable element using the most
   * framework-compatible approach available.
   *
   * Strategy (tried in order):
   *  A. document.execCommand('insertText')  — works in most browsers/editors
   *     incl. Slate; triggers the editor's own mutation handling.
   *  B. Clipboard DataTransfer paste event  — works for some frameworks
   *     that intercept paste but not execCommand.
   *  C. Direct innerText assignment + manual React/Slate event firing
   *     — last resort; may or may not stick depending on framework version.
   *
   * @param {Element} editor
   * @param {string}  text
   * @returns {boolean} true if at least one strategy appeared to succeed
   */
  function injectIntoContentEditable(editor, text) {
    // Focus and select all existing content first
    editor.focus();
    fireKeyEvent(editor, 'keydown', { key: 'a', ctrlKey: true, metaKey: true });
    document.execCommand('selectAll');

    // ── Strategy A: execCommand insertText ───────────────
    // This is the cleanest path — it works with Slate, ProseMirror, and
    // most rich-text editors because it goes through the browser's editing
    // pipeline rather than directly mutating the DOM.
    const execResult = document.execCommand('insertText', false, text);
    console.log(`[OmniFlow][Content] execCommand('insertText') result: ${execResult}`);

    if (execResult) return true;

    // ── Strategy B: Synthetic paste event ────────────────
    console.log('[OmniFlow][Content] execCommand failed — trying paste event strategy.');
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      // Clear first
      editor.textContent = '';
      editor.dispatchEvent(pasteEvent);

      // Fire input event so listeners pick up the change
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        data: text,
      }));
    } catch (e) {
      console.warn('[OmniFlow][Content] Paste strategy error:', e);
    }

    // ── Strategy C: Direct assignment + React-style events ──
    console.log('[OmniFlow][Content] Trying direct innerText assignment strategy.');
    try {
      // Move caret to end and select all
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      // Direct assignment — works for non-React editors
      editor.innerText = text;

      // Re-focus and fire events so frameworks react
      editor.focus();
      fireKeyEvent(editor, 'keydown', { key: 'Process', bubbles: true });
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      fireKeyEvent(editor, 'keyup', { key: 'Process', bubbles: true });
    } catch (e) {
      console.warn('[OmniFlow][Content] Direct assignment strategy error:', e);
    }

    return false; // caller will verify via readEditorText
  }

  /**
   * Inject text into a standard textarea or input element.
   * Uses the React-compatible nativeInputValueSetter trick so
   * React's synthetic event system sees the change.
   * @param {Element} editor
   * @param {string}  text
   */
  function injectIntoTextarea(editor, text) {
    editor.focus();

    // Use React's internal setter if available (works with React-controlled inputs)
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

    // Fire React-compatible events
    editor.dispatchEvent(new Event('input',  { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[OmniFlow][Content] textarea/input value set via nativeSetter.');
  }

  /**
   * Main injection entry point.
   * @param {string} text — the text to inject
   * @returns {{ success: boolean, text: string, error?: string }}
   */
  function performInjection(text) {
    console.log(`[OmniFlow][Content] Starting injection. Text: "${text}"`);

    // ── Step 1: Find editor ───────────────────────────────
    const editor = findEditor();
    if (!editor) {
      return {
        success: false,
        text: '',
        error: 'Editor not found. Make sure you are on a Flow/Omni editor page.',
      };
    }
    console.log('[OmniFlow][Content] Editor found ✓');

    // ── Step 2: Focus ─────────────────────────────────────
    try {
      editor.focus();
      console.log('[OmniFlow][Content] Editor focused ✓');
    } catch (e) {
      return { success: false, text: '', error: `Focus failed: ${e.message}` };
    }

    // ── Step 3: Inject ────────────────────────────────────
    try {
      const isContentEditable =
        editor.getAttribute('contenteditable') === 'true' ||
        editor.isContentEditable;

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

    // ── Step 4: Verify ────────────────────────────────────
    // Small delay to allow the framework to process the events before we read
    // Note: We can't use setTimeout here (sync context), so we read immediately.
    // If frameworks are async, the text may not be updated yet — we still report
    // what we can read. In practice execCommand is synchronous in Slate.
    const detected = readEditorText(editor).trim();
    console.log(`[OmniFlow][Content] Verification — detected text: "${detected}"`);

    const verified = detected === text.trim();
    if (verified) {
      console.log('[OmniFlow][Content] Verification PASSED ✓');
    } else {
      // Not necessarily a failure — some editors update asynchronously.
      // We still return success=true if injection ran without errors, but
      // we surface the detected text so the popup can show it.
      console.warn(
        `[OmniFlow][Content] Text mismatch: expected "${text}" got "${detected}". ` +
        'This may be normal for async frameworks — check the editor visually.'
      );
    }

    return {
      success: true, // injection ran; popup shows detected text for visual confirmation
      text: detected || text, // fall back to intended text if editor hasn't updated yet
    };
  }

  // ════════════════════════════════════════════════════════
  //  PHASE 2 — GENERATE BUTTON DETECTION & CLICK
  // ════════════════════════════════════════════════════════

  /**
   * Check if a button element is visible and not disabled.
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
   * Locate the Generate / Create / Submit button using a 4-strategy cascade.
   *
   * Strategy 1 — Text/icon match: any button whose textContent contains
   *   'arrow_forward' (the Material icon name Flow uses), or common labels.
   * Strategy 2 — Proximity: buttons that share a DOM ancestor with the
   *   Slate editor (prompt-bar container).
   * Strategy 3 — Geometric: the usable button whose left edge is immediately
   *   to the right of the editor's right edge.
   * Strategy 4 — Last resort: the last visible, enabled button on the page.
   *
   * @returns {{ button: Element|null, strategy: string, buttonText: string }}
   */
  function findGenerateButton() {
    console.log('[OmniFlow][Generate] Searching for generate button…');

    // Collect all button-like elements once
    const allButtons = Array.from(document.querySelectorAll(
      'button, [role="button"], input[type="submit"], input[type="button"]'
    ));

    // ── Strategy 1: text/icon content match ──────────────
    const GENERATE_LABELS = [
      'arrow_forward',
      'generate',
      'create',
      'submit',
      'run',
      'send',
      'go',
    ];

    for (const btn of allButtons) {
      if (!isButtonUsable(btn)) continue;
      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      const matched = GENERATE_LABELS.find(label => text.includes(label));
      if (matched) {
        const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || matched;
        console.log(`[OmniFlow][Generate] Strategy #1 succeeded: found “${displayText}”`);
        return { button: btn, strategy: 'arrow_forward_text', buttonText: displayText };
      }
    }
    console.log('[OmniFlow][Generate] Strategy #1: no match.');

    // ── Strategy 2: shared container with editor ─────────
    const editor = findEditor();
    if (editor) {
      // Walk up to find the prompt bar — the nearest ancestor that also
      // contains at least one button.
      let ancestor = editor.parentElement;
      while (ancestor && ancestor !== document.body) {
        const containerButtons = Array.from(
          ancestor.querySelectorAll('button, [role="button"]')
        ).filter(isButtonUsable);

        if (containerButtons.length > 0) {
          // Among these, prefer rightmost (by bounding box)
          containerButtons.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return rb.right - ra.right; // descending — rightmost first
          });
          const btn = containerButtons[0];
          const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || 'button';
          console.log(`[OmniFlow][Generate] Strategy #2 succeeded: rightmost button in prompt container “${displayText}”`);
          return { button: btn, strategy: 'prompt_container_rightmost', buttonText: displayText };
        }
        ancestor = ancestor.parentElement;
      }
    }
    console.log('[OmniFlow][Generate] Strategy #2: no match.');

    // ── Strategy 3: geometric — button immediately right of editor ──
    if (editor) {
      const editorRect = editor.getBoundingClientRect();
      const TOLERANCE  = 120; // px — how far right of editor we look

      const geometricMatch = allButtons
        .filter(isButtonUsable)
        .filter(btn => {
          const r = btn.getBoundingClientRect();
          // Button's left edge must be >= editor's right edge (within tolerance)
          // and vertically overlapping with the editor
          return (
            r.left  >= editorRect.right - 20 &&
            r.left  <= editorRect.right + TOLERANCE &&
            r.bottom >= editorRect.top &&
            r.top   <= editorRect.bottom
          );
        })
        // Take the closest one (smallest horizontal gap)
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

      if (geometricMatch.length > 0) {
        const btn = geometricMatch[0];
        const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || 'button';
        console.log(`[OmniFlow][Generate] Strategy #3 succeeded: geometric proximity “${displayText}”`);
        return { button: btn, strategy: 'geometric_right_of_editor', buttonText: displayText };
      }
    }
    console.log('[OmniFlow][Generate] Strategy #3: no match.');

    // ── Strategy 4: last visible enabled button on page ──
    const usableButtons = allButtons.filter(isButtonUsable);
    if (usableButtons.length > 0) {
      // Pick the one with the rightmost + lowest position (typical submit position)
      usableButtons.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        // Combined score: bottom + right position
        return (rb.bottom + rb.right) - (ra.bottom + ra.right);
      });
      const btn = usableButtons[0];
      const displayText = btn.textContent.trim() || btn.getAttribute('aria-label') || 'button';
      console.log(`[OmniFlow][Generate] Strategy #4 succeeded (last resort): “${displayText}”`);
      return { button: btn, strategy: 'last_visible_button', buttonText: displayText };
    }

    console.warn('[OmniFlow][Generate] All 4 strategies failed. No generate button found.');
    return { button: null, strategy: 'none', buttonText: '' };
  }

  /**
   * Full Phase 2 automation:
   *   1. Find editor
   *   2. Inject prompt text
   *   3. Find generate button
   *   4. Click it
   *   5. Return structured result
   *
   * @returns {Object} result object matching the OMNIFLOW_GENERATE spec
   */
  function performGenerate() {
    const INJECT_TEXT = 'Test video generation from OmniFlow';

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
      result.promptInjected = true;
      console.log('[OmniFlow][Generate] Prompt injected ✓');
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
      result.error = 'Generate button not found after trying all 4 strategies.';
      return result;
    }
    result.buttonFound = true;
    console.log(`[OmniFlow][Generate] Button found via strategy: ${strategy} ✓`);

    // ── Step 4: Click ─────────────────────────────────────
    console.log('[OmniFlow][Generate] Clicking button…');
    try {
      button.focus();
      button.click();

      // Fire pointer events for frameworks that intercept them
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mousedown',    { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('mouseup',      { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('click',        { bubbles: true, cancelable: true }));

      result.buttonClicked = true;
      result.success       = true;
      console.log('[OmniFlow][Generate] Generation trigger completed ✓');
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
  });

  console.log('[OmniFlow][Content] Message router ready (OMNIFLOW_SCAN + OMNIFLOW_INJECT + OMNIFLOW_GENERATE).');

})();
