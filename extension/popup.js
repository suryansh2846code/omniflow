// ─────────────────────────────────────────────────────────
// OmniFlow — popup.js
// Orchestrates: tab query → content script injection →
// result rendering.
// ─────────────────────────────────────────────────────────

// ── DOM refs ──────────────────────────────────────────────
const testBtn         = document.getElementById('testBtn');
const statusDot       = document.getElementById('statusDot');
const valUrl          = document.getElementById('valUrl');
const valTitle        = document.getElementById('valTitle');
const valCount        = document.getElementById('valCount');
const cardUrl         = document.getElementById('cardUrl');
const cardTitle       = document.getElementById('cardTitle');
const cardCount       = document.getElementById('cardCount');
const candidatesWrap  = document.getElementById('candidatesWrap');
const candidatesList  = document.getElementById('candidatesList');
const errorBanner     = document.getElementById('errorBanner');
const errorMsg        = document.getElementById('errorMsg');
const logToggle       = document.getElementById('logToggle');
const toggleArrow     = document.getElementById('toggleArrow');
const logBox          = document.getElementById('logBox');

// Phase 1 refs
const injectBtn       = document.getElementById('injectBtn');
const injectPanel     = document.getElementById('injectPanel');
const injectBadge     = document.getElementById('injectBadge');
const injectTextRow   = document.getElementById('injectTextRow');
const injectTextValue = document.getElementById('injectTextValue');

// ── Log helpers ───────────────────────────────────────────
/**
 * Append a line to the diagnostic log panel.
 * @param {string} text   - Message to log
 * @param {'info'|'ok'|'warn'|'error'} level
 */
