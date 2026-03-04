# 🌿 Befit

Befit is a Goose-powered, multimodal wellness assistant for women and caregivers.
It looks at what you have in your fridge, pantry, or medicine cabinet and turns
it into a simple "Today's Plan" of safe, achievable actions.

---

## 🎯 Quick Start

### Prerequisites
- Python 3.10+ with `uv` package manager
- OpenRouter API key (for LLM access)
- ElevenLabs API key (optional; WebSpeech fallback available)

### Local Development (5 minutes)

1. **Clone & set up:**
   ```bash
   git clone https://github.com/your-org/befit.git
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

## 🚀 Deployment

### Deploy to Render (Backend)

1. **Create a Render account** at https://render.com
2. **Connect your GitHub repository**
3. **Create a new Web Service:**
   - Name: `befit-backend`
   - Runtime: Python 3.12
   - Build Command: `uv sync`
   - Start Command: `uv run uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

4. **Set environment variables** in Render dashboard:
   - `BEFIT_ENV=production`
   - `OPENAI_API_KEY=<your-key>`
   - `ELEVENLABS_API_KEY=<your-key>` (optional)
   - `OPENAI_BASE_URL=https://openrouter.ai/api/v1`

5. **Deploy:** Push to `main` branch or manually trigger in Render dashboard.
   Backend URL: `https://befit-backend.onrender.com`

### Deploy to Netlify (Frontend)

1. **Create a Netlify account** at https://netlify.com
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - Build Command: (leave empty or `echo 'Static site'`)
   - Publish Directory: `frontend`

4. **Set environment variables** (optional secrets):
   - `PUBLIC_API_BASE_URL=https://befit-backend.onrender.com`

5. **Deploy:** Netlify auto-deploys on push to `main`.
   Frontend URL: `https://befit.netlify.app`

### GitHub Actions CI/CD

Workflows run automatically on every push:
- **tests.yml:** Linting (ruff, black) + pytest on Python 3.10/3.11/3.12
- **deploy.yml:** Trigger Render & Netlify deployments on main branch push

Configure these secrets in GitHub repo settings:
- `RENDER_SERVICE_ID`: Copy from Render dashboard
- `RENDER_API_KEY`: Create from Render account settings
- `NETLIFY_BUILD_HOOK`: Copy from Netlify deploy settings

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


