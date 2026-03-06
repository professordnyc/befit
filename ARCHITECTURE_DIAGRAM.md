# Befit Architecture Diagram

**Date:** 2026-03-06
**Description:** Detailed architecture diagrams for the Befit multimodal wellness assistant — covering system overview, frontend, backend, agent pipeline, TTS, camera capture, data flow, and deployment.

---

## 1. System Overview

Befit is a cloud-deployed, multimodal wellness assistant. The browser/mobile client is served via Netlify's global CDN and communicates with a FastAPI backend hosted on Render. The backend orchestrates calls to external AI APIs (OpenRouter/Claude for LLM reasoning and ElevenLabs for text-to-speech). GitHub Actions provides CI/CD, triggering both Netlify and Render deployments on push.

```mermaid
graph LR
    User["User\nBrowser / Mobile"]
    Netlify["Netlify CDN\nFrontend Host"]
    Render["Render Web Service\nFastAPI Backend"]
    OpenRouter["OpenRouter / Claude\nLLM API"]
    ElevenLabs["ElevenLabs\nTTS API"]
    GitHub["GitHub Repo"]
    GHA["GitHub Actions\nCI/CD"]

    User <-->|"HTTPS requests"| Netlify
    Netlify <-->|"Proxy to backend URL"| Render
    Render <-->|"POST /v1/messages"| OpenRouter
    Render <-->|"POST /v1/text-to-speech"| ElevenLabs
    GitHub --> GHA
    GHA -->|"Build and deploy hook"| Netlify
    GHA -->|"Deploy hook"| Render
```

---

## 2. Frontend Architecture

The frontend is intentionally minimal — three files served as static assets. `index.html` defines the UI structure, `style.css` provides mobile-first responsive styles and design tokens, and `app.js` contains all interactive logic split into four logical modules: Camera, STT, TTS, and Pipeline. Data flows from capture/upload through a single `imageDataUri` variable, then to the API, and finally to the rendered plan card (which triggers TTS auto-play).

```mermaid
graph TD
    subgraph HTML["index.html — UI Structure"]
        Header["Header (logo, tagline)"]
        Step1["Step 1: Camera / Upload Section\nvideo, canvas, file input,\ncapture btn, auto-capture toggle, retake btn"]
        Step2["Step 2: Query Section\ntextarea, mic button, voice hint"]
        SubmitBtn["Submit Button (Scan and Plan)"]
        PlanCard["Today's Plan Card\ngoal_summary, risk_flags, actions, why, limitations"]
        Footer["Footer (disclaimer, links)"]
    end

    subgraph CSS["style.css — Styles"]
        Tokens["Design Tokens\nCSS custom properties:\n--primary, --surface, --radius, --shadow"]
        Mobile["Mobile-first base styles\nbreakpoints: 420px, 360px"]
        A11y["Accessibility\nfocus-visible, ARIA, high-contrast outlines"]
    end

    subgraph JS["app.js — Modules"]
        CameraMod["Camera Module\ninitCamera · startCamera\ncaptureFrame · retake\nstartAutoCountdown · cancelAutoCountdown"]
        STTMod["STT Module\ninitSpeech · recognition\nalways-on mic listener\ntranscript to textarea"]
        TTSMod["TTS Module\nttsPlay · ttsPause · ttsStop\nttsRestart · ttsReset\nWebSpeech fallback (ttsListening flag)"]
        Pipeline["Pipeline Module\nrunPipeline\nfetch /scan-and-plan\nrenderCard\nauto-play TTS"]
    end

    Step1 -->|"base64 JPEG"| imageDataUri["imageDataUri (shared state)"]
    UploadFallback["File Upload fallback (FileReader)"] -->|"base64 JPEG"| imageDataUri
    Step2 -->|"user_query text"| Pipeline
    imageDataUri --> Pipeline
    Pipeline -->|"POST /scan-and-plan"| API["Backend API"]
    API -->|"TodayCard JSON"| Pipeline
    Pipeline --> PlanCard
    PlanCard -->|"goal_summary text"| TTSMod
    TTSMod -->|"voice output"| User2["User"]
    STTMod -->|"transcript"| Step2
    CameraMod --> Step1
```

---

## 3. Backend Architecture

The FastAPI backend (`backend/main.py`) serves both the frontend static files and the AI pipeline endpoints. The two core endpoints are `POST /scan-and-plan` (which drives the full agent pipeline) and `POST /tts` (which proxies ElevenLabs). All request/response bodies are validated via Pydantic v2 schemas, ensuring type safety throughout the pipeline.

