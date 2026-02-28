/**
 * app.js – Befit frontend controller
 *
 * Handles:
 *   1. Image upload / camera capture → base-64 data URI
 *   2. Form state & validation
 *   3. POST /scan-and-plan → today_card JSON
 *   4. Rendering the TodayCard response into the UI
 */

'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = '';   // empty = same origin; set to 'http://localhost:8000' in dev
const ENDPOINT = `${API_BASE}/scan-and-plan`;

// ── DOM refs ────────────────────────────────────────────────────────────────
const uploadArea      = document.getElementById('upload-area');
const fileInput       = document.getElementById('file-input');
const previewImg      = document.getElementById('preview-img');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const userQuery       = document.getElementById('user-query');
const ctxGoal         = document.getElementById('ctx-goal');
const ctxPerson       = document.getElementById('ctx-person');
const ctxConstraints  = document.getElementById('ctx-constraints');
const btnSubmit       = document.getElementById('btn-submit');
const btnLabel        = document.getElementById('btn-label');
const btnSpinner      = document.getElementById('btn-spinner');
const errorBanner     = document.getElementById('error-banner');
const todayCardEl     = document.getElementById('today-card');
const btnReset        = document.getElementById('btn-reset');

// TodayCard inner elements
const tcGoal          = document.getElementById('tc-goal');
const tcItems         = document.getElementById('tc-items');
const tcFlags         = document.getElementById('tc-flags');
const tcActions       = document.getElementById('tc-actions');
const tcWhy           = document.getElementById('tc-why');
const tcLimitations   = document.getElementById('tc-limitations');
const tcItemsSection  = document.getElementById('tc-items-section');
const tcFlagsSection  = document.getElementById('tc-flags-section');

// ── State ───────────────────────────────────────────────────────────────────
let imageDataUri = null;   // base-64 data URI of the chosen image

// ── Image selection ──────────────────────────────────────────────────────────
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
    previewImg.classList.remove('hidden');
    uploadPlaceholder.classList.add('hidden');
    updateSubmitState();
  };
  reader.readAsDataURL(file);
});

// ── Drag-and-drop ────────────────────────────────────────────────────────────
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
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── Submit gating ────────────────────────────────────────────────────────────
userQuery.addEventListener('input', updateSubmitState);

function updateSubmitState() {
  const hasImage = !!imageDataUri;
  const hasQuery = userQuery.value.trim().length > 0;
  btnSubmit.disabled = !(hasImage && hasQuery);
}

// ── Submit ───────────────────────────────────────────────────────────────────
btnSubmit.addEventListener('click', async () => {
  if (btnSubmit.disabled) return;
  await runPipeline();
});

async function runPipeline() {
  setLoading(true);
  hideError();
  todayCardEl.classList.add('hidden');

  // Build optional context object
  const userContext = buildContext();

  const body = {
    image_url: imageDataUri,
    user_query: userQuery.value.trim(),
    user_context: userContext,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Server error ${res.status}: ${detail}`);
    }

    const card = await res.json();
    renderCard(card);
    todayCardEl.classList.remove('hidden');
    todayCardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const constraints = rawConst ? rawConst.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!goal && !person && !constraints.length) return null;
  return {
    ...(goal        ? { goal }        : {}),
    ...(person      ? { person }      : {}),
    ...(constraints.length ? { constraints } : {}),
  };
}

// ── Render TodayCard ─────────────────────────────────────────────────────────
function renderCard(card) {
  // Goal summary
  tcGoal.textContent = card.goal_summary || '';

  // Detected items
  tcItems.innerHTML = '';
  if (card.items_detected && card.items_detected.length) {
    tcItemsSection.classList.remove('hidden');
    card.items_detected.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `${escHtml(item.name)}<span class="chip-category">${escHtml(item.category)}</span>`;
      if (item.notes) li.title = item.notes;
      tcItems.appendChild(li);
    });
  } else {
    tcItemsSection.classList.add('hidden');
  }

  // Risk flags
  tcFlags.innerHTML = '';
  const visibleFlags = (card.risk_flags || []).filter(f => f.level !== 'info' || card.risk_flags.length <= 2);
  if (visibleFlags.length) {
    tcFlagsSection.classList.remove('hidden');
    visibleFlags.forEach(flag => {
      const li = document.createElement('li');
      li.className = `flag-item flag-${escHtml(flag.level)}`;
      li.textContent = flag.message;
      tcFlags.appendChild(li);
    });
  } else {
    tcFlagsSection.classList.add('hidden');
  }

  // Actions
  tcActions.innerHTML = '';
  (card.actions || []).forEach((action, i) => {
    const li = document.createElement('li');
    li.className = 'action-item';
    li.innerHTML = `
      <div class="action-number" aria-hidden="true">${i + 1}</div>
      <div class="action-body">
        <div class="action-title">${escHtml(action.title)}</div>
        <div class="action-desc">${escHtml(action.description)}</div>
      </div>`;
    tcActions.appendChild(li);
  });

  // Why
  tcWhy.textContent = card.why || '';

  // Limitations
  tcLimitations.textContent = card.limitations || '';
}

// ── Reset ────────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  imageDataUri = null;
  fileInput.value = '';
  previewImg.src = '';
  previewImg.classList.add('hidden');
  uploadPlaceholder.classList.remove('hidden');
  userQuery.value = '';
  ctxGoal.value = '';
  ctxPerson.value = '';
  ctxConstraints.value = '';
  todayCardEl.classList.add('hidden');
  hideError();
  updateSubmitState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── UI helpers ───────────────────────────────────────────────────────────────
function setLoading(on) {
  btnSubmit.disabled = on;
  btnLabel.textContent = on ? 'Analysing…' : 'Get My Today\'s Plan';
  btnSpinner.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorBanner.textContent = `⚠️  ${msg}`;
  errorBanner.classList.remove('hidden');
}
function hideError() {
  errorBanner.textContent = '';
  errorBanner.classList.add('hidden');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
