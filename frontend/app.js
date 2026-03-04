/**
 * app.js – Befit frontend controller
 *
 * Flow:
 *   1. Camera feed starts on load; user points device at pantry/fridge/cabinet.
 *   2. "Capture" snaps a frame → base-64 data URI (same path as file upload).
 *      File upload ("Upload image") is always available as fallback.
 *   3. User types or speaks a wellness question.
 *   4. Submit → POST /scan-and-plan → today_card JSON.
 *   5. Render card; ElevenLabs TTS auto-reads the plan via POST /tts.
 *
 * TTS voice commands (spoken while audio plays/paused):
 *   "play"|"start" → play/resume  "pause" → pause
 *   "stop"         → stop/rewind  "restart" → re-fetch and play
 *
 * Camera notes:
 *   - Requests rear-facing camera (facingMode: environment) on load.
 *   - Falls back gracefully if permission denied or no camera found.
 *   - "Switch camera" button shown only when multiple cameras are detected.
 *   - Stream is stopped after capture or full page reset.
 */

'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const cameraContainer  = document.getElementById('camera-container');
const cameraFeed       = document.getElementById('camera-feed');
const cameraError      = document.getElementById('camera-error');
const btnCapture       = document.getElementById('btn-capture');
const btnSwitchCam     = document.getElementById('btn-switch-cam');
const previewContainer = document.getElementById('preview-container');
const previewImg       = document.getElementById('preview-img');
const btnRetake        = document.getElementById('btn-retake');
const fileInput        = document.getElementById('file-input');

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

// ── Camera state ──────────────────────────────────────────────────────────────
let cameraStream    = null;  // active MediaStream
let cameraDevices   = [];    // all videoinput devices
let cameraDeviceIdx = 0;     // index into cameraDevices

// ── Query STT state ───────────────────────────────────────────────────────────
let recognition = null;
let isListening = false;
let alwaysOn    = false;

// ── TTS command listener state ────────────────────────────────────────────────
let cmdRecognition = null;
let cmdListening   = false;

// ── TTS playback state ────────────────────────────────────────────────────────
/** @type {HTMLAudioElement|null} */
let ttsAudio    = null;
let ttsText     = '';
let ttsFetching = false;

// ── Camera ────────────────────────────────────────────────────────────────────
function stopStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

async function startCamera(deviceId) {
  stopStream();
  const constraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: 'environment' } },
    audio: false,
  };
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraFeed.srcObject = cameraStream;
    cameraContainer.style.display = '';
    cameraError.style.display = 'none';
  } catch (err) {
    showCameraError(err);
  }
}

function showCameraError(err) {
  const msgs = {
    NotAllowedError:  'Camera permission denied. Please allow camera access and reload.',
    NotFoundError:    'No camera found on this device. Use "Upload image" below.',
    NotReadableError: 'Camera is in use by another app. Close it and try again.',
  };
  cameraError.textContent = '📷 ' + (msgs[err.name] || 'Camera unavailable: ' + err.message);
  cameraError.style.display = '';
  cameraContainer.style.display = 'none';
}

async function initCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError({ name: 'NotFoundError', message: '' });
    return;
  }
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    cameraDevices = all.filter(d => d.kind === 'videoinput');
    if (cameraDevices.length > 1) btnSwitchCam.style.display = '';
  } catch (_) { /* non-critical */ }

  await startCamera(cameraDevices[cameraDeviceIdx]?.deviceId);
}

function captureFrame() {
  if (!cameraStream) return;
  const canvas = document.createElement('canvas');
  canvas.width  = cameraFeed.videoWidth  || 640;
  canvas.height = cameraFeed.videoHeight || 480;
  canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
  imageDataUri = canvas.toDataURL('image/jpeg', 0.85);
  stopStream();

  previewImg.src = imageDataUri;
  cameraContainer.style.display = 'none';
  previewContainer.style.display = '';
  updateSubmitState();
}

function retake() {
  imageDataUri = null;
  previewImg.src = '';
  previewContainer.style.display = 'none';
  cameraError.style.display = 'none';
  initCamera();
  updateSubmitState();
}

btnCapture.addEventListener('click', captureFrame);
btnRetake.addEventListener('click', retake);

btnSwitchCam.addEventListener('click', async () => {
  if (!cameraDevices.length) return;
  cameraDeviceIdx = (cameraDeviceIdx + 1) % cameraDevices.length;
  await startCamera(cameraDevices[cameraDeviceIdx].deviceId);
});

