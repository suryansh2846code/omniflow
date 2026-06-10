// ─────────────────────────────────────────────────────────
// OmniFlow — content.js
// Injected into the active tab by popup.js.
// Scans the DOM, detects candidate prompt fields,
// ranks them by confidence, and returns results.
// ─────────────────────────────────────────────────────────

(function () {
  'use strict';

  // Guard: prevent duplicate listeners if script is injected more than once
  if (window.__omniflowInjected) {
    console.log('[OmniFlow][Content] Already injected — skipping re-init.');
    return;
  }
  window.__omniflowInjected = true;

  console.log('[OmniFlow][Content] Content script initialised.');

  // ── Helpers ─────────────────────────────────────────────

  /**
   * Returns true if an element is visible in the viewport.
   * Checks both CSS visibility and bounding rect.
   * @param {Element} el
   * @returns {boolean}
   */
  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Returns true if the element is "large" — a signal for a prompt/textarea.
   * @param {Element} el
   * @returns {boolean}
   */
  function isLarge(el) {
    const rect = el.getBoundingClientRect();
    // Heuristic: either tall enough to be a textarea, or wide and multi-line
    return (rect.height > 60) || (rect.width > 200 && el.tagName === 'TEXTAREA');
  }

  /**
   * Collect structured data about a DOM element.
   * @param {Element} el
   * @returns {Object}
   */
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

  // ── Confidence scoring ───────────────────────────────────

  // Keywords that strongly suggest a prompt input field
  const PROMPT_KEYWORDS = [
    'prompt', 'message', 'input', 'chat', 'query', 'ask',
    'describe', 'type here', 'enter', 'write', 'text',
  ];

  /**
   * Score a single element for likelihood of being a prompt field.
   * Returns an integer 0–100.
   * @param {Object} info  - Output of collectElementInfo()
   * @returns {number}
   */
  function scoreElement(info) {
    let score = 0;
    const signals = {};

    // Visibility is a prerequisite — strongly penalise hidden elements
    if (info.visible) {
      score += 20;
      signals.visible = true;
    } else {
      signals.visible = false;
      // Don't completely exclude hidden elements — Omni may use off-screen inputs
      score -= 5;
    }

    // contenteditable divs are common in rich-text editors (very likely for Omni)
    if (info.contenteditable) {
      score += 30;
      signals.contenteditable = true;
    } else {
      signals.contenteditable = false;
    }

    // Placeholder text is a reliable signal
    if (info.placeholder) {
      score += 15;
      signals.hasPlaceholder = true;

      // Keyword match in placeholder boosts further
      const ph = info.placeholder.toLowerCase();
      if (PROMPT_KEYWORDS.some(kw => ph.includes(kw))) {
        score += 15;
      }
    } else {
      signals.hasPlaceholder = false;
    }

    // ARIA label present
    if (info.ariaLabel) {
      score += 10;
      signals.hasAriaLabel = true;

      const al = info.ariaLabel.toLowerCase();
      if (PROMPT_KEYWORDS.some(kw => al.includes(kw))) {
        score += 10;
      }
    } else {
      signals.hasAriaLabel = false;
    }

    // textarea is nearly always a text input
    if (info.tagName === 'textarea') {
      score += 20;
    }

    // input[type=text] or input with no type
    if (info.tagName === 'input' && (!info.type || info.type === 'text' || info.type === 'search')) {
      score += 10;
    }

    // Large element = likely a multi-line prompt area
    if (info.large) {
      score += 10;
      signals.large = true;
    } else {
      signals.large = false;
    }

    // id/class keyword matches
    const idClass = `${info.id} ${info.className}`.toLowerCase();
    if (PROMPT_KEYWORDS.some(kw => idClass.includes(kw))) {
      score += 10;
    }

    // Clamp to [0, 100]
    return { score: Math.max(0, Math.min(100, score)), signals };
  }

  // ── DOM Scanner ──────────────────────────────────────────

  /**
   * Scan the page for all candidate input elements.
   * @returns {Array<Object>} Sorted array of candidates (highest score first)
   */
  function scanPage() {
    console.log('[OmniFlow][Content] Beginning DOM scan…');

    // Collect all relevant selectors
    const selectors = 'textarea, input, [contenteditable="true"]';
    const rawElements = Array.from(document.querySelectorAll(selectors));

    console.log(`[OmniFlow][Content] Raw elements found: ${rawElements.length}`);

    const results = [];

    rawElements.forEach((el, index) => {
      const info = collectElementInfo(el);
      const { score, signals } = scoreElement(info);

      console.log(
        `[OmniFlow][Content] Element #${index + 1}: <${info.tagName}> ` +
        `id="${info.id}" score=${score}`
      );

      results.push({
        ...info,
        score,
        signals,
      });
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    console.log(`[OmniFlow][Content] DOM scan complete. Candidates: ${results.length}`);
    return results;
  }

  // ── Message listener ─────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'OMNIFLOW_SCAN') return;

    console.log('[OmniFlow][Content] Received OMNIFLOW_SCAN message.');

    try {
      const candidates = scanPage();

      const payload = {
        title:        document.title,
        url:          location.href,
        elementCount: candidates.length,
        candidates,   // full ranked list returned; popup decides how many to show
      };

      console.log('[OmniFlow][Content] Sending results back to popup.');
      sendResponse(payload);

    } catch (err) {
      console.error('[OmniFlow][Content] Scan error:', err);
      sendResponse({ error: `Scan failed: ${err.message}` });
    }

    // Return true to keep the message channel open for async sendResponse
    return true;
  });

  console.log('[OmniFlow][Content] Message listener registered. Awaiting OMNIFLOW_SCAN.');

})();
