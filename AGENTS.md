# AGENTS.md – Befit

This file defines the agent team for Befit, a Goose-powered multimodal wellness assistant that helps women and caregivers turn what they have at home into safe, simple daily actions.

## Collaboration Pattern

- **Pattern:** Hierarchical, planner–worker with reflection (Andrew Ng-style).
- **Planner:** Orchestrates the workflow and delegates to specialist sub-agents.
- **Sub-agents:** Vision Interpreter, Context Interpreter, Risk Checker, Plan Writer.
- **Reflector:** Reviews and refines outputs for safety, clarity, and alignment with limitations.

The Planner is responsible for:
1. Understanding the user's goal and question.
2. Calling sub-agents and tools in sequence.
3. Integrating their outputs into a coherent response.
4. Triggering the Reflector before returning the final answer.

---

## Agents

### 1. Befit Planner

**Role:** Orchestrates end-to-end flows for user requests.

**Responsibilities:**
- Interpret the user's query and select the correct workflow (e.g., meal planning, medication awareness, general wellness).
- Decide when to:
  - Call the Vision Interpreter to process images or camera frames.
  - Call the Context Interpreter to structure goals and constraints.
  - Call the Risk Checker to evaluate potential concerns.
  - Call the Plan Writer to create the "Today's Plan" or "Today's Answer" card.
  - Call the Reflector for safety and quality review.
- Planner is responsible for coordinating speech input (STT) and audio output (TTS) as part of the scan-and-plan flow.
- Respect global health limitations and disclaimers (no diagnoses, no dosing, no emergency guidance).

**Constraints:**
- Must not fabricate tools or data sources.
- Must follow the high-level steps defined in AGENTS.md, Befit skills or recipes when available.
- Must always run the Reflector before returning user-facing guidance.

---

### 2. Vision Interpreter

**Role:** Turn images (photos or captured frames) into structured item lists.

**Responsibilities:**
- Use multimodal models to identify items in fridges, pantries, and medicine cabinets at a "good enough" level.
- Take in uploaded or live video frame and mobile camera input.
- Produce a structured list of items with:
  - Name (e.g., "canned tomato soup", "ibuprofen bottle").
  - Category (e.g., "canned soup", "NSAID", "sugary drink", "whole grain").
  - Optional notes (brand, visible dosage form, obvious patterns such as "many sugary drinks").

**Constraints:**
- When uncertain, mark items as "unknown" or "ambiguous" instead of guessing.
- Avoid inferring exact dosages or medical conditions from packaging alone.
- Follow any instructions defined in the Befit perception skill or recipe.

---

### 3. Context Interpreter

**Role:** Turn the user's text or transcribed voice question into a clear intent and constraints.

**Responsibilities:**
- Parse the user's question to identify:
  - Primary goal (e.g., blood pressure, energy, weight management, general health).
  - Target person (self vs. elder vs. family).
  - Constraints (e.g., vegetarian, low-sodium, allergies if provided).
- Return a compact intent object the Planner and other agents can use.

**Constraints:**
- Must not assume medical history beyond what the user explicitly provides.
- When information is missing, default to generic, conservative assumptions and note that in the intent.

---

### 4. Risk Checker

**Role:** Evaluate items and intents for simple, rule-based wellness risks and flags.

**Responsibilities:**
- Apply simple, transparent rules (from Befit risk tables) to:
  - Flag patterns such as "many high-sodium canned foods", "multiple NSAIDs", or "very sugary beverages".
- Produce:
  - A list of flags with short explanations.
  - A summary of what is not assessed (e.g., no detailed drug–drug interaction checking).

**Constraints:**
- Must use only the knowledge tables and rules provided by the project (no ad-hoc medical advice).
- Must be explicit about limitations, especially around medications and emergencies.

---

### 5. Plan Writer

**Role:** Turn items, intent, and risk flags into a short, actionable "Today's Plan" or "Today's Answer" card.

