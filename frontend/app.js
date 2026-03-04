/**
 * app.js – Befit frontend controller
 *
 * Flow:
 *   1. User picks / drags an image  → stored as base-64 data URI
 *   2. User types (or speaks) a wellness question
 *   3. Submit → POST /scan-and-plan → today_card JSON
 *   4. Render card into DOM
 *   5. ElevenLabs TTS auto-reads the plan via POST /tts (proxied, key stays server-side)
 *
 * TTS voice commands (spoken while audio is playing or paused):
 *   "play"  | "start"   → play / resume
 *   "pause"             → pause
 *   "stop"              → stop and rewind
 *   "restart"           → re-fetch and play from the beginning
 *
 * Voice commands use a dedicated continuous SpeechRecognition session
 * (cmdRecognition) that runs only while TTS is active. This is separate
 * from the query mic so commands never appear in the query box, and
 * continuous=true keeps the session alive across the full audio playback.
 */

'use strict';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const uploadArea        = document.getElementById('upload-area');
const fileInput         = document.getElementById('file-input');
const previewImg        = document.getElementById('preview-img');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const userQuery         = document.getElementById('user-query');
const ctxGoal           = document.getElementById('ctx-goal');
const ctxPerson         = document.getElementById('ctx-person');
const ctxConstraints    = document.getElementById('ctx-constraints');
const btnSubmit         = document.getElementById('btn-submit');
const btnLabel          = document.getElementById('btn-label');
const btnSpinner        = document.getElementById('btn-spinner');
const errorBanner       = document.getElementById('error-banner');
const todayCardEl       = document.getElementById('today-card');
const btnReset          = document.getElementById('btn-reset');
const btnResetQuery     = document.getElementById('btn-reset-query');

const tcGoal         = document.getElementById('tc-goal');
const tcItems        = document.getElementById('tc-items');
const tcFlags        = document.getElementById('tc-flags');
const tcActions      = document.getElementById('tc-actions');
const tcWhy          = document.getElementById('tc-why');
const tcLimitations  = document.getElementById('tc-limitations');
const tcItemsSection = document.getElementById('tc-items-section');
const tcFlagsSection = document.getElementById('tc-flags-section');

// ── STT DOM refs ──────────────────────────────────────────────────────────────
const btnMic         = document.getElementById('btn-mic');
const micIcon        = document.getElementById('mic-icon');
const toggleAlwaysOn = document.getElementById('toggle-always-on');
const micStatus      = document.getElementById('mic-status');
const micError       = document.getElementById('mic-error');

// ── TTS DOM refs ──────────────────────────────────────────────────────────────
const ttsBar        = document.getElementById('tts-bar');
const btnTtsPlay    = document.getElementById('btn-tts-play');
const btnTtsPause   = document.getElementById('btn-tts-pause');
const btnTtsStop    = document.getElementById('btn-tts-stop');
const btnTtsRestart = document.getElementById('btn-tts-restart');
const ttsStatus     = document.getElementById('tts-status');

// ── App state ─────────────────────────────────────────────────────────────────
let imageDataUri = null;

// ── Query STT state ───────────────────────────────────────────────────────────
let recognition = null;   // SpeechRecognition for query input
let isListening = false;
let alwaysOn    = false;

// ── TTS command listener state ────────────────────────────────────────────────
// A dedicated continuous SpeechRecognition session active only while TTS plays.
// Runs independently from the query mic: commands never appear in the query box.
let cmdRecognition = null;
let cmdListening   = false;

// ── TTS playback state ────────────────────────────────────────────────────────
/** @type {HTMLAudioElement|null} */
let ttsAudio    = null;
let ttsText     = '';
let ttsFetching = false;

// ── Image selection ───────────────────────────────────────────────────────────
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    imageDataUri = e.target.result;
    previewImg.src = imageDataUri;
    previewImg.style.display = 'block';
    uploadPlaceholder.style.display = 'none';
    updateSubmitState();
  };
  reader.readAsDataURL(file);
});

// ── Drag-and-drop ─────────────────────────────────────────────────────────────
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--color-primary)';
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = '';
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── Submit guard ──────────────────────────────────────────────────────────────
userQuery.addEventListener('input', updateSubmitState);

function updateSubmitState() {
  btnSubmit.disabled = !(imageDataUri && userQuery.value.trim().length > 0);
}

// ── Submit ────────────────────────────────────────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  if (btnSubmit.disabled) return;
  await runPipeline();
});