```mermaid
graph TD
    subgraph FastAPI["FastAPI App — backend/main.py"]
        R1["GET /\nserve frontend/index.html"]
        R2["GET /style.css\nserve frontend/style.css"]
        R3["GET /app.js\nserve frontend/app.js"]
        R4["GET /health\nliveness check"]
        R5["POST /scan-and-plan\nvalidate ScanAndPlanRequest\nplanner.run()\nreturn TodayCard"]
        R6["POST /tts\nproxy to ElevenLabs\nreturn audio/mpeg\n502/503 on failure"]
        R7["GET /assets/*\nStaticFiles mount"]
    end

    subgraph Schemas["Pydantic v2 Schemas"]
        Req["ScanAndPlanRequest\nimage_url: str\nuser_query: str\nuser_context: str (optional)"]
        DI["DetectedItem\nname: str\ncategory: str\nnotes: str (optional)"]
        RF["RiskFlag\nlevel: info or warning or caution\nmessage: str"]
        Act["Action\ntitle: str\ndescription: str"]
        TC["TodayCard\nitems_detected: List[DetectedItem]\ngoal_summary: str\nrisk_flags: List[RiskFlag]\nactions: List[Action]\nwhy: str\nlimitations: str"]
    end

    subgraph PlannerBox["Planner — agents/planner.py"]
        PlannerNode["planner.run(request)\norchestrates sub-agents\nreturns TodayCard"]
    end

    R5 --> Req
    Req --> PlannerNode
    PlannerNode --> TC
    TC --> R5
    DI -.->|"used by"| TC
    RF -.->|"used by"| TC
    Act -.->|"used by"| TC
```

---

## 4. Agent Pipeline (Core Flow)

The Befit agent pipeline follows a hierarchical planner-worker-reflector pattern. The Planner orchestrates five specialist sub-agents in sequence. The Vision Interpreter and Context Interpreter both call OpenRouter/Claude. The Risk Checker is a deterministic Python rules engine — no LLM call. Plan Writer and Reflector each make LLM calls. The Reflector is the final quality/safety gate before the assembled `TodayCard` is returned.

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant API as FastAPI /scan-and-plan
    participant Planner as Planner
    participant Vision as Vision Interpreter
    participant Context as Context Interpreter
    participant Risk as Risk Checker
    participant Writer as Plan Writer
    participant Reflector as Reflector
    participant LLM as OpenRouter/Claude

    Browser->>API: POST /scan-and-plan (image_url, user_query, user_context)
    API->>Planner: planner.run(request)

    Planner->>Vision: interpret(image_url)
    Vision->>LLM: multimodal prompt (image + system instructions)
    LLM-->>Vision: structured item list
    Vision-->>Planner: List[DetectedItem]

    Planner->>Context: interpret(user_query, user_context)
    Context->>LLM: text prompt (goal extraction)
    LLM-->>Context: intent JSON
    Context-->>Planner: intent {goal, person, constraints, notes, user_question}

    Planner->>Risk: check(items, intent)
    Note over Risk: Pure Python rules - no LLM call
    Risk-->>Planner: List[RiskFlag]

    Planner->>Writer: write(items, intent, risk_flags)
    Writer->>LLM: text prompt (plan generation)
    LLM-->>Writer: draft {goal_summary, actions, why, limitations}
    Writer-->>Planner: draft plan

    Planner->>Reflector: reflect(draft, items, risk_flags)
    Reflector->>LLM: text prompt (safety and clarity review)
    LLM-->>Reflector: refined {goal_summary, actions, why, limitations}
    Reflector-->>Planner: refined plan

    Planner->>Planner: assemble TodayCard (items + refined plan + risk_flags)
    Planner-->>API: TodayCard
    API-->>Browser: TodayCard JSON
