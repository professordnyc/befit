# Befit

Befit is a Goose-powered, multimodal wellness assistant for women and caregivers.
It looks at what you have in your fridge, pantry, or medicine cabinet and turns
it into a simple "Today’s Plan" of safe, achievable actions.

## Tech Stack (initial intent)

- Python backend (Goose + OpenRouter Anthropic models)
- Responsive web frontend (mobile-first)
- Voice: ElevenLabs for speech-to-text and text-to-speech
- Vision: Browser camera + Claude multimodal for item understanding; MediaPipe for live-frame handling (optional)
- Storage: Simple hosted database or Convex for logs and sample runs
- Deployment: Render/Netlify (to be finalized)

## Key Features 

- No login or user accounts are required.
- Multimodal features include TTS, STT, reasoning over image or live frame, with text and image fallback
- Deployed, browser-based, responsive web app.
- Voice in / audio out as first-class goals.
- Accessibility expectations (mobile-first, large touch targets, clear contrast, screen-reader friendly).

## Today’s Plan response shape

The backend returns a JSON object called `today_card` with:

- items_detected: array of { name, category, notes? }
- goal_summary: string
- risk_flags: array of { level, message }
- actions: array of { title, description }
- why: string
- limitations: string


