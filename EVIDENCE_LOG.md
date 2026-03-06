# Evidence Log - Befit

This file captures sample runs, logs, and evidence that the system works as intended.

## Placeholder

- To be populated with example scan-and-plan runs once the backend is implemented.

## 2026-03-04 – Feature verification notes

- Auto-capture toggle: countdown timer confirmed functional in Chromium (3s → captureFrame).
- WebSpeech fallback: tested by omitting ELEVENLABS_API_KEY; /tts returns 503; browser
  switches to window.speechSynthesis transparently with correct UI state transitions.
- Voice commands (listen, play, pause, stop) work correctly in both ElevenLabs and WebSpeech
  playback modes.

## 2026-03-06 — Android TTS bug fixes verified

- **Android 12 / Chrome:** Pre-unlock pattern confirmed: `Audio` element created and
  play-paused synchronously in `btnSubmit` click handler captures the user-gesture
  token before network `await`s. Blob URL assigned to `.src` after fetch; `play()`
  resolves without `NotAllowedError`. "Audio unavailable" message no longer shown.
- **Android 16 / Chrome:** `startCmdListener()` `InvalidStateError` rollback
  confirmed: stubbed `recognition.start()` throw causes `ttsListening` to reset to
  `false` and `scheduleRearm()` to fire. Rearm delay increased to 700 ms; voice
  commands (play, pause, stop, listen) functional across multiple plan-generation cycles.
- **Desktop Chrome:** No regression — all existing behaviour unchanged.
- **Test page:** `tests/test_android_tts.html` tests 1–3 pass on target devices.
