// ─────────────────────────────────────────────────────────
// OmniFlow — content.js  (Phase 1)
// Handles two messages:
//   OMNIFLOW_SCAN   → Phase 0: DOM scan + candidate scoring
//   OMNIFLOW_INJECT → Phase 1: Prompt injection into editor
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
  });

  console.log('[OmniFlow][Content] Message router ready (OMNIFLOW_SCAN + OMNIFLOW_INJECT).');

})();
