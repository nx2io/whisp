# Whisp

Offline audio/video transcriber for Linux. Drag a file in, get text out. No internet required.

## Stack

- **Runtime:** Bun 1.3
- **Desktop shell:** Electrobun 1.18 (system webview + native window)
- **Frontend:** React 19 + TailwindCSS v4 + shadcn
- **Transcription:** whisper.cpp (built from source, CPU-only)
- **Audio conversion:** FFmpeg (static build)

## Quick Start

### Prerequisites

```bash
# Build tools for whisper.cpp
sudo apt install cmake make g++ git tar unzip

# Bun (if not installed)
curl -fsSL https://bun.sh/install | bash
```

### Install

```bash
bun install
```

### Run (dev mode)

```bash
bun run dev
```

The app opens. Use the UI to:
1. **Install whisper.cpp** — builds from source (~2-3 minutes)
2. **Install FFmpeg** — downloads static binary (~40MB)
3. **Download a model** — pick base.en (148MB) or any other model
4. **Browse/drop an audio/video file** and click Transcribe

### Scripts

| Command | Description |
|---|---|
| `bun run dev` | Dev mode with hot-reload |
| `bun run build` | Production build |
| `bun test` | Run unit tests |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Biome lint check |
| `bun run format` | Auto-format with Biome |

## Project Structure

```
src/
  bun/                    # Bun main process
    index.ts              # Entry point
    transcriber.ts        # whisper.cpp subprocess manager
    model-manager.ts      # Model downloader (HuggingFace)
    ffmpeg-manager.ts     # FFmpeg downloader
    whisper-manager.ts    # whisper.cpp builder (from source)
    config.ts             # JSON config (~/.whisp/config.json)
    file-utils.ts         # Audio conversion, temp files
    rpc/                  # RPC handlers + router
  shared/                 # Types & constants shared between bun ↔ webview
    rpc/schema.ts         # Full typed RPC schema
  views/main/             # Webview (React + TailwindCSS)
    home.tsx              # Main UI: drop zone, model picker, transcript
    components/ui/        # shadcn components (button, progress)
    lib/rpc.ts            # Electroview RPC client + message bus
tests/                    # Unit tests
docs/                     # Design docs
bin/                      # (gitignored) FFmpeg + whisper-cli binaries
models/                   # (gitignored) Downloaded GGML models
data/                     # (gitignored) Transcript output
```

## Supported Formats

**Audio:** MP3, WAV, M4A, OGG, FLAC, WMA, AAC, Opus, AIFF, ALAC
**Video:** MP4, MOV, MKV, AVI, WMV, FLV, M4V, WEBM

## Models

| Model | Size | Best For |
|---|---|---|
| Tiny (English) | 78 MB | Quick drafts |
| Base (English) | 148 MB | **Default** — good balance |
| Small (English) | 488 MB | Higher accuracy |
| Tiny/Base/Small (Multilingual) | Same sizes | Non-English audio |
