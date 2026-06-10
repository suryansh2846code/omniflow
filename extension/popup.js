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

// Phase 2 refs
const generateBtn      = document.getElementById('generateBtn');
const generatePanel    = document.getElementById('generatePanel');
const genEditorFound   = document.getElementById('genEditorFound');
const genPromptInjected = document.getElementById('genPromptInjected');
const genButtonFound   = document.getElementById('genButtonFound');
const genButtonClicked = document.getElementById('genButtonClicked');
const genStrategy      = document.getElementById('genStrategy');
const genButtonText    = document.getElementById('genButtonText');

// Phase 2.2 refs
const inspectBtn           = document.getElementById('inspectBtn');
const composerInspectPanel = document.getElementById('composerInspectPanel');
const inspectComposerFound = document.getElementById('inspectComposerFound');
const inspectButtonsFound  = document.getElementById('inspectButtonsFound');
const inspectButtonsWrap   = document.getElementById('inspectButtonsWrap');
const inspectButtonsList   = document.getElementById('inspectButtonsList');

// Phase 3 refs
const generationStatusPanel = document.getElementById('generationStatusPanel');
const statusStateBadge      = document.getElementById('statusStateBadge');
const statusTimerVal        = document.getElementById('statusTimerVal');

// Poll interval ID
let statusPollIntervalId = null;

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

// ── Phase 2: generation panel helpers ───────────────────────
/**
 * Set a gen-row value element with boolean styling.
 * @param {HTMLElement} el
 * @param {boolean|null} value  null = reset
 * @param {string} [trueLabel]  custom text when true
 * @param {string} [falseLabel] custom text when false
 */
function setGenBool(el, value, trueLabel = 'yes', falseLabel = 'no') {
  el.className = 'gen-row-val';
  if (value === null) {
    el.textContent = '—';
    return;
  }
  el.classList.add(value ? 'val-true' : 'val-false');
  el.textContent = value ? trueLabel : falseLabel;
}

/**
 * Populate the generation result panel with response data.
 * @param {Object} r - OMNIFLOW_GENERATE response
 */
function renderGenerateResult(r) {
  generatePanel.classList.add('visible');

  setGenBool(genEditorFound,    r.editorFound,    '', '');
  setGenBool(genPromptInjected, r.promptInjected, '', '');
  setGenBool(genButtonFound,    r.buttonFound,    '', '');
  setGenBool(genButtonClicked,  r.buttonClicked,  '', '');

  // Strategy
  genStrategy.className = 'gen-row-val';
  genStrategy.textContent = r.strategyUsed || '—';

  // Button text / label
  genButtonText.className = 'gen-row-val';
  genButtonText.textContent = r.buttonText || '—';
}

function hideGeneratePanel() {
  generatePanel.classList.remove('visible');
  [genEditorFound, genPromptInjected, genButtonFound, genButtonClicked, genStrategy, genButtonText]
    .forEach(el => {
      el.className = 'gen-row-val';
      el.textContent = '—';
    });
}

/**
 * Render the results of the Composer Inspection in the popup.
 * @param {Object} r - OMNIFLOW_INSPECT_COMPOSER response
 */
function renderInspectResult(r) {
  composerInspectPanel.classList.add('visible');
  setGenBool(inspectComposerFound, r.composerFound, '', '');
  
  if (r.composerFound) {
    inspectButtonsFound.className = 'inspect-row-val val-true';
    inspectButtonsFound.textContent = r.buttonsCount || '0';
    
    inspectButtonsList.innerHTML = '';
    if (r.buttons && r.buttons.length > 0) {
      inspectButtonsWrap.style.display = 'flex';
      r.buttons.forEach((btn) => {
        const li = document.createElement('li');
        li.className = 'inspect-button-item';
        
        const coords = `L:${btn.left} R:${btn.right} T:${btn.top} B:${btn.bottom}`;
        const attrs = [
          btn.role ? `role="${btn.role}"` : '',
          btn.disabled ? 'disabled' : 'enabled'
        ].filter(Boolean).join(' | ');

        li.innerHTML = `
          <div class="inspect-btn-title">
            <span class="inspect-btn-name">#${btn.index} "${btn.text}"</span>
            <span class="inspect-btn-tag">&lt;button&gt;</span>
          </div>
          <div class="inspect-btn-coords">${coords}</div>
          <div class="inspect-btn-attrs">${attrs}</div>
        `;
        inspectButtonsList.appendChild(li);
      });
    } else {
      inspectButtonsWrap.style.display = 'none';
    }
  } else {
    inspectButtonsFound.className = 'inspect-row-val';
    inspectButtonsFound.textContent = '—';
    inspectButtonsWrap.style.display = 'none';
    inspectButtonsList.innerHTML = '';
  }
}