function log(text, level = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${level}`;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  line.textContent = `${timestamp}  ${text}`;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
  console.log(`[OmniFlow][Popup] ${text}`);
}

// ── Status indicator ──────────────────────────────────────
function setStatus(state) {
  statusDot.className = 'status-dot';
  if (state !== 'idle') statusDot.classList.add(state);
}

// ── UI state helpers ──────────────────────────────────────
function showError(msg) {
  errorBanner.classList.add('visible');
  errorBanner.setAttribute('aria-hidden', 'false');
  errorMsg.textContent = msg;
  log(`Error: ${msg}`, 'error');
  setStatus('error');
}

function clearError() {
  errorBanner.classList.remove('visible');
  errorBanner.setAttribute('aria-hidden', 'true');
  errorMsg.textContent = '';
}

function setCardValue(el, value) {
  el.textContent = value;
}

// ── Injection result helpers ────────────────────────────
/**
 * Show the injection result panel.
 * @param {'success'|'failed'} status
 * @param {string} detectedText
 */
function showInjectResult(status, detectedText) {
  injectPanel.classList.add('visible');

  // Reset badge classes
  injectBadge.className = 'inject-badge';
  injectBadge.classList.add(status);
  injectBadge.textContent = status === 'success' ? '✓ SUCCESS' : '✗ FAILED';

  injectTextValue.textContent = detectedText || '';
  injectTextRow.style.display = detectedText ? 'flex' : 'none';
}

function hideInjectPanel() {
  injectPanel.classList.remove('visible');
  injectBadge.className = 'inject-badge';
  injectBadge.textContent = '';
  injectTextValue.textContent = '';
}

function revealCards() {
  [cardUrl, cardTitle, cardCount].forEach((card, i) => {
    setTimeout(() => card.classList.add('visible'), i * 60);
  });
}

// ── Confidence label ──────────────────────────────────────
function confidenceClass(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function confidenceLabel(score) {
  if (score >= 70) return '🟢 High';
  if (score >= 40) return '🟡 Medium';
  return '⚪ Low';
}

// ── Render candidates ─────────────────────────────────────
/**
 * Render the ranked prompt-candidate list.
 * @param {Array<Object>} candidates
 */
function renderCandidates(candidates) {
  candidatesList.innerHTML = '';

  if (!candidates || candidates.length === 0) {
    candidatesWrap.classList.remove('visible');
    log('No prompt candidates found on this page.', 'warn');
    return;
  }

  candidatesWrap.classList.add('visible');
  log(`Rendering ${candidates.length} candidate(s).`, 'ok');

  candidates.forEach((c, index) => {
    const li = document.createElement('li');
    li.className = 'candidate-item';
    li.style.animationDelay = `${index * 60}ms`;

    const cls = confidenceClass(c.score);
    const label = confidenceLabel(c.score);

    // Build signal pills
    const signals = [
      { key: 'visible',        icon: '👁',  label: 'Visible'        },
      { key: 'contenteditable', icon: '✏️',  label: 'ContentEditable' },
      { key: 'hasPlaceholder', icon: '💬',  label: 'Placeholder'    },
      { key: 'large',          icon: '📐',  label: 'Large'          },
      { key: 'hasAriaLabel',   icon: '♿',  label: 'ARIA label'     },
    ];

    const pillsHtml = signals.map(s => {
      const active = c.signals?.[s.key] ? 'active' : '';
      return `<span class="signal-pill ${active}" title="${s.label}">${s.icon}</span>`;
    }).join('');

    // Meta tags: tag, id, type
    const metaTags = [
      c.tagName  ? `<span class="meta-tag highlight">&lt;${c.tagName}&gt;</span>` : '',
      c.id       ? `<span class="meta-tag">#${c.id}</span>` : '',
      c.type     ? `<span class="meta-tag">type="${c.type}"</span>` : '',
      c.className ? `<span class="meta-tag">.${c.className.split(' ')[0]}</span>` : '',
    ].filter(Boolean).join('');

    li.innerHTML = `
      <div class="candidate-header">
        <span class="candidate-rank">Candidate #${index + 1}</span>
        <span class="candidate-confidence confidence-${cls}">${label} (${c.score}%)</span>
      </div>
      <div class="candidate-meta">${metaTags}</div>
      ${c.placeholder ? `<div class="candidate-signals" style="margin-bottom:4px;color:var(--text-muted)">
        placeholder: "<em style="color:var(--text-primary)">${c.placeholder}</em>"
      </div>` : ''}
      ${c.ariaLabel ? `<div class="candidate-signals" style="margin-bottom:4px;color:var(--text-muted)">
        aria-label: "<em style="color:var(--text-primary)">${c.ariaLabel}</em>"
      </div>` : ''}
      <div class="candidate-signals">Signals: ${pillsHtml}</div>
    `;

    candidatesList.appendChild(li);
  });
}

