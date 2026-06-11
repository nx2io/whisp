# Offline Audio Transcriber — MVP Plan

> **Stack:** Electrobun (Bun + native webview) + whisper.cpp  
> **Goal:** A cross-platform desktop app that transcribes audio/video to text — fully offline, lightweight, one-time purchase ($10)

---

## The Problem

People pay $10–$30/month for cloud transcription (Otter.ai, Descript, Rev). They want:
- **Offline** — no internet? Still works. Private audio? Stays local.
- **Lightweight** — shouldn't need a GPU or 16GB RAM
- **One-time purchase** — not another subscription
- **Simple** — drag file in, get text out. That's it.

Existing offline options (MacWhisper, Buzz) are either Mac-only, heavy, or overcomplicated.

---

## MVP Scope — What To Build (4 weeks)

### Core Features (v1)

| # | Feature | Why |
|---|---|---|
| 1 | **Drag & drop audio/video** | MP3, WAV, M4A, MP4, MOV, WEBM — drop it in |
| 2 | **whisper.cpp transcription** | Runs locally on CPU, works on any machine, supports 100+ languages |
| 3 | **Model downloader** | Pick tiny/base/small/medium model. Download once, use forever. |
| 4 | **Text output + copy** | Show transcription, click-to-copy, export as .txt |
| 5 | **Progress bar** | Show % done, estimated time remaining |

### What NOT to build in v1

