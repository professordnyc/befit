# Risk Log - Befit

This file captures key risks and mitigations.

## Known Risks

- [ ] Health guidance may be misinterpreted as medical advice.
- [ ] Misidentification of items from images.
- [ ] TTS voice commands may be misheard in noisy environments; the on-screen player bar buttons are the reliable fallback.
- [ ] `ELEVENLABS_API_KEY` must remain server-side only; enforced by the `POST /tts` proxy - never expose it in frontend code or API responses.
- [ ] Audio narration omits the limitations disclaimer (visual-only by design per LIMITATIONS.md); users must read the on-card disclaimer text.
- [ ] Camera permission may be denied on first load; error message is shown and "Upload image" fallback is always available.
- [ ] Captured frame quality depends on device camera and lighting; Vision Interpreter marks ambiguous items as "unknown" per spec.
- [ ] Auto-capture countdown may fire before the user has finished positioning the camera; users can toggle back to manual capture or use "Retake".
- [ ] WebSpeech TTS fallback voice quality and language support vary by browser and OS; on-screen plan card is always the authoritative output.
- [ ] WebSpeech TTS may not be available in all browsers (e.g., some headless or privacy-hardened environments); audio playback is convenience only.
- [ ] Android 12 Chrome: user-gesture activation token expires after network I/O `await`s; mitigated by pre-unlocking an `Audio` element synchronously in the click handler before any `await`.
- [ ] Android Chrome (all versions): `recognition.start()` may throw `InvalidStateError` during the service cool-down window between sessions; mitigated by rolling back `ttsListening` and scheduling a 700 ms rearm retry.