```

---

## 5. TTS Architecture

Audio output uses a dual-path architecture. The browser first calls the server-side `POST /tts` proxy, which forwards to ElevenLabs. If ElevenLabs is unavailable (credits exhausted, key missing, 502/503), the client automatically falls back to the browser's native `window.speechSynthesis` (WebSpeech API) — no server-side configuration required. A single `SpeechRecognition` instance handles both query input and TTS voice commands, mode-switched via a `ttsListening` boolean to prevent Chromium's silent mic-competition failure.

```mermaid
graph TD
    Browser["Browser - app.js TTS module"]
    TTSEndpoint["POST /tts\ntext: string\nFastAPI proxy"]
    ElevenLabs["ElevenLabs API\neleven_turbo_v2\nRachel voice"]
    AudioEl["HTMLAudioElement\n.play()"]
    WebSpeech["window.speechSynthesis\nWebSpeech API fallback"]
    VoiceCmd["Voice Commands\nsingle SpeechRecognition instance\nttsListening boolean flag"]

    Browser -->|"ttsPlay(text)"| TTSEndpoint
    TTSEndpoint -->|"POST with ElevenLabs API key (server-side only)"| ElevenLabs
    ElevenLabs -->|"200 OK - audio/mpeg stream"| TTSEndpoint
    TTSEndpoint -->|"audio blob"| AudioEl
    AudioEl -->|"plays to speaker"| Speaker["Speaker"]

    ElevenLabs -->|"502 / 503 (credits or key missing)"| TTSEndpoint
    TTSEndpoint -->|"relay error status"| Browser
    Browser -->|"automatic fallback"| WebSpeech
    WebSpeech -->|"speaks text"| Speaker

    VoiceCmd -->|"listen: ttsRestart\nplay: resume\npause: ttsPause\nstop: ttsStop"| AudioEl
    VoiceCmd -->|"same commands"| WebSpeech

    subgraph ModeSwitch["SpeechRecognition Mode Switch"]
        QueryMode["Query mode (ttsListening = false)\nfills textarea"]
        TTSMode["TTS command mode (ttsListening = true)\ncontrols playback"]
    end
    VoiceCmd --- ModeSwitch
```

---

## 6. Camera & Capture Flow

The camera subsystem supports two capture modes sharing the same downstream path. Manual mode is the default; auto-capture is opt-in via toggle. Both modes produce an identical base-64 JPEG stored in `imageDataUri`, which is then sent to `/scan-and-plan`. A file upload fallback uses the same `FileReader → imageDataUri` path. On boot, `initCamera()` is called first and speech recognition is initialised only after the camera `getUserMedia` promise resolves — this prevents Chromium from silently invalidating the `SpeechRecognition` instance during permission grant.

```mermaid
graph TD
    Boot["Page Load"]
    InitCam["initCamera()\ngetUserMedia\nfacingMode: environment"]
    InitSpeech["initSpeech()\nSpeechRecognition setup"]
    Boot -->|"boot order"| InitCam
    InitCam -->|".then() — camera ready"| InitSpeech

    subgraph ManualMode["Manual Mode (default)"]
        UserTap["User taps Capture button"]
        CaptureFrame["captureFrame()\ndraw video to canvas\ncanvas.toDataURL JPEG"]
    end

    subgraph AutoMode["Auto-Capture Mode"]
        Toggle["User toggles Auto-capture ON"]
        Countdown["startAutoCountdown()\n3s countdown\nhint pill: 3... 2... 1..."]
        AutoFire["captureFrame() auto-fires at 0"]
    end

    subgraph UploadFallback["Upload Fallback"]
        FileInput["User selects file (file input)"]
        FileReader["FileReader\n.readAsDataURL()"]
    end

    UserTap --> CaptureFrame
    Toggle --> Countdown
    Countdown --> AutoFire

    CaptureFrame -->|"base64 JPEG"| imageDataUri["imageDataUri (shared state)"]
    AutoFire -->|"base64 JPEG"| imageDataUri
    FileReader -->|"base64 JPEG"| imageDataUri
    FileInput --> FileReader

    imageDataUri -->|"included in POST body"| API["POST /scan-and-plan"]

    Retake["User taps Retake"]
    Retake -->|"cancelAutoCountdown() + initCamera()"| InitCam
```

---

## 7. Data Flow & Schemas

Every stage of the pipeline has a well-defined schema. Data enters as a `ScanAndPlanRequest`, is transformed by each agent into progressively richer structures, and exits as a fully assembled `TodayCard`. The Pydantic v2 schemas enforce type safety at the API boundary; agent-internal dicts (intent, draft) are validated via inline parsing before being passed to downstream agents.

```mermaid
graph TD
    Req["ScanAndPlanRequest\nimage_url: str\nuser_query: str\nuser_context: str (optional)"]

    DI["List[DetectedItem]\nname: str\ncategory: str\nnotes: str (optional)"]

    Intent["intent dict\ngoal: str\nperson: str\nconstraints: list of str\nnotes: str\nuser_question: str"]

    RF["List[RiskFlag]\nlevel: info or warning or caution\nmessage: str"]

    Draft["draft dict\ngoal_summary: str\nactions: list of str\nwhy: str\nlimitations: str"]

    Refined["refined dict\ngoal_summary: str\nactions: list of str\nwhy: str\nlimitations: str"]

    TC["TodayCard\nitems_detected: List[DetectedItem]\ngoal_summary: str\nrisk_flags: List[RiskFlag]\nactions: List[Action {title, description}]\nwhy: str\nlimitations: str"]

    Req -->|"Vision Interpreter (multimodal LLM)"| DI
    Req -->|"Context Interpreter (text LLM)"| Intent
    DI -->|"Risk Checker (pure Python rules)"| RF
    Intent -->|"feeds into Risk Checker"| RF
    DI -->|"Plan Writer (text LLM)"| Draft
    Intent -->|"Plan Writer"| Draft
    RF -->|"Plan Writer"| Draft
    Draft -->|"Reflector (text LLM)"| Refined
    Refined -->|"Planner assembles"| TC
    DI -->|"Planner assembles"| TC
    RF -->|"Planner assembles"| TC
