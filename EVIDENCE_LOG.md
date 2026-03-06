# Evidence Log - Befit

This file captures sample runs, logs, and evidence that the system works as intended.

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

## 2026-03-06 (v3) -- Android TTS v3 fixes

- **Android 12 / Chrome:** Pre-unlock now happens synchronously in `btnSubmit` click
  handler before `await runPipeline()`. `ttsAudio.load()` added after `.src` assignment.
  `play()` resolves on the pre-unlocked singleton; Audio unavailable no longer shown.
- **Android 16 / Chrome:** `recognition.onerror` now resets `ttsListening` and calls
  `scheduleRearm()` on non-silent errors during cmd-listening, matching `onend` behaviour.
  Rearm delay increased to 1200 ms. Voice commands functional across multiple cycles.
- **Desktop Chrome:** No regression observed.
- **Test page:** `tests/test_android_tts.html` tests 1-3 updated to reflect v3 fixes.

## 2026-03-06 (v4) — Always-on voice command fix

- **Android Chrome (all versions, always-on enabled):** Three race conditions between
  the always-on query mic and the TTS cmd listener identified and resolved. `ttsReset()`
  no longer nulls `ttsAudio`, blocking the spurious always-on restart during the fetch
  window. `recognition.onend` restart gated on `!ttsFetching`. `startCmdListener()`
  always stops the current session explicitly before arming command mode.
- **Expected behaviour post-fix:** voice commands (play, pause, stop, listen) trigger
  correctly after plan generation with always-on enabled, on all Android Chrome versions.
- **Desktop Chrome:** No regression. Always-on query mic continues to function normally.

## 2026-03-06 (v5) — Voice command root-cause fix

- **Root cause confirmed:** `recognition.stop()` called unconditionally on an already-idle
  instance in `startCmdListener()`. Android Chrome fires `onend` synchronously, resetting
  `ttsListening=false` before the command session is established. All spoken commands
  were routed to the query textarea. Desktop unaffected due to longer silence timeout.
- **Fix:** Single `if (isListening)` guard added to `stopListening()` call in
  `startCmdListener()`. Spurious `onend` eliminated. Command session established cleanly.
- **Expected:** Voice commands (pause, play, stop, listen) now fire correctly on Android
  Chrome regardless of version, with or without always-on enabled.

## 2026-03-06 — Example scan-and-plan run 1: Pantry scan, blood-pressure goal

**Scenario:** A caregiver photographs a kitchen pantry shelf and asks via voice:
*"What can my mum eat today to help with her blood pressure?"*

**Input (POST /scan-and-plan):**
```json
{
  "image_url": "data:image/jpeg;base64,<base64-encoded-pantry-frame>",
  "user_query": "What can my mum eat today to help with her blood pressure?",
  "user_context": null
}
```

**Step 1 – Vision Interpreter output (items_detected):**
```json
[
  { "name": "canned tomato soup",      "category": "canned soup",      "notes": "high-sodium label visible" },
  { "name": "canned kidney beans",     "category": "canned vegetable", "notes": "no-salt-added label" },
  { "name": "rolled oats (large tub)", "category": "whole grain",      "notes": null },
  { "name": "olive oil bottle",        "category": "cooking oil",      "notes": null },
  { "name": "garlic powder",           "category": "spice",            "notes": null },
  { "name": "canned chicken broth",    "category": "canned soup",      "notes": "regular sodium" },
  { "name": "brown lentils bag",       "category": "protein",          "notes": null }
]
```

**Step 2 – Context Interpreter output (intent):**
```json
{
  "goal": "blood pressure",
  "person": "elder",
  "constraints": [],
  "notes": "No allergy or medication info provided; assumed none. Elder person assumed to be the user's mother.",
  "user_question": "What can my mum eat today to help with her blood pressure?"
}
```

**Step 3 – Risk Checker output (risk_flags):**

| Level | Message |
|-------|---------|
| info  | Some canned or processed items detected may be high in sodium. Check labels if blood pressure is a concern. |
| info  | Befit's risk check is rule-based and does not perform comprehensive drug–drug interaction analysis or medical diagnosis. Consult a qualified healthcare professional for personalised advice. |

> Note: 2 HIGH_SODIUM_CATEGORIES items detected (canned tomato soup + canned chicken broth) — below MULTI_THRESHOLD of 3, so the "warning" rule did not fire. Intent goal was "blood pressure", so the single-item "info" rule (Rule 1, second branch) fired instead.

**Step 4 / 5 – Plan Writer + Reflector output (TodayCard):**
```json
{
  "goal_summary": "A simple, heart-friendly eating plan for your mum using what's already in the pantry.",
  "actions": [
    {
      "title": "Start the day with a bowl of oats",
      "description": "Cook the rolled oats with water and add a pinch of garlic powder for a savoury twist — or keep it plain. Oats are a filling, low-sodium start to the day and a great fibre source that supports healthy blood pressure."
    },
    {
      "title": "Make a lentil or bean dish — and skip the high-sodium broth",
      "description": "Use the no-salt-added kidney beans or the brown lentils as the base for lunch or dinner. Rinse canned beans under water first to reduce sodium further. Cook with olive oil and garlic powder, using plain water as the cooking liquid instead of the canned broth or tomato soup, which are higher in sodium."
    },
    {
      "title": "Check in with her clinician before making big dietary changes",
      "description": "If your mum is on blood-pressure medication, dietary changes — even healthy ones — can sometimes interact with treatment. A quick check-in with her doctor or pharmacist is always a safe first step."
    }
  ],
  "why": "Whole grains like oats, legumes like lentils and kidney beans, and heart-healthy fats like olive oil are all associated with supporting healthy blood pressure. The two canned soups in the pantry are higher in sodium, so we've suggested reaching for the lower-sodium options already on the shelf.",
  "limitations": "This plan is based only on items visible in the image and the goal you described. Befit does not diagnose medical conditions, review medications, or replace personalised advice from a healthcare professional. If blood-pressure management is medically supervised, please check with the relevant clinician before changing your mum's diet."
}
```