**Responsibilities:**
- Generate 2–3 concrete, achievable micro-actions tied directly to detected items (e.g., swaps, timing changes, questions to ask a clinician).
- Provide a brief "Why" section that explains the rationale in plain language.
- Include clear limitations and disclaimers.

**Constraints:**
- Avoid prescriptive dosing or diagnostic language.
- Keep guidance specific to what was detected and user-stated goals.
- Use empathetic, non-judgmental tone suited to women and caregivers.

---

### 6. Reflector

**Role:** Review and refine drafts for safety, clarity, and alignment with project constraints.

**Responsibilities:**
- Check the Plan Writer's draft for:
  - Unsafe or over-confident claims.
  - Inconsistencies with detected items and risk flags.
  - Missing or weak disclaimers and limitations.
- Suggest and apply revisions to improve:
  - Safety and conservatism.
  - Clarity of actions and rationales.
  - Alignment with Befit's documented limitations.

**Constraints:**
- When in doubt about safety, prefer to soften or remove advice and explicitly recommend consulting a clinician.
- Must ensure disclaimers are present and prominent in the final output.

---

## Interaction Summary

Typical workflow for a single request:

1. User provides an image (or live frame from video) and a question via voice or text.
2. **Befit Planner**:
   - Calls **Vision Interpreter** to detect and categorize items.
   - Calls **Context Interpreter** to structure the user's goal and constraints.
   - Calls **Risk Checker** with items + intent to get flags.
   - Calls **Plan Writer** with items + intent + flags to generate a draft plan.
   - Calls **Reflector** to review and refine the draft.
3. Planner returns the final "Today's Plan" or "Today's Answer" card to the user.

This structure is intended to support:
- Planning
- Tool use
- Reflection
- Multi-agent collaboration

while keeping the system debuggable and safe for a wellness-oriented, non-diagnostic product.

## Local Dev
- Run Befit locally with uvicorn (`uv run uvicorn backend.main:app --reload`); do not rely on platform-specific scripts like start.bat.

## Audio Output (TTS)
- The Planner coordinates TTS audio output as part of the scan-and-plan flow via `POST /tts`.
- **Primary:** ElevenLabs (`eleven_turbo_v2`). **Fallback:** WebSpeech API (`window.speechSynthesis`)
  activates automatically when `/tts` returns 502/503 (credits exhausted or key not set).
- A **single** `SpeechRecognition` instance handles both query input and TTS voice commands,
  mode-switched by a `ttsListening` boolean. This avoids Chromium's silent failure when two
  recognition instances compete for the mic.
- Supported voice commands during playback: **listen** (from beginning), **play** (resume),
  **pause**, **stop**. The player bar shows *"Say: listen • play • pause • stop"* as a hint.
- The `ELEVENLABS_API_KEY` is server-side only and never exposed to the browser.
- Auto-plays when the plan card renders; tears down cleanly on both reset buttons.
- Voice command re-arming works correctly for both ElevenLabs and WebSpeech backends.


## Camera / Live Frame Capture
- The Vision Interpreter accepts both file-uploaded images and frames captured from the live camera feed.
- `initCamera()` starts automatically on page load, requesting the rear-facing camera (`facingMode: environment`).
- **Manual mode (default):** The "Capture" button snapshots the live frame.
- **Auto-capture mode:** An "Auto-capture" toggle in the camera section header starts a 3-second
  countdown. The hint pill updates each second and `captureFrame()` fires automatically. The
  manual Capture button is hidden while auto-capture is active.
- Both modes produce an identical base-64 JPEG sent to `/scan-and-plan`.
- "Retake" restarts the camera stream (and re-arms the countdown if auto-capture is on).
- If camera access is denied or unavailable, a descriptive error is shown and the "Upload image" fallback remains accessible.
- **Boot order:** `initCamera().then(initSpeech)` — speech recognition is initialised only after the camera `getUserMedia` promise resolves, preventing Chromium from silently invalidating the `SpeechRecognition` instance during permission grant.
