# 🌿 Befit

Befit is a Goose-powered, multimodal wellness assistant for women and caregivers.
It looks at what you have in your fridge, pantry, or medicine cabinet and turns
it into a simple "Today's Plan" of safe, achievable actions.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Live demo: https://getbefit.netlify.app/

🌿 Befit
========

4-Line Problem Frame
--------------------

- **User**: Women and caregivers who are already juggling health decisions, time, and emotional labor.  
- **Problem**: It’s hard to look at what’s in your fridge, pantry, or medicine cabinet and turn it into a safe, realistic plan for today—especially when you’re tired, worried, or short on time.  
- **Constraints**: No new devices or subscriptions, no medical diagnoses or dosing, must be usable on a phone in a few minutes or less, and must be transparent about safety limits.  
- **Success Test**: A first-time user can open Befit on their phone, capture what they have on hand, ask a question in their own words, and feel confident acting on a 2–3 step “Today’s Plan” card in under 5 minutes.

3-Line Pitch
------------

- **Headline**: Befit turns what’s on your shelf into a phone-first wellness co‑pilot.  
- **Subhead**: Open the web app, point your camera at your food or cabinet items, type or ask a question out loud, and get a short “Today’s Plan” card with items detected, 2–3 suggested actions, and safety notes.  
- **Call to action**: Try the live demo at https://getbefit.netlify.app/ — no login required, designed for women and caregivers on the go.

Core Flow (Phone-First, Low Friction)
-------------------------------------

1. The user opens Befit on their phone at https://getbefit.netlify.app/ (responsive web app, no authentication required).  
2. They hold the phone up to their fridge, pantry, or medicine shelf and see a live camera preview.  
3. They press and hold a mic button and ask a question in natural language, for example:  
   - “What can I cook for dinner that’s better for my blood pressure?”  
   - “Are any of these meds risky to mix with ibuprofen?”  
4. On release, Befit captures a single frame (or very short burst) from the camera and the audio from their question, runs speech‑to‑text in the browser, and sends both to the backend.  
5. Goose orchestrates vision and text analysis via a single, linear workflow defined in `befit_scan_and_plan.yaml`, which the Planner agent runs end‑to‑end to produce a **Today’s Plan** card (items detected, short explanation, 2–3 suggested actions, and safety notes).  
6. Optionally, Befit reads the answer back via text‑to‑speech with simple voice controls (play, pause, stop, listen).

Sources of Truth
----------------

Befit’s behavior and guardrails are documented in a small set of source-of-truth files:

- **AGENTS.md** – Primary reference for agent roles, responsibilities, and how the Planner coordinates the `befit_scan_and_plan.yaml` Goose recipe.  
- **DECISIONS.md** – Primary log of key design and technical decisions, including why the single, linear scan‑and‑plan workflow exists and what tradeoffs were made.  
- **EVIDENCE_LOG.md** – Supporting log for references, test runs, and external sources (used in judging for Proof).  
- **RISK_LOG.md** – Supporting log for known risks and mitigations (used in judging for Rigor).  
- **LIMITATIONS.md** – Supporting log for explicit safety constraints, out‑of‑scope behavior, and what Befit will not do.
- **TRACE_LOG.md** – Trace log for recording agent execution traces, debugging notes, and workflow observations used to improve transparency and reproducibility.

---

## 🎯 Quick Start

### Prerequisites
- Python 3.10+ with `uv` package manager
- OpenRouter API key (for LLM access)
- ElevenLabs API key (optional; WebSpeech fallback available)

### Local Development (5 minutes)

1. **Clone & set up:**
   ```bash
   git clone https://github.com/professordnyc/befit.git
   cd befit
   cp .env.example .env
   ```

2. **Update `.env` with your keys:**
   ```bash
   OPENAI_API_KEY=your-openrouter-key
   ELEVENLABS_API_KEY=your-elevenlabs-key  # optional
   ```

3. **Run the dev server:**
   ```bash
   uv run uvicorn backend.main:app --reload
   ```
   
   Open **http://localhost:8000** in your browser.

---

## 🏗️ Architecture

Befit follows a hierarchical agent orchestration pattern (see [AGENTS.md](AGENTS.md)):

- **Planner:** Orchestrates the workflow
- **Vision Interpreter:** Extracts items from images/video frames
- **Context Interpreter:** Parses user intent and constraints
- **Risk Checker:** Applies rule-based wellness flags
- **Plan Writer:** Generates 2–3 actionable micro-steps
- **Reflector:** Reviews outputs for safety & clarity

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI + Python + Goose agents |
| **Frontend** | HTML5, CSS3, Vanilla JS (no build step) |
| **LLM** | OpenRouter + Anthropic Claude Sonnet 4.6 |
| **TTS** | ElevenLabs (primary) + WebSpeech fallback |
| **STT** | WebSpeech API |
| **Deployment** | Render (backend) + Netlify (frontend) |
| **Code Quality** | ruff + black + pytest |

---

🚀 Deployment
============

Deploy to Render (Backend)
--------------------------

The production backend for this project is hosted on Render.

- Live backend URL: https://befit-backend-z9q1.onrender.com

To deploy your **own** instance on Render:

