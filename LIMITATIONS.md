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
- On Android Chrome, voice commands may take up to 700 ms to re-arm after each utterance ends while the recognition service resets. This is a platform limitation: Chrome tears down the microphone/recognition service during audio playback and imposes a cooldown even if you try to start a second `SpeechRecognition` instance, so adding another recogniser will not make commands more responsive. Desktop Chrome does **not** exhibit this behaviour, which is why commands feel instantaneous there. Tapping the on-screen player bar buttons is always the reliable fallback.
- Speech recognition for voice commands may mishear words in noisy environments; use the on-screen player bar buttons as a fallback.
- TTS uses ElevenLabs when available; falls back to the browser's WebSpeech API (`window.speechSynthesis`) automatically. Voice quality and language support in fallback mode depend on the device and browser.
- Auto-capture fires after a 3-second countdown; the timer resets on every camera restart or retake. Users who prefer manual control should leave the Auto-capture toggle off (default).

## Camera limitations
- Live camera feed requires browser permission; if denied, users must upload an image instead.
- Frame capture quality depends on device camera and ambient lighting; poor lighting may reduce item detection accuracy.
- Camera stream is stopped immediately after frame capture to conserve device resources.
- Auto-capture mode takes a frame automatically after a 3-second countdown. It is opt-in (toggle off by default). Manual capture remains available at any time via the toggle.
## Accessibility limitations

- The skip navigation link is the first focusable element; keyboard users should press Tab once on page load to reveal it.
- Chip items in the "Items we noticed" list display additional notes (e.g. "high-sodium label visible") as `title` tooltip attributes only. These are not announced by screen readers on mobile or touch devices; users relying on assistive technology on mobile should treat chip labels as the primary information.
- The camera hint countdown ("Auto-capture in 3s…") updates a `<span>` that is not inside an `aria-live` region; screen reader users will not hear countdown updates. The auto-capture toggle can be turned off at any time to revert to manual capture.
- Context form fields (`<select>`, `<input>`) use `font-size: 0.9rem` (14.4 px), which may trigger iOS Safari auto-zoom on focus. Users who find this disruptive can disable auto-zoom in iOS accessibility settings.
- The page has one `<h1>` (the Befit logo/app name in the header), followed by `<h2>` section headings and `<h3>` card sub-headings. This hierarchy is correct and navigable by screen reader heading commands.
## Accessibility limitations

- The skip navigation link is the first focusable element on the page. Keyboard users should
  press Tab once on page load to reveal it, then Enter to jump past the header to main content.
- Chip items in the "Items we noticed" list display extra notes (e.g. "high-sodium label visible")
  as `title` tooltip attributes only. These are not announced by screen readers on mobile or
  touch devices; chip labels carry the primary information.
- The auto-capture countdown ("Auto-capture in 3s…") updates a `<span>` that is not in an
  `aria-live` region; screen reader users will not hear countdown updates. The Auto-capture
  toggle can be turned off at any time to use manual capture instead.
- Context form fields (`<select>`, text `<input>`) use `font-size: 0.9rem` (14.4 px), which
  may trigger iOS Safari auto-zoom on focus. Users who find this disruptive can disable auto-zoom
  in iOS accessibility settings or increase the browser's minimum font size.
- The page heading hierarchy is: one `<h1>` (app name in header) > `<h2>` section headings >
  `<h3>` card sub-headings. This hierarchy is intentional and navigable by screen reader heading
  commands (e.g. H / Shift+H in NVDA/JAWS, swipe by heading in VoiceOver).