async function runPipeline() {
  setLoading(true);
  hideError();
  todayCardEl.style.display = 'none';
  ttsReset();

  const body = {
    image_url:    imageDataUri,
    user_query:   userQuery.value.trim(),
    user_context: buildContext(),
  };

  try {
    const res = await fetch('/scan-and-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail; } catch (_) { detail = await res.text(); }
      throw new Error('Server error ' + res.status + ': ' + detail);
    }

    const card = await res.json();
    renderCard(card);
    todayCardEl.style.display = 'flex';
    todayCardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    ttsText = buildTtsScript(card);
    ttsPlay();
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

function buildContext() {
  const goal        = ctxGoal.value.trim();
  const person      = ctxPerson.value.trim();
  const rawConst    = ctxConstraints.value.trim();
  const constraints = rawConst
    ? rawConst.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  if (!goal && !person && !constraints.length) return null;
  return Object.assign(
    {},
    goal               ? { goal }        : {},
    person             ? { person }      : {},
    constraints.length ? { constraints } : {},
  );
}

// ── Render TodayCard ──────────────────────────────────────────────────────────
function renderCard(card) {
  tcGoal.textContent = card.goal_summary || '';

  tcItems.innerHTML = '';
  if (card.items_detected && card.items_detected.length) {
    tcItemsSection.style.display = '';
    card.items_detected.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = esc(item.name) +
        (item.category ? '<span class="chip-category">' + esc(item.category) + '</span>' : '');
      if (item.notes) li.title = item.notes;
      tcItems.appendChild(li);
    });
  } else {
    tcItemsSection.style.display = 'none';
  }

  tcFlags.innerHTML = '';
  const flags = card.risk_flags || [];
  const showInfo = flags.length <= 3;
  const visibleFlags = flags.filter(f => f.level !== 'info' || showInfo);
  if (visibleFlags.length) {
    tcFlagsSection.style.display = '';
    visibleFlags.forEach(flag => {
      const li = document.createElement('li');
      li.className = 'flag-item flag-' + esc(flag.level);
      li.textContent = flag.message;
      tcFlags.appendChild(li);
    });
  } else {
    tcFlagsSection.style.display = 'none';
  }

  tcActions.innerHTML = '';
  (card.actions || []).forEach((action, i) => {
    const li = document.createElement('li');
    li.className = 'action-item';
    li.innerHTML =
      '<div class="action-number" aria-hidden="true">' + (i + 1) + '</div>' +
      '<div class="action-body">' +
        '<div class="action-title">' + esc(action.title) + '</div>' +
        '<div class="action-desc">'  + esc(action.description) + '</div>' +
      '</div>';
    tcActions.appendChild(li);
  });

  tcWhy.textContent         = card.why         || '';
  tcLimitations.textContent = card.limitations || '';
}

// ── Reset query only ──────────────────────────────────────────────────────────
btnResetQuery.addEventListener('click', () => {
  userQuery.value = '';
  ctxGoal.value = '';
  ctxPerson.value = '';
  ctxConstraints.value = '';
  hideError();
  updateSubmitState();
  alwaysOn = false;
  toggleAlwaysOn.checked = false;
  stopListening();
  hideMicError();
  updateMicUI();
  userQuery.focus();
});

// ── Full reset ────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  imageDataUri = null;
  fileInput.value = '';
  previewImg.src = '';
  previewImg.style.display = 'none';
  uploadPlaceholder.style.display = '';
  userQuery.value = '';
  ctxGoal.value = '';
  ctxPerson.value = '';
  ctxConstraints.value = '';
  todayCardEl.style.display = 'none';
  hideError();
  updateSubmitState();
  alwaysOn = false;
  toggleAlwaysOn.checked = false;
  stopListening();
  hideMicError();
  micStatus.textContent = '';
  updateMicUI();
  ttsReset();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(on) {
  btnSubmit.disabled = on;
  btnLabel.textContent = on ? 'Analyzing…' : "Get Today's Plan";
  btnSpinner.style.display = on ? 'inline-block' : 'none';
}