function hideInspectPanel() {
  composerInspectPanel.classList.remove('visible');
  inspectComposerFound.className = 'inspect-row-val';
  inspectComposerFound.textContent = '—';
  inspectButtonsFound.className = 'inspect-row-val';
  inspectButtonsFound.textContent = '—';
  inspectButtonsWrap.style.display = 'none';
  inspectButtonsList.innerHTML = '';
}

/**
 * Update the generation status panel elements.
 * @param {Object} s - status object { status, elapsedSeconds }
 */
function updateStatusPanel(s) {
  generationStatusPanel.classList.add('visible');
  
  statusStateBadge.className = 'status-state-badge';
  
  switch (s.status) {
    case 'completed':
      statusStateBadge.classList.add('badge-completed');
      statusStateBadge.textContent = 'Completed';
      break;
    case 'generating':
      statusStateBadge.classList.add('badge-generating');
      statusStateBadge.textContent = 'Generating';
      break;
    case 'no_gen_detected':
      statusStateBadge.classList.add('badge-no-gen');
      statusStateBadge.textContent = 'No Generation Detected';
      break;
    case 'timeout':
      statusStateBadge.classList.add('badge-timeout');
      statusStateBadge.textContent = 'Timed Out';
      break;
    case 'waiting':
    default:
      statusStateBadge.classList.add('badge-waiting');
      statusStateBadge.textContent = 'Waiting';
      break;
  }
  
  statusTimerVal.textContent = `${s.elapsedSeconds || 0}s`;
}

function hideStatusPanel() {
  generationStatusPanel.classList.remove('visible');
  statusStateBadge.className = 'status-state-badge badge-waiting';
  statusStateBadge.textContent = 'Waiting';
  statusTimerVal.textContent = '0s';
}

/**
 * Starts polling the content script for generation status.
 * @param {number} tabId
 */
