# Limitations - Befit

This document describes what Befit does **not** do and important safety constraints.

## Medical limitations

- Befit does not diagnose medical conditions.
- Befit does not provide dosing instructions for any medication.
- Befit does not handle emergencies; users should call local emergency services.

## Scope limitations

- Recommendations are based only on visible items and user-provided context.
- Risk assessments are simple flags, not comprehensive drug-drug interaction checks.

## Data limitations

- No access to personal medical records unless explicitly integrated and documented.
- No long-term tracking beyond this device/session unless clearly explained.

## Modality limitations

- Speech recognition may mishear names or quantities; users should verify transcriptions.
- Visual analysis is based only on visible labels/packaging in the frame.
- Audio output is for convenience only and does not change the non-medical nature of guidance.
- Voice commands ("play", "pause", "stop", "listen") control audio playback only; they do not re-run the wellness pipeline or alter the plan.
- On Android 12 Chrome, audio playback depends on a pre-unlocked `Audio` element created synchronously in the submit gesture. If the gesture is not a direct tap (e.g., triggered programmatically), audio may be unavailable; the on-screen plan card remains the authoritative output.
- On Android Chrome, voice commands may take up to 700 ms to re-arm after each utterance ends while the recognition service resets. Tapping the on-screen player bar buttons is always the reliable fallback.
- Speech recognition for voice commands may mishear words in noisy environments; use the on-screen player bar buttons as a fallback.
- TTS uses ElevenLabs when available; falls back to the browser's WebSpeech API (`window.speechSynthesis`) automatically. Voice quality and language support in fallback mode depend on the device and browser.
- Auto-capture fires after a 3-second countdown; the timer resets on every camera restart or retake. Users who prefer manual control should leave the Auto-capture toggle off (default).

## Camera limitations
- Live camera feed requires browser permission; if denied, users must upload an image instead.
- Frame capture quality depends on device camera and ambient lighting; poor lighting may reduce item detection accuracy.
- Camera stream is stopped immediately after frame capture to conserve device resources.
- Auto-capture mode takes a frame automatically after a 3-second countdown. It is opt-in (toggle off by default). Manual capture remains available at any time via the toggle.