function showError(msg) {
  errorBanner.textContent = '⚠️  ' + msg;
  errorBanner.style.display = '';
}
function hideError() {
  errorBanner.textContent = '';
  errorBanner.style.display = 'none';
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Query STT helpers ─────────────────────────────────────────────────────────
function showMicError(msg) { micError.textContent = '🎙️ ' + msg; micError.style.display = ''; }
function hideMicError()    { micError.textContent = '';                            micError.style.display = 'none'; }

function updateMicUI() {
  if (isListening) {
    btnMic.setAttribute('aria-pressed', 'true');
    btnMic.classList.add('mic-active');
    micIcon.textContent = '⏹️';
    btnMic.setAttribute('aria-label', 'Stop voice input');
    micStatus.textContent = 'Listening…';
  } else {
    btnMic.setAttribute('aria-pressed', 'false');
    btnMic.classList.remove('mic-active');
    micIcon.textContent = '🎙️';
    btnMic.setAttribute('aria-label', 'Start voice input');
    micStatus.textContent = '';
  }
}

function startListening() {
  if (!recognition) return;
  try { recognition.stop(); } catch (_) { /* ignore */ }
  recognition.start();
}

function stopListening() {
  if (!recognition) return;
  try { recognition.stop(); } catch (_) { /* ignore */ }
}

// ── initSpeech – query mic ────────────────────────────────────────────────────
function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btnMic.disabled = true;
    btnMic.title = 'Speech recognition not supported in this browser';
    if (toggleAlwaysOn && toggleAlwaysOn.parentElement) {
      toggleAlwaysOn.parentElement.style.display = 'none';
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  let finalTranscript = '', interimTranscript = '';

  recognition.onstart = () => {
    isListening = true;
    finalTranscript = interimTranscript = '';
    updateMicUI();
  };

  recognition.onend = () => {
    isListening = false;
    updateMicUI();
    if (alwaysOn) setTimeout(() => { if (alwaysOn) startListening(); }, 300);
  };

  recognition.onerror = (event) => {
    isListening = false;
    updateMicUI();
    if (event.error !== 'no-speech') {
      showMicError(event.error || 'Microphone error. Please try again.');
    }
  };

  recognition.onresult = (event) => {
    finalTranscript = interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalTranscript  += r[0].transcript;
      else           interimTranscript += r[0].transcript;
    }
    userQuery.value = finalTranscript + interimTranscript;

    if (event.results[event.results.length - 1].isFinal) {
      interimTranscript = '';
      userQuery.value   = finalTranscript.trim();
      updateSubmitState();
      hideMicError();
    }
  };

  // ── initCmdListener – TTS voice command mic ─────────────────────────────────
  // Uses a second, independent SpeechRecognition instance with continuous=true
  // so it stays open through the full audio playback without polling gaps.
  cmdRecognition = new SpeechRecognition();
  cmdRecognition.continuous     = true;   // stay open; don't stop between phrases
  cmdRecognition.interimResults = false;  // only act on settled results
  cmdRecognition.lang           = 'en-US';

  cmdRecognition.onstart = () => { cmdListening = true; };
  cmdRecognition.onend   = () => {
    cmdListening = false;
    // If TTS is still active, restart the command listener automatically
    if (ttsAudio && !ttsAudio.ended) {
      setTimeout(() => {
        if (ttsAudio && !ttsAudio.ended) startCmdListener();
      }, 150);
    }
  };
  cmdRecognition.onerror = (event) => {
    cmdListening = false;
    // 'no-speech' and 'aborted' are expected; restart silently if TTS still running
    if (ttsAudio && !ttsAudio.ended && event.error !== 'aborted') {
      setTimeout(() => startCmdListener(), 300);
    }
  };
  cmdRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      const cmd = event.results[i][0].transcript
        .toLowerCase()
        .replace(/[^a-z ]/g, '')
        .trim();
      if (cmd === 'play' || cmd === 'start') { ttsPlay();    break; }
      if (cmd === 'pause')                   { ttsPause();   break; }
      if (cmd === 'stop')                    { ttsStop();    break; }
      if (cmd === 'restart')                 { ttsRestart(); break; }
    }
  };
}

function startCmdListener() {
  if (!cmdRecognition || cmdListening) return;
  try { cmdRecognition.start(); } catch (_) { /* already running */ }
}

function stopCmdListener() {
  if (!cmdRecognition) return;
  try { cmdRecognition.stop(); } catch (_) { /* ignore */ }
  cmdListening = false;
}

// ── Mic button / always-on toggle ─────────────────────────────────────────────
btnMic.addEventListener('click', () => {
  hideMicError();
  if (isListening) {
    alwaysOn = false;
    toggleAlwaysOn.checked = false;
    stopListening();
  } else {
    startListening();
  }
});