function startStatusPolling(tabId) {
  // Clear any existing poll
  if (statusPollIntervalId) {
    clearInterval(statusPollIntervalId);
  }

  log('[Popup] Generation started', 'ok');
  updateStatusPanel({ status: 'waiting', elapsedSeconds: 0 });

  // Disable UI buttons during generation
  generateBtn.disabled = true;
  injectBtn.disabled   = true;
  testBtn.disabled     = true;
  if (inspectBtn) inspectBtn.disabled = true;
  setStatus('running');

  statusPollIntervalId = setInterval(async () => {
    try {
      const status = await chrome.tabs.sendMessage(tabId, { type: 'OMNIFLOW_GET_STATUS' });
      
      if (!status) {
        log('[Popup] Status check returned empty result', 'warn');
        return;
      }

      updateStatusPanel(status);

      if (status.status === 'generating') {
        log('[Popup] Generation in progress', 'info');
      } else if (status.status === 'no_gen_detected') {
        log('[Popup] Generation aborted: No generation detected within 15 seconds.', 'warn');
        showError('No generation detected. Check if prompt was sent.');
        clearInterval(statusPollIntervalId);
        statusPollIntervalId = null;
        setStatus('error');
        
        generateBtn.disabled = false;
        injectBtn.disabled   = false;
        testBtn.disabled     = false;
        if (inspectBtn) inspectBtn.disabled = false;
      } else if (status.status === 'timeout') {
        log('[Popup] Generation aborted: Timed out after 5 minutes.', 'error');
        showError('Generation timed out (5-minute limit exceeded).');
        clearInterval(statusPollIntervalId);
        statusPollIntervalId = null;
        setStatus('error');
        
        generateBtn.disabled = false;
        injectBtn.disabled   = false;
        testBtn.disabled     = false;
        if (inspectBtn) inspectBtn.disabled = false;
      } else if (status.status === 'completed') {
        log('[Popup] Generation completed', 'ok');
        clearInterval(statusPollIntervalId);
        statusPollIntervalId = null;
        setStatus('success');
        
        generateBtn.disabled = false;
        injectBtn.disabled   = false;
        testBtn.disabled     = false;
        if (inspectBtn) inspectBtn.disabled = false;
      }
    } catch (err) {
      log(`[Popup] Status check failed: ${err.message}`, 'error');
      clearInterval(statusPollIntervalId);
      statusPollIntervalId = null;
      setStatus('error');
      showError(`Status tracking error: ${err.message}`);
      
      generateBtn.disabled = false;
      injectBtn.disabled   = false;
      testBtn.disabled     = false;
      if (inspectBtn) inspectBtn.disabled = false;
    }
  }, 1000);
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

testBtn.addEventListener('click', async () => {
  // Reset UI
  clearError();
  hideInjectPanel();
  hideGeneratePanel();
  hideInspectPanel();
  hideStatusPanel();
  if (statusPollIntervalId) {
    clearInterval(statusPollIntervalId);
    statusPollIntervalId = null;
  }
  candidatesWrap.classList.remove('visible');
  candidatesList.innerHTML = '';
  [cardUrl, cardTitle, cardCount].forEach(c => c.classList.remove('visible'));
  setCardValue(valUrl, '—');
  setCardValue(valTitle, '—');
  setCardValue(valCount, '—');

  testBtn.disabled = true;
  if (injectBtn) injectBtn.disabled = true;
  if (generateBtn) generateBtn.disabled = true;
  if (inspectBtn) inspectBtn.disabled = true;
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
    if (injectBtn) injectBtn.disabled = false;
    if (generateBtn) generateBtn.disabled = false;
    if (inspectBtn) inspectBtn.disabled = false;
  }
});

if (injectBtn) {
  injectBtn.addEventListener('click', async () => {
    clearError();
    hideInjectPanel();
    hideGeneratePanel();
    hideInspectPanel();
    hideStatusPanel();
    if (statusPollIntervalId) {
      clearInterval(statusPollIntervalId);
      statusPollIntervalId = null;
    }

    injectBtn.disabled = true;
    testBtn.disabled = true;
    if (generateBtn) generateBtn.disabled = true;
    if (inspectBtn) inspectBtn.disabled = true;
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
      if (generateBtn) generateBtn.disabled = false;
      if (inspectBtn) inspectBtn.disabled = false;
    }
  });
}

