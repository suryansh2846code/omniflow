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

  console.log('[OmniFlow][Content] Content script initialised (Phase 2.1).');

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
   * Find the generate button using a composer-scoped approach:
   *
   *  1. Locate the Slate prompt editor.
   *  2. Walk upward through the DOM to find the tightest ancestor
   *     ("composer container") that contains at least one usable button.
   *     STOP there — never search beyond this container.
   *  3. Collect all usable buttons inside the composer only.
   *  4. Log every candidate before choosing.
   *  5. Choose the rightmost keyword-matching button (keyword_rightmost).
   *  6. If no keyword match, choose the rightmost button in the composer
   *     (container_rightmost). No global page scanning. No last-resort fallback.
   *
   * @returns {{ button: Element|null, strategy: string, buttonText: string }}
   */
  function findGenerateButton() {
    console.log('[OmniFlow][Generate] Searching for generate button inside composer…');

    // ── Step 1: Locate the editor ─────────────────────────
    const editor = findEditor();
    if (!editor) {
      console.warn('[OmniFlow][Generate] Cannot find generate button — editor not found.');
      return { button: null, strategy: 'none', buttonText: '' };
    }

    // ── Step 2: Walk up to the composer container ─────────
    // The composer container is the tightest ancestor that holds
    // at least one usable button. We stop at the first such ancestor
    // and never go wider — buttons outside it are never considered.
    let composerContainer = null;
    let ancestor = editor.parentElement;

    while (ancestor && ancestor !== document.body) {
      const buttonsInAncestor = Array.from(
        ancestor.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
      ).filter(isButtonUsable);

      if (buttonsInAncestor.length > 0) {
        composerContainer = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    if (!composerContainer) {
      console.warn('[OmniFlow][Generate] No composer container with usable buttons found.');
      return { button: null, strategy: 'none', buttonText: '' };
    }

    console.log(
      `[OmniFlow][Generate] Composer container: <${composerContainer.tagName.toLowerCase()}> ` +
      `class="${composerContainer.className}"`
    );

    // ── Step 3: Collect all usable buttons inside composer ─
    const composerButtons = Array.from(
      composerContainer.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
    ).filter(isButtonUsable);

    // ── Step 4: Log every candidate before choosing ───────
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

    // ── Step 5: Prefer keyword-matching button (rightmost) ─
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

    // ── Step 6: Fallback — rightmost button inside composer ─
    // Still 100% scoped inside the composer. No global page scan.
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