1. Create a Render account at https://render.com
2. Connect your fork or copy of this GitHub repository.
3. Create a new Web Service:
   - Example name: befit-backend  (you can choose any name)
   - Runtime: Python 3.12
   - Build Command: uv sync
   - Start Command: uv run uvicorn backend.main:app --host 0.0.0.0 --port $PORT
4. Set environment variables in your Render dashboard (values are private to your account):
   - BEFIT_ENV=production
   - OPENAI_API_KEY=<your-openrouter-key>
   - ELEVENLABS_API_KEY=<your-elevenlabs-key>  # optional
   - OPENAI_BASE_URL=https://openrouter.ai/api/v1
5. Deploy by pushing to your main branch or triggering a manual deploy in the Render dashboard.

Deploy to Netlify (Frontend)
----------------------------

The production frontend for this project is hosted on Netlify.

- Live frontend URL: https://getbefit.netlify.app/

To deploy your **own** instance on Netlify:

1. Create a Netlify account at https://netlify.com
2. Connect your fork or copy of this GitHub repository.
3. Configure build settings:
   - Build Command: (leave empty or `echo 'Static site'`)
   - Publish Directory: frontend
4. Set environment variables (optional, for your instance):
   - PUBLIC_API_BASE_URL=<your-backend-url>
5. Netlify will auto-deploy your site on push to your main branch.

Judge Demo Flow (Recommended)
-----------------------------

To experience Befit from a clean start (no setup required):

1. Open https://getbefit.netlify.app/ on mobile or desktop (no login required).
2. Use the built-in sample images (or capture your own fridge, pantry, or medicine shelf).
3. Tap “Scan & Plan” to generate a 2–3 step **Today’s Plan**.
4. Use the voice controls (play, pause, stop, listen) to hear the plan via TTS and see WebSpeech fallback behavior.
5. Review the risk flags and “why” explanation to see how Befit enforces safety and limitations.

GitHub Actions CI/CD
--------------------

This repository includes optional GitHub Actions workflows (see `.github/workflows`) that can:

- Run tests and checks on each push (ruff, black, pytest).
- Trigger provider-specific deploy hooks if you configure them.

To enable deploy hooks for **your** instances, add secrets in your GitHub repository settings (values obtained from your Render/Netlify dashboards):

- `RENDER_DEPLOY_HOOK_URL`  (optional)
- `NETLIFY_BUILD_HOOK_URL`  (optional)

---

## 📖 Documentation

- **[AGENTS.md](AGENTS.md)** – Agent roles, responsibilities, and collaboration pattern
- **[DECISIONS.md](DECISIONS.md)** – Design decisions and rationale
- **[LIMITATIONS.md](LIMITATIONS.md)** – Safety constraints and scope limits
- **[RISK_LOG.md](RISK_LOG.md)** – Known risks and mitigations
- **[.goosehints](.goosehints)** – Guidance for Goose and contributors

---

## 🔐 Environment Variables

**Required:**
- `OPENAI_API_KEY` – OpenRouter key for LLM access

**Optional:**
- `ELEVENLABS_API_KEY` – For ElevenLabs TTS (WebSpeech fallback if absent)
- `BEFIT_ENV` – Set to `production` on deployed servers
- `ALLOWED_ORIGINS` – CORS allowed origins (defaults to `*`)

See [.env.example](.env.example) for full details.

---

## 🧪 Testing

Run tests locally:
```bash
# Run all tests
uv run pytest tests/ -v

# Run with coverage
uv run pytest tests/ --cov=backend --cov-report=term-missing

# Lint with ruff
uv run ruff check backend/ tests/

# Format check with black
uv run black --check backend/ tests/
```

---

## 🎨 Key Features 

- **No authentication required** – open to guests
- **Multimodal I/O** – text, voice, image, video frame, audio
- **Camera capture** – manual tap or 3-second auto-countdown
- **TTS with voice commands** – play, pause, stop, listen control
  - _Note:_ works best in Chrome desktop. On Android Chrome the recognition service is suspended while audio plays and may take several hundred milliseconds to re‑arm; use the on‑screen player controls as a fallback.
- **Smart fallbacks** – WebSpeech API when ElevenLabs unavailable
- **Mobile-first design** – responsive, accessible, touch-optimized
- **Safety by design** – rule-based risk flags, clear disclaimers, no diagnoses or dosing

---

## 📦 Today's Plan Response Shape

The backend `/scan-and-plan` endpoint returns:

```json
{
  "items_detected": [
    {"name": "...", "category": "...", "notes": "..."}
  ],
  "goal_summary": "...",
  "risk_flags": [
    {"level": "warning", "message": "..."}
  ],
  "actions": [
    {"title": "...", "description": "..."}
  ],
  "why": "...",
  "limitations": "..."
}
```

---

## 🤝 Contributing

1. Read [AGENTS.md](AGENTS.md) to understand agent orchestration
2. Check [DECISIONS.md](DECISIONS.md) for design rationale
3. Ensure tests pass: `uv run pytest tests/ -v`
4. Format code: `uv run black backend/ tests/`
5. Lint with: `uv run ruff check backend/ tests/`
6. Submit a pull request

---

## 📝 License

MIT