// ── File upload (fallback) ────────────────────────────────────────────────────
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    imageDataUri = e.target.result;
    stopStream();
    previewImg.src = imageDataUri;
    cameraContainer.style.display = 'none';
    previewContainer.style.display = '';
    updateSubmitState();
  };
  reader.readAsDataURL(file);
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
  if (card.items_detected?.length) {
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
  previewContainer.style.display = 'none';
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
  initCamera();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(on) {
  btnSubmit.disabled = on;
  btnLabel.textContent = on ? 'Analyzing…' : "Get Today's Plan";
  btnSpinner.style.display = on ? 'inline-block' : 'none';
}

function showError(msg) { errorBanner.textContent = '⚠️  ' + msg; errorBanner.style.display = ''; }
function hideError()    { errorBanner.textContent = '';            errorBanner.style.display = 'none'; }

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Query STT helpers ─────────────────────────────────────────────────────────
function showMicError(msg) { micError.textContent = '🎙️ ' + msg; micError.style.display = ''; }
function hideMicError()    { micError.textContent = '';            micError.style.display = 'none'; }

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
    if (toggleAlwaysOn?.parentElement) toggleAlwaysOn.parentElement.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  let finalTranscript = '', interimTranscript = '';

  recognition.onstart = () => { isListening = true; finalTranscript = interimTranscript = ''; updateMicUI(); };
  recognition.onend   = () => {
    isListening = false;
    updateMicUI();
    if (alwaysOn) setTimeout(() => { if (alwaysOn) startListening(); }, 300);
  };
  recognition.onerror = (event) => {
    isListening = false;
    updateMicUI();
    if (event.error !== 'no-speech') showMicError(event.error || 'Microphone error. Please try again.');
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

  // ── TTS voice command mic (dedicated continuous session) ──────────────────
  cmdRecognition = new SpeechRecognition();
  cmdRecognition.continuous     = true;
  cmdRecognition.interimResults = false;
  cmdRecognition.lang           = 'en-US';

  cmdRecognition.onstart = () => { cmdListening = true; };
  cmdRecognition.onend   = () => {
    cmdListening = false;
    if (ttsAudio && !ttsAudio.ended)
      setTimeout(() => { if (ttsAudio && !ttsAudio.ended) startCmdListener(); }, 150);
  };
  cmdRecognition.onerror = (event) => {
    cmdListening = false;
    if (ttsAudio && !ttsAudio.ended && event.error !== 'aborted')
      setTimeout(() => startCmdListener(), 300);
  };
  cmdRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      const cmd = event.results[i][0].transcript.toLowerCase().replace(/[^a-z ]/g, '').trim();
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
  if (isListening) { alwaysOn = false; toggleAlwaysOn.checked = false; stopListening(); }
  else             { startListening(); }
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
  if (ttsAudio && ttsAudio.paused && ttsAudio.currentSrc) {
    ttsAudio.play(); updateTtsUI('playing'); startCmdListener(); return;
  }
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
    ttsAudio.onpause = () => { updateTtsUI('paused'); };
    ttsAudio.onended = () => { updateTtsUI('idle');   stopCmdListener(); };
    ttsAudio.onerror = () => { updateTtsUI('idle');   stopCmdListener(); };
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

function ttsPause()   { if (ttsAudio && !ttsAudio.paused) ttsAudio.pause(); }
function ttsStop()    { if (ttsAudio) { ttsAudio.pause(); ttsAudio.currentTime = 0; } stopCmdListener(); updateTtsUI('idle'); }
function ttsRestart() { if (ttsAudio) { ttsAudio.pause(); URL.revokeObjectURL(ttsAudio.src); ttsAudio = null; } stopCmdListener(); ttsPlay(); }
function ttsReset()   {
  if (ttsAudio) { ttsAudio.pause(); URL.revokeObjectURL(ttsAudio.src); ttsAudio = null; }
  stopCmdListener(); ttsText = ''; ttsFetching = false; updateTtsUI('hidden');
}

// ── TTS – UI state machine ────────────────────────────────────────────────────
/** @param {'hidden'|'loading'|'playing'|'paused'|'idle'} state */
function updateTtsUI(state) {
  const show = (el, yes) => { el.style.display = yes ? '' : 'none'; };
  if (state === 'hidden') { ttsBar.style.display = 'none'; ttsStatus.textContent = ''; return; }
  ttsBar.style.display = '';
  show(btnTtsPlay,    state === 'idle' || state === 'paused' || state === 'loading');
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
initCamera();