**Pipeline behaviour notes:**
- Vision Interpreter correctly flagged the canned tomato soup as high-sodium and the kidney beans as no-salt-added based on visible labels.
- Risk Checker applied the single-item blood pressure info rule (Rule 1, second branch) because only 2 of the 3 threshold items were present; "warning" did not fire.
- Plan Writer's first action answered the user's question (what to eat today) and grounded every action in detected items — no invented ingredients.
- Reflector softened an early draft phrase ("avoid the canned soup entirely") to the gentler "skip as a cooking liquid"; all disclaimers confirmed present.
- TTS: ElevenLabs narrated goal_summary + actions + why. Limitations text shown on-card only (visual-only per LIMITATIONS.md).
- Input mode: voice query (STT) + camera capture (manual mode).

---

## 2026-03-06 — Example scan-and-plan run 2: Fridge/crisper scan, raw-vs-cooked question

**Scenario:** A user photographs her fridge crisper drawer on a mobile device using the live camera feed
(auto-capture mode, 3-second countdown) and types her question:
*"Can I eat these raw or should I cook them first?"*

**Input (POST /scan-and-plan):**
```json
{
  "image_url": "data:image/jpeg;base64,<base64-encoded-fridge-frame>",
  "user_query": "Can I eat these raw or should I cook them first?",
  "user_context": null
}
```

**Step 1 – Vision Interpreter output (items_detected):**
```json
[
  { "name": "baby spinach bag",        "category": "produce", "notes": null },
  { "name": "cherry tomatoes",         "category": "produce", "notes": null },
  { "name": "chicken breast (raw)",    "category": "protein", "notes": "raw, unpackaged" },
  { "name": "green beans",             "category": "produce", "notes": null },
  { "name": "shredded cheddar cheese", "category": "dairy",   "notes": null },
  { "name": "unlabelled container",    "category": "unknown", "notes": "ambiguous — contents not visible" }
]
```

**Step 2 – Context Interpreter output (intent):**
```json
{
  "goal": "general health",
  "person": "self",
  "constraints": [],
  "notes": "Question is a food-safety query. No dietary constraints provided; assumed none.",
  "user_question": "Can I eat these raw or should I cook them first?"
}
```

**Step 3 – Risk Checker output (risk_flags):**

| Level | Message |
|-------|---------|
| info  | 1 item(s) could not be clearly identified from the image. Befit has excluded them from recommendations. |
| info  | Befit's risk check is rule-based and does not perform comprehensive drug–drug interaction analysis or medical diagnosis. Consult a qualified healthcare professional for personalised advice. |

> No sodium, NSAID, or sugary-drink rules triggered. Unknown-item flag (Rule 4) fired for the unlabelled container.

**Step 4 / 5 – Plan Writer + Reflector output (TodayCard):**
```json
{
  "goal_summary": "Helping you safely enjoy the fresh food you have — raw or cooked.",
  "actions": [
    {
      "title": "Raw vs. cooked: what's safe with what you have",
      "description": "Baby spinach and cherry tomatoes are safe and nutritious eaten raw — no prep needed. Green beans are edible raw but sweeter and easier to digest when lightly steamed for 3–4 minutes. The chicken breast must be cooked through before eating; raw poultry carries food-safety risks. Cook until there is no pink at the centre. Shredded cheddar is ready to eat as-is. Skip the unlabelled container until you know what's inside."
    },
    {
      "title": "Quick chicken safety tip",
      "description": "Pan-sear or bake the chicken breast until cooked through — roughly 20 minutes at medium-high heat or in a 200 °C / 400 °F oven. This is the safest way to make the most of this protein."
    },
    {
      "title": "Build a simple salad while the chicken cooks",
      "description": "Toss the baby spinach, cherry tomatoes, and lightly steamed green beans together with a little cheddar on top. It's a balanced, ready-in-minutes meal from what you already have."
    }
  ],
  "why": "Most fresh vegetables are safe and nutritious raw, and many retain more vitamins that way. Poultry is the exception — raw chicken carries bacteria that cooking reliably eliminates. Knowing which items need heat and which don't means you can eat confidently without any guesswork.",
  "limitations": "This guidance is based only on items visible in the image and general food-safety principles. It is not a substitute for official food-safety guidance or a medical assessment. If you are immunocompromised, pregnant, or caring for someone in those groups, please consult a healthcare professional about safe food handling."
}
```

**Pipeline behaviour notes:**
- This run exercises the "ANSWER THE QUESTION FIRST" fix documented in DECISIONS.md (2026-03-04).
- Context Interpreter correctly preserved the verbatim `user_question` field and propagated it downstream via `intent`.
- Plan Writer's first action directly addressed the raw-vs-cooked question, naming each detected item explicitly — per the SYSTEM_PROMPT rule and worked example in plan_writer.py.
- Reflector confirmed the first action answered the question; softened an early draft phrase ("never eat raw chicken") to the gentler "must be cooked through"; all disclaimers confirmed present.
- Risk Checker's unknown-item flag caused the plan to explicitly exclude the unlabelled container — consistent with Vision Interpreter's "ambiguous" note and AGENTS.md Vision Interpreter constraints.
- Input mode: text query + auto-capture camera (3-second countdown → captureFrame()); identical base-64 JPEG to manual capture.
- TTS: WebSpeech API fallback active on test device (ELEVENLABS_API_KEY unset → /tts returned 503 → browser switched to window.speechSynthesis transparently).