if (generateBtn) {
  generateBtn.addEventListener('click', async () => {
    clearError();
    hideGeneratePanel();
    hideInjectPanel();
    hideInspectPanel();
    hideStatusPanel();
    if (statusPollIntervalId) {
      clearInterval(statusPollIntervalId);
      statusPollIntervalId = null;
    }

    generateBtn.disabled = true;
    injectBtn.disabled   = true;
    testBtn.disabled     = true;
    if (inspectBtn) inspectBtn.disabled = true;
    setStatus('running');
    log('[Popup] Test Generate Click clicked.', 'info');

    try {
      // 1. Get active tab
      log('[Popup] Querying active tab…', 'info');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) { showError('No active tab found.'); return; }

      log(`[Popup] Active tab: ${tab.url}`, 'info');

      const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];
      if (restrictedPrefixes.some(p => tab.url?.startsWith(p))) {
        showError('Cannot access browser internal pages.');
        return;
      }

      // 2. Inject content.js
      log('[Popup] Injecting content.js…', 'info');
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        log('[Popup] content.js injected.', 'ok');
      } catch (injectErr) {
        showError(`Injection failed: ${injectErr.message}`);
        return;
      }

      // 3. Send OMNIFLOW_GENERATE
      log('[Popup] Sending OMNIFLOW_GENERATE to content script…', 'info');
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, { type: 'OMNIFLOW_GENERATE' });
      } catch (msgErr) {
        showError(`Could not reach content script: ${msgErr.message}`);
        return;
      }

      if (!result) { showError('Content script returned no data.'); return; }

      // 4. Render result
      log(`[Popup] GENERATE result received. success=${result.success}`, result.success ? 'ok' : 'warn');
      log(`[Popup] editorFound=${result.editorFound}, promptInjected=${result.promptInjected}`, 'info');
      log(`[Popup] buttonFound=${result.buttonFound}, buttonClicked=${result.buttonClicked}`, 'info');
      if (result.strategyUsed) log(`[Popup] Strategy used: ${result.strategyUsed}`, 'ok');
      if (result.error)        log(`[Popup] Error: ${result.error}`, 'error');

      renderGenerateResult(result);
      setStatus(result.success ? 'success' : 'error');

      if (!result.success) {
        showError(result.error || 'Generate automation failed.');
      } else {
        // Start status tracking polling
        startStatusPolling(tab.id);
      }

    } catch (err) {
      showError(`Unexpected error: ${err.message}`);
    } finally {
      if (!statusPollIntervalId) {
        generateBtn.disabled = false;
        injectBtn.disabled   = false;
        testBtn.disabled     = false;
        if (inspectBtn) inspectBtn.disabled = false;
      }
    }
  });
}

// ── Phase 2.2: inspect button click ───────────────────────
if (inspectBtn) {
  inspectBtn.addEventListener('click', async () => {
    clearError();
    hideInspectPanel();
    hideInjectPanel();
    hideGeneratePanel();
    hideStatusPanel();
    if (statusPollIntervalId) {
      clearInterval(statusPollIntervalId);
      statusPollIntervalId = null;
    }

    inspectBtn.disabled  = true;
    generateBtn.disabled = true;
    injectBtn.disabled   = true;
    testBtn.disabled     = true;
    setStatus('running');
    log('[Popup] Test Inspect Composer clicked.', 'info');

    try {
      // 1. Get active tab
      log('[Popup] Querying active tab…', 'info');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) { showError('No active tab found.'); return; }

      log(`[Popup] Active tab: ${tab.url}`, 'info');

      const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];
      if (restrictedPrefixes.some(p => tab.url?.startsWith(p))) {
        showError('Cannot access browser internal pages.');
        return;
      }

      // 2. Inject content.js
      log('[Popup] Injecting content.js…', 'info');
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        log('[Popup] content.js injected.', 'ok');
      } catch (injectErr) {
        showError(`Injection failed: ${injectErr.message}`);
        return;
      }

      // 3. Send OMNIFLOW_INSPECT_COMPOSER
      log('[Popup] Sending OMNIFLOW_INSPECT_COMPOSER to content script…', 'info');
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, { type: 'OMNIFLOW_INSPECT_COMPOSER' });
      } catch (msgErr) {
        showError(`Could not reach content script: ${msgErr.message}`);
        return;
      }

      if (!result) { showError('Content script returned no data.'); return; }

      // 4. Render result
      log(`[Popup] INSPECT result received. success=${result.success}`, result.success ? 'ok' : 'warn');
      if (result.error) log(`[Popup] Error: ${result.error}`, 'error');

      // Log composer buttons to diagnostic log
      if (result.success && result.buttons) {
        log(`[Popup] Composer selected`, 'ok');
        result.buttons.forEach((btn) => {
          log(`[Popup] Button #${btn.index} text="${btn.text}"`, 'info');
        });
      }

      renderInspectResult(result);
      setStatus(result.success ? 'success' : 'error');

      if (!result.success) {
        showError(result.error || 'Composer inspection failed.');
      }

    } catch (err) {
      showError(`Unexpected error: ${err.message}`);
    } finally {
      inspectBtn.disabled  = false;
      generateBtn.disabled = false;
      injectBtn.disabled   = false;
      testBtn.disabled     = false;
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
log('[Popup] OmniFlow Phase 3.1 popup loaded.', 'ok');
updateStatusPanel({ status: 'waiting', elapsedSeconds: 0 });
