/**
 * app.js – Befit frontend controller
 *
 * Flow:
 *   1. User picks / drags an image  → stored as base-64 data URI
 *   2. User types a wellness question
 *   3. Submit → POST /scan-and-plan → today_card JSON
 *   4. Render card into DOM
 */

'use strict';

// ── DOM refs ────────────────────────────────────────────────────────────────
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

// ── State ────────────────────────────────────────────────────────────────────
let imageDataUri = null;

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
    previewImg.style.display = 'block';
    uploadPlaceholder.style.display = 'none';
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
    // Assign to input and trigger change handler
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── Enable submit only when both image and query are present ─────────────────
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

  const userContext = buildContext();

  const body = {
    image_url:    imageDataUri,
    user_query:   userQuery.value.trim(),
    user_context: userContext,
  };

  try {
    const res = await fetch('/scan-and-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail; } catch { detail = await res.text(); }
      throw new Error(`Server error ${res.status}: ${detail}`);
    }

    const card = await res.json();
    renderCard(card);
    todayCardEl.style.display = 'flex';
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
  const constraints = rawConst
    ? rawConst.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (!goal && !person && !constraints.length) return null;
  return Object.assign(
    {},
    goal        ? { goal }        : {},
    person      ? { person }      : {},
    constraints.length ? { constraints } : {},
  );
}

// ── Render TodayCard ──────────────────────────────────────────────────────────
function renderCard(card) {
  // Goal summary
  tcGoal.textContent = card.goal_summary || '';

  // Detected items
  tcItems.innerHTML = '';
  if (card.items_detected && card.items_detected.length) {
    tcItemsSection.style.display = '';
    card.items_detected.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML =
        esc(item.name) +
        (item.category
          ? `<span class="chip-category">${esc(item.category)}</span>`
          : '');
      if (item.notes) li.title = item.notes;
      tcItems.appendChild(li);
    });
  } else {
    tcItemsSection.style.display = 'none';
  }

  // Risk flags – always show warnings/cautions; show info only when few flags
  tcFlags.innerHTML = '';
  const flags = card.risk_flags || [];
  const showInfo = flags.length <= 3;
  const visibleFlags = flags.filter(f => f.level !== 'info' || showInfo);

  if (visibleFlags.length) {
    tcFlagsSection.style.display = '';
    visibleFlags.forEach(flag => {
      const li = document.createElement('li');
      li.className = `flag-item flag-${esc(flag.level)}`;
      li.textContent = flag.message;
      tcFlags.appendChild(li);
    });
  } else {
    tcFlagsSection.style.display = 'none';
  }

  // Actions
  tcActions.innerHTML = '';
  (card.actions || []).forEach((action, i) => {
    const li = document.createElement('li');
    li.className = 'action-item';
    li.innerHTML = `
      <div class="action-number" aria-hidden="true">${i + 1}</div>
      <div class="action-body">
        <div class="action-title">${esc(action.title)}</div>
        <div class="action-desc">${esc(action.description)}</div>
      </div>`;
    tcActions.appendChild(li);
  });

  // Why
  tcWhy.textContent = card.why || '';

  // Limitations
  tcLimitations.textContent = card.limitations || '';
}

// ── Reset query & context fields only ───────────────────────────────────────
btnResetQuery.addEventListener('click', () => {
  userQuery.value = '';
  ctxGoal.value = '';
  ctxPerson.value = '';
  ctxConstraints.value = '';
  hideError();
  updateSubmitState();
  userQuery.focus();
});


// ── Reset ─────────────────────────────────────────────────────────────────────
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