toggleAlwaysOn.addEventListener('change', () => {
  alwaysOn = toggleAlwaysOn.checked;
  if (alwaysOn && !isListening) startListening();
  else if (!alwaysOn && isListening) stopListening();
});

// ── TTS – build plain-text script from card ───────────────────────────────────
function buildTtsScript(card) {
  const parts = [];
  if (card.goal_summary) parts.push(card.goal_summary + '.');
  (card.actions || []).forEach((a, i) => {
    parts.push('Action ' + (i + 1) + ': ' + a.title + '. ' + a.description);
  });
  if (card.why) parts.push('Why this matters: ' + card.why);
  // Limitations are visual-only per LIMITATIONS.md – not read aloud
  return parts.join(' ');
}

// ── TTS – core ────────────────────────────────────────────────────────────────

async function ttsPlay() {
  if (ttsFetching) return;

  // Resume paused audio without a new network request
  if (ttsAudio && ttsAudio.paused && ttsAudio.currentSrc) {
    ttsAudio.play();
    updateTtsUI('playing');
    startCmdListener();
    return;
  }

  // Already playing
  if (ttsAudio && !ttsAudio.paused) return;

  if (!ttsText) return;
  ttsFetching = true;
  updateTtsUI('loading');

  try {
    const res = await fetch('/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: ttsText }),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail; } catch (_) { detail = await res.text(); }
      throw new Error('TTS error ' + res.status + ': ' + detail);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    if (ttsAudio) { ttsAudio.pause(); URL.revokeObjectURL(ttsAudio.src); }

    ttsAudio = new Audio(url);
    ttsAudio.onplay  = () => { updateTtsUI('playing'); startCmdListener(); };
    ttsAudio.onpause = () => { updateTtsUI('paused');  /* keep cmd listener alive while paused */ };
    ttsAudio.onended = () => { updateTtsUI('idle');    stopCmdListener(); };
    ttsAudio.onerror = () => { updateTtsUI('idle');    stopCmdListener(); };
    ttsAudio.play();
  } catch (err) {
    updateTtsUI('idle');
    stopCmdListener();
    ttsStatus.textContent = '⚠️ Audio unavailable';
    console.warn('TTS play error:', err.message);
  } finally {
    ttsFetching = false;
  }
}

function ttsPause() {
  if (ttsAudio && !ttsAudio.paused) ttsAudio.pause();
  // cmd listener stays alive so user can say "play" to resume
}

function ttsStop() {
  if (ttsAudio) {
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
  }
  stopCmdListener();
  updateTtsUI('idle');
}

function ttsRestart() {
  if (ttsAudio) {
    ttsAudio.pause();
    URL.revokeObjectURL(ttsAudio.src);
    ttsAudio = null;
  }
  stopCmdListener();
  ttsPlay();
}

/** Full teardown – called on reset. */
function ttsReset() {
  if (ttsAudio) {
    ttsAudio.pause();
    URL.revokeObjectURL(ttsAudio.src);
    ttsAudio = null;
  }
  stopCmdListener();
  ttsText     = '';
  ttsFetching = false;
  updateTtsUI('hidden');
}

// ── TTS – UI state machine ────────────────────────────────────────────────────
/**
 * @param {'hidden'|'loading'|'playing'|'paused'|'idle'} state
 */
function updateTtsUI(state) {
  const show = (el, yes) => { el.style.display = yes ? '' : 'none'; };

  if (state === 'hidden') {
    ttsBar.style.display  = 'none';
    ttsStatus.textContent = '';
    return;
  }

  ttsBar.style.display = '';

  show(btnTtsPlay,    state === 'idle'  || state === 'paused' || state === 'loading');
  show(btnTtsPause,   state === 'playing');
  show(btnTtsStop,    state === 'playing' || state === 'paused');
  show(btnTtsRestart, state === 'playing' || state === 'paused' || state === 'idle');

  btnTtsPlay.disabled = state === 'loading';

  const labels = { loading: '⏳ Loading audio…', playing: '🔊 Playing…', paused: '⏸ Paused', idle: '' };
  ttsStatus.textContent = labels[state] ?? '';
}

// ── TTS – button handlers ─────────────────────────────────────────────────────
btnTtsPlay.addEventListener('click',    () => ttsPlay());
btnTtsPause.addEventListener('click',   () => ttsPause());
btnTtsStop.addEventListener('click',    () => ttsStop());
btnTtsRestart.addEventListener('click', () => ttsRestart());

// ── Boot ──────────────────────────────────────────────────────────────────────
initSpeech();