```

---

## 8. Deployment Architecture

Befit uses a two-service cloud deployment: Netlify for the CDN-served frontend and Render for the Python backend. GitHub Actions enforces code quality (ruff, black, pytest) on every push and triggers both deployment hooks on success. All sensitive environment variables live exclusively on Render — the browser never sees any API keys. Python version is pinned via `.python-version` to ensure reproducible builds.

```mermaid
graph TD
    Dev["Developer - git push"]
    GHRepo["GitHub Repository"]
    GHA["GitHub Actions\nruff lint\nblack format check\npytest unit tests"]
    Netlify["Netlify CDN\nServes frontend/\nindex.html, style.css, app.js\nGlobal edge network"]
    Render["Render Web Service\nuv run uvicorn backend.main:app\n--host 0.0.0.0 --port PORT\nPython 3.12 (.python-version)"]
    EnvVars["Render Env Vars (server-side only)\nOPENAI_API_KEY\nOPENAI_BASE_URL\nBEFIT_MODEL\nELEVENLABS_API_KEY\nELEVENLABS_VOICE_ID"]
    OpenRouter["OpenRouter / Claude"]
    ElevenLabs["ElevenLabs"]
    Users["Users worldwide"]

    Dev --> GHRepo
    GHRepo --> GHA
    GHA -->|"all checks pass - Netlify build hook"| Netlify
    GHA -->|"all checks pass - Render deploy hook"| Render
    Render --- EnvVars
    Render <-->|"LLM calls"| OpenRouter
    Render <-->|"TTS calls"| ElevenLabs
    Users <-->|"HTTPS"| Netlify
    Netlify <-->|"API proxy (BACKEND_URL)"| Render
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Hierarchical Agent Pattern** | Planner orchestrates Vision Interpreter, Context Interpreter, Risk Checker, Plan Writer, then Reflector — mirroring Andrew Ng's plan-execute-reflect paradigm. Each agent has a single responsibility, making the pipeline debuggable and individually replaceable without rewiring the whole system. |
| **Single SpeechRecognition Instance (ttsListening flag)** | Chromium silently fails when two `SpeechRecognition` instances compete for the microphone simultaneously. A single instance mode-switched by a `ttsListening` boolean avoids this race condition — query capture and TTS voice commands never overlap. |
| **No-Diagnosis Safety Constraints** | Befit explicitly prohibits generating medical diagnoses, dosing instructions, or emergency guidance. These constraints are enforced in system prompts for every LLM-calling agent and reviewed by the Reflector. When uncertain, outputs are softened and clinician referral is recommended. |
| **WebSpeech Fallback Contract (502/503)** | ElevenLabs credits exhaust without warning. The contract is: server returns 502/503 on ElevenLabs failure; client detects this and silently falls back to `window.speechSynthesis`. Zero server-side configuration needed; the fallback is purely client-side and invisible to the user. |
| **Pre-unlock Pattern for Android 12+** | Android 12 requires a user gesture before `AudioContext` or `HTMLAudioElement.play()` is permitted. The TTS module gates audio playback on a prior user interaction (the submit tap) to satisfy this requirement, preventing silent audio failures on mobile. |
| **Rule-Based Risk Checker (No LLM)** | The Risk Checker uses deterministic Python rules rather than an LLM call. This makes risk flagging fast, transparent, auditable, and free from hallucination. Rules are documented in a simple table and can be extended without prompt engineering. |
| **Pydantic v2 Schemas** | All API request/response bodies are validated by Pydantic v2 models. This enforces type safety at the FastAPI boundary, provides automatic OpenAPI documentation, and ensures downstream agents always receive well-formed data — reducing runtime errors from malformed LLM outputs. |