// ── Main: handle test button click ───────────────────────
testBtn.addEventListener('click', async () => {
  // Reset UI
  clearError();
  candidatesWrap.classList.remove('visible');
  candidatesList.innerHTML = '';
  [cardUrl, cardTitle, cardCount].forEach(c => c.classList.remove('visible'));
  setCardValue(valUrl, '—');
  setCardValue(valTitle, '—');
  setCardValue(valCount, '—');

  testBtn.disabled = true;
  setStatus('running');
  log('[Popup] Test Omni clicked.', 'info');

  try {
    // ── 1. Get active tab ─────────────────────────────────
    log('[Popup] Querying active tab…', 'info');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showError('No active tab found.');
      return;
    }

    log(`[Popup] Active tab: ${tab.url}`, 'info');

    // Guard against restricted pages (chrome://, about:, etc.)
    const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];
    const isRestricted = restrictedPrefixes.some(p => tab.url?.startsWith(p));

    if (isRestricted) {
      showError('Cannot access browser internal pages. Open a regular website and try again.');
      return;
    }

    // ── 2. Inject content.js ──────────────────────────────
    log('[Popup] Injecting content.js into tab…', 'info');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      log('[Popup] content.js injected successfully.', 'ok');
    } catch (injectErr) {
      showError(`Injection failed: ${injectErr.message}`);
      return;
    }

    // ── 3. Send scan command to content script ────────────
    log('[Popup] Sending SCAN_PAGE message to content script…', 'info');

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: 'OMNIFLOW_SCAN' });
    } catch (msgErr) {
      showError(`Could not reach content script: ${msgErr.message}`);
      return;
    }

    if (!result) {
      showError('Content script returned no data.');
      return;
    }

    if (result.error) {
      showError(result.error);
      return;
    }

    // ── 4. Render results ─────────────────────────────────
    log('[Popup] Results received. Rendering UI…', 'ok');
    log(`[Popup] Title: ${result.title}`, 'info');
    log(`[Popup] URL: ${result.url}`, 'info');
    log(`[Popup] Elements found: ${result.elementCount}`, 'info');
    log(`[Popup] Candidates: ${result.candidates?.length ?? 0}`, 'ok');

    setCardValue(valUrl, result.url || 'Unknown');
    setCardValue(valTitle, result.title || 'Untitled');
    setCardValue(valCount, result.candidates?.length ?? 0);
    revealCards();
    renderCandidates(result.candidates);

    setStatus('success');
    log('[Popup] Scan complete ✓', 'ok');

  } catch (err) {
    showError(`Unexpected error: ${err.message}`);
  } finally {
    testBtn.disabled = false;
  }
});

// ── Phase 1: inject button click ──────────────────────────
if (injectBtn) {
  injectBtn.addEventListener('click', async () => {
    clearError();
    hideInjectPanel();

    injectBtn.disabled = true;
    testBtn.disabled = true;
    setStatus('running');
    log('[Popup] Test Prompt Injection clicked.', 'info');

    try {
      // 1. Get active tab
      log('[Popup] Querying active tab…', 'info');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showError('No active tab found.');
        return;
      }

      log(`[Popup] Active tab: ${tab.url}`, 'info');

      const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];
      if (restrictedPrefixes.some(p => tab.url?.startsWith(p))) {
        showError('Cannot access browser internal pages.');
        return;
      }

      // 2. (Re-)inject content.js
      log('[Popup] Injecting content.js…', 'info');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        log('[Popup] content.js injected.', 'ok');
      } catch (injectErr) {
        showError(`Injection failed: ${injectErr.message}`);
        return;
      }

      // 3. Send OMNIFLOW_INJECT command
      log('[Popup] Sending OMNIFLOW_INJECT to content script…', 'info');
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, {
          type: 'OMNIFLOW_INJECT',
          text: 'Hello from OmniFlow',
        });
      } catch (msgErr) {
        showError(`Could not reach content script: ${msgErr.message}`);
        return;
      }

      if (!result) {
        showError('Content script returned no data.');
        return;
      }

      // 4. Render result
      if (result.success) {
        log(`[Popup] Injection SUCCESS. Detected text: "${result.text}"`, 'ok');
        showInjectResult('success', result.text);
        setStatus('success');
      } else {
        log(`[Popup] Injection FAILED. Reason: ${result.error || 'unknown'}`, 'error');
        showInjectResult('failed', result.text || '');
        showError(result.error || 'Injection failed — editor not found or text mismatch.');
      }

    } catch (err) {
      showError(`Unexpected error: ${err.message}`);
    } finally {
      injectBtn.disabled = false;
      testBtn.disabled = false;
    }
  });
}

// ── Log toggle ────────────────────────────────────────────
logToggle.addEventListener('click', () => {
  const isOpen = logBox.classList.toggle('open');
  toggleArrow.classList.toggle('open', isOpen);
  logToggle.setAttribute('aria-expanded', String(isOpen));
  logBox.setAttribute('aria-hidden', String(!isOpen));
});

// ── Boot log ──────────────────────────────────────────────
log('[Popup] OmniFlow Phase 1 popup loaded.', 'ok');
