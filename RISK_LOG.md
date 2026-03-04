# Risk Log – Befit

This file captures key risks and mitigations.

## Known Risks

- [ ] Health guidance may be misinterpreted as medical advice.
- [ ] Misidentification of items from images.
- [ ] TTS voice commands may be misheard in noisy environments; the on-screen player bar buttons are the reliable fallback.
- [ ] `ELEVENLABS_API_KEY` must remain server-side only; enforced by the `POST /tts` proxy — never expose it in frontend code or API responses.
- [ ] Audio narration omits the limitations disclaimer (visual-only by design per LIMITATIONS.md); users must read the on-card disclaimer text.
- [ ] Camera permission may be denied on first load; error message is shown and "Upload image" fallback is always available.
- [ ] Captured frame quality depends on device camera and lighting; Vision Interpreter marks ambiguous items as "unknown" per spec.
