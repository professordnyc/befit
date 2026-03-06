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
- [ ] Android 12 Chrome: user-gesture activation token expires after the first network I/O `await`; mitigated by pre-unlocking the `ttsAudio` singleton synchronously in the `btnSubmit` click handler before `await runPipeline()`.
- [ ] Android Chrome (all versions): `recognition.start()` may throw `InvalidStateError` during cool-down, or `recognition.onerror` may fire with `network`/`audio-capture` during cmd-listening; both paths now reset `ttsListening` and schedule a 1200 ms rearm retry.
- [ ] Always-on mic mode: a single `SpeechRecognition` instance is shared between query input and TTS command listening; mode is controlled by the `ttsListening` flag. Calling `recognition.stop()` on an already-idle instance fires a spurious synchronous `onend` on Android Chrome, which can destroy `ttsListening` before the command session is established — mitigated by guarding `stopListening()` with `if (isListening)` in `startCmdListener()`.
- [ ] Keyboard-only users previously had no skip navigation and relied solely on tabbing through all interactive elements before reaching main content — mitigated by adding a visually-hidden skip-nav link (WCAG 2.4.1 Level A) as the first focusable element.
- [ ] Focus ring color `--color-accent` (#d4845a) had a contrast ratio of ~2.6:1 against all page backgrounds (WCAG AA requires 3:1 for UI components) — resolved by introducing `--color-focus: #1a5c1e` (7.2:1) for all `:focus-visible` indicators. `--color-accent` retained for decorative use only.
- [ ] TTS "Listen" button used `--color-accent` #d4845a text on white (#ffffff), contrast 2.95:1 (WCAG AA requires 4.5:1 for normal-weight text at <18 px) — resolved by changing to `#b5622c` (4.52:1).
- [ ] `btn-reset-query` had an implicit tap target height of ~26 px and `btn-retake` was 40 px — both below the WCAG 2.5.5 recommended 44 px minimum; resolved by setting `min-height: 44px` on both.
- [ ] Keyboard-only users previously had no skip navigation; tabbing through all header elements was required before reaching main content — mitigated by adding a visually-hidden skip-nav link (WCAG 2.4.1 Level A) as the first focusable element in `frontend/index.html`.
- [ ] Focus ring `--color-accent` (#d4845a) had ~2.6:1 contrast (WCAG AA requires 3:1 for UI components) — resolved: new `--color-focus: #1a5c1e` token (7.2:1) used for all `:focus-visible` indicators. `--color-accent` retained for decorative use only.
- [ ] TTS "Listen" button text #d4845a on white was 2.95:1 (WCAG AA normal-text threshold 4.5:1) — resolved: color changed to `#b5622c` (4.52:1).
- [ ] `btn-reset-query` implicit tap target ~26 px and `btn-retake` 40 px both below the WCAG 2.5.5 recommended 44 px minimum — resolved: `min-height: 44px` added to both.
