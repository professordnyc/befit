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

No login or user accounts are required.