- ❌ Timestamps / word-level alignment
- ❌ Speaker diarization (who said what)
- ❌ Video playback synced to transcript
- ❌ Export to SRT/VTT/JSON (just .txt for now)
- ❌ Editing the transcript in-app
- ❌ Batch processing multiple files
- ❌ Custom vocabulary / prompting
- ❌ Cloud backup / sync
- ❌ Live/real-time microphone recording
- ❌ Auto-updater (use Electrobun's built-in bsdiff later)

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Runtime** | Bun 1.x | Ships with Electrobun, fast, TypeScript-native |
| **Desktop shell** | Electrobun v1.18+ | ~14MB bundles, system webview, RPC, cross-platform |
| **UI** | React, Shadcn | Webview-based UI, keep it simple |
| **Transcription engine** | whisper.cpp | Runs on CPU, GGML models, C++ → CLI, proven |
| **Model management** | HuggingFace model download (direct HTTP) | Download .ggml files from HuggingFace |
| **Packaging** | Electrobun `bun build:release` | Native .app / .exe / .AppImage |

### whisper.cpp Setup

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
# Build (uses CMake — works on macOS/Linux/Windows)
cmake -B build
cmake --build build --config Release
# The binary is build/bin/whisper-cli
```

Electrobun's main process (Bun) calls `whisper-cli` as a subprocess:

```
whisper-cli -m models/ggml-base.en.bin -f audio.wav -otxt
```

---

## Project Structure

```
whisp/
├── package.json              # bun/electrobun config
├── tsconfig.json
├── electrobun.config.ts      # Electrobun build config
├── src/
│   ├── main/                 # Bun main process
│   │   ├── index.ts          # Entry point, window creation
│   │   ├── transcriber.ts    # whisper.cpp subprocess manager
│   │   ├── model-manager.ts  # Download & manage GGML models
│   │   ├── file-utils.ts     # Audio extraction, temp files
│   │   └── rpc-handlers.ts   # RPC methods exposed to webview
│   └── webview/              # UI (runs in system webview)
│       ├── index.html
│       ├── styles.css
│       ├── app.js            # Main UI logic
│       └── components/
│           ├── drop-zone.js
│           ├── model-picker.js
│           └── transcript-view.js
├── models/                   # Downloaded GGML models (gitignored)
├── bin/                      # whisper.cpp binary per platform
└── assets/
    └── icon.png
```

---

## Database / State

No database. Simple JSON config file at `~/.audio-transcriber/config.json`:

```json
{
  "model": "base.en",
  "modelsDir": "~/.audio-transcriber/models",
  "language": "auto",
  "theme": "system"
}
```

That's it. No SQL, no migrations, no ORM.

---

## RPC API (Main Process ↔ Webview)

Electrobun uses typed RPC. The webview calls methods exposed by the main process:

```typescript
// Main process exposes:
rpc.expose("transcribe", async (filePath: string) => { ... })
rpc.expose("getModels", async () => { ... })
rpc.expose("downloadModel", async (modelName: string) => { ... })
rpc.expose("selectFile", async () => { ... })  // native file dialog
rpc.expose("getTranscription", async (jobId: string) => { ... })

// Main process can push to webview:
rpc.send("progress", { jobId, percent, eta })
rpc.send("downloadProgress", { modelName, percent })
```

---

## Screens (3 pages)

### 1. Main Window — Drop Zone + Transcribe
```
┌─────────────────────────────────────────┐
│  🎙️ Offline Audio Transcriber           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     Drop audio/video here       │    │
│  │         or click to browse      │    │
│  │                                 │    │
│  │   MP3 · WAV · M4A · MP4 · MOV   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Model: [base.en ▼]  Language: [auto ▼] │
│                                         │
│  [Transcribe]  (disabled until file)    │
└─────────────────────────────────────────┘
```

### 2. Transcribing — Progress
```
┌─────────────────────────────────────────┐
│  🔄 Transcribing...                     │
│                                         │
│  interview.mp3  •  12.4 MB              │
│                                         │
│  ████████████░░░░░░░░  62%              │
│  ~2 min remaining                       │
│                                         │
│  [Cancel]                               │
└─────────────────────────────────────────┘
```

### 3. Result — Transcript View
```
┌─────────────────────────────────────────┐
│  ✅ Done — interview.mp3                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ So we started the project back  │    │
│  │ in March and the initial scope  │    │
│  │ was pretty narrow. We wanted to │    │
│  │ build a simple tool that would  │    │
│  │ ...                             │    │
│  │                                 │    │
│  │  [scrollable]                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Copy All]  [Export .txt]  [New File]  │
└─────────────────────────────────────────┘
```

---

## Build Order (Week-by-Week)

### Week 1: Skeleton + Electrobun Setup

- [ ] Install Bun: `curl -fsSL https://bun.sh/install | bash`
- [ ] Run `npx electrobun init` to scaffold project
- [ ] Verify it builds and opens a window
- [ ] Set up webview UI shell: HTML + CSS, dark/light theme toggle
- [ ] Create the drop zone component (drag events, file type validation)
- [ ] Wire up RPC: webview calls `selectFile` → main process opens native dialog
- [ ] **Deliverable:** App opens, you can drop/select an audio file, path shows in UI

### Week 2: whisper.cpp Integration

- [ ] Clone and build whisper.cpp for your dev platform
- [ ] Download `ggml-base.en.bin` (~142MB) from HuggingFace
- [ ] Test CLI: `whisper-cli -m models/ggml-base.en.bin -f test.wav -otxt`
- [ ] Build `transcriber.ts`: spawn whisper-cli as subprocess, parse stdout for progress
- [ ] Build `model-manager.ts`: download models from HuggingFace, show download progress
- [ ] Wire RPC: `transcribe(filePath)` → runs whisper → streams progress → returns text
- [ ] **Deliverable:** Drop an audio file → transcription appears in the UI

### Week 3: UI Polish + Export

- [ ] Transcript view: scrollable text area, copy button, export .txt button
- [ ] Model picker dropdown: tiny / base / small — download status indicator
- [ ] Progress bar with estimated time (track whisper's progress output)
- [ ] Cancel button: kill whisper subprocess
- [ ] Error states: unsupported format, whisper not found, model not downloaded
- [ ] **Deliverable:** Full flow works end-to-end, looks decent

### Week 4: Packaging + Cross-Platform

- [ ] Test on macOS (primary), Linux (secondary), Windows (if possible)
- [ ] Bundle whisper.cpp binary inside the app (copy to `bin/` per platform)
- [ ] Configure Electrobun build for release
- [ ] Set app icon, name, version
- [ ] Test self-extracting bundle size (target: <200MB with base model)
- [ ] Write README: install instructions, supported formats, model guide
- [ ] **Deliverable:** Double-clickable app that works offline

---

## whisper.cpp Models (Size vs Accuracy)

| Model | Size | RAM Needed | Speed (M1) | Best For |
|---|---|---|---|---|
| `tiny.en` | 74 MB | ~390 MB | ~32x realtime | Quick drafts |
| `base.en` | 142 MB | ~500 MB | ~16x realtime | **MVP default** |
| `small.en` | 466 MB | ~1.0 GB | ~6x realtime | Accuracy matters |
| `medium.en` | 1.5 GB | ~2.6 GB | ~2x realtime | Professional use |
| `large-v3` | 2.9 GB | ~4.5 GB | ~1x realtime | Best quality |

**MVP recommendation:** Bundle `base.en` as default, offer `small.en` and `tiny.en` as downloads. The model manager handles downloading on first use.

---

## File Format Handling

whisper.cpp accepts 16kHz mono WAV. We need to convert input formats:

```bash
# Extract audio from video, convert to 16kHz mono WAV
ffmpeg -i input.mp4 -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

**Two approaches for MVP:**

| Approach | Pro | Con |
|---|---|---|
| Bundle ffmpeg (~80MB) | Works with all formats | Larger bundle |
| Use system ffmpeg if available | Smaller bundle | Needs ffmpeg installed |

**Decision for v1:** Bundle ffmpeg binary per platform. It's worth the 80MB for the "it just works" experience. Total app bundle under 250MB which is fine for a desktop app.

---

## Monetization Strategy

| Stage | Price | What |
|---|---|---|
| Beta (first 20 users) | Free | Get feedback, fix bugs |
| Launch | $10 one-time | All features, lifetime updates for v1.x |
| v2 Upgrade | $5 upgrade | Timestamps, SRT export, speaker diarization |

**License key:** Simple offline check. Generate key from email + secret. Embed in app. No DRM, no phone-home. Honest users pay. Pirates are free marketing.

---

## Competition Map

| Tool | Offline | Price | Platforms | Size |
|---|---|---|---|---|
| MacWhisper | ✅ | $30 one-time | Mac only | Heavy |
| Buzz | ✅ | Free (OSS) | Win/Linux | Clunky UI |
| Otter.ai | ❌ | $17/mo | Web | Cloud |
| Descript | ❌ | $24/mo | Mac/Win | Cloud |
| **Our App** | ✅ | **$10 one-time** | **Mac/Win/Linux** | **~250MB** |

The wedge: cross-platform, one-time purchase, dead simple UI, lightweight.

---

## Common Pitfalls

| Mistake | Fix |
|---|---|
| "We need GPU acceleration for speed" | No. CPU whisper is fast enough for v1. 10-min audio = ~40s on base model. |
| "Let's add real-time microphone recording" | v2. Complicates UI and introduces latency expectations. |
| "We should support 100+ export formats" | Just .txt. They can copy-paste anywhere. |
| "The design isn't polished" | Ship ugly. Transcribers care about accuracy, not rounded corners. |
| "We need a website + Stripe + landing page first" | No. Gumroad / LemonSqueezy in 10 minutes. Build the app first. |
| "Let me add speaker diarization" | Adds complexity + larger models. v2 feature. |

---

## What Success Looks Like (Week 4)

You open the app. You drag in a 10-minute podcast MP3. The progress bar moves. 40 seconds later, full transcript appears. You click "Copy All" and paste it into your notes. No internet. No login. No subscription nag. It just works.

Someone on Reddit posts: *"Finally, a $10 offline transcriber that doesn't need a GPU. Been looking for this for months."*

That's it. That's the MVP.
