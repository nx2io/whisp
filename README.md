# Whisp

Offline audio and video transcription for Linux. Drop a file in, get text out. Speech recognition runs on your machine with [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Setup needs a network connection once. The app builds whisper.cpp, downloads FFmpeg, and downloads a speech model. After that, transcription works offline. Audio and video stay on the computer that runs Whisp.

The project is early (0.1.0). Linux is the platform we develop and test on.

## Features

- Browse for a file, or drop one on the window
- Local transcription with whisper.cpp (CPU)
- English and multilingual Whisper models, downloaded once
- Progress while a job runs
- Copy the transcript, or export it as `.txt`
- Light, dark, and system theme

## Stack

| Layer | Choice |
|---|---|
| Runtime | [Bun](https://bun.sh) 1.3 |
| Desktop shell | [Electrobun](https://blackboard.sh/electrobun/) (system webview) |
| UI | React 19, Tailwind CSS v4, shadcn |
| Transcription | whisper.cpp v1.8.6, built from source |
| Audio conversion | FFmpeg static build, downloaded on first run |

## Prerequisites

```bash
sudo apt install cmake make g++ git tar unzip
```

Bun 1.3:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick start

```bash
git clone https://github.com/kyrazolabs/Whisp.git
cd Whisp
bun install
bun run dev
```

On first launch, use the window to:

1. **Install whisper.cpp.** This clones and builds it. Expect a few minutes.
2. **Install FFmpeg.** This downloads a static binary (about 40 MB).
3. **Download a model.** `base.en` (148 MB) is the default.
4. **Browse or drop an audio or video file**, then transcribe.

Config is stored at `~/.whisp/config.json`. Models are stored at `~/.whisp/models`.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Dev mode with reload |
| `bun run build` | Build for the current platform |
| `bun test` | Unit tests |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Biome check |
| `bun run format` | Format with Biome |

## Supported formats

**Audio:** MP3, WAV, M4A, OGG, FLAC, WMA, AAC, Opus, AIFF, ALAC

**Video:** MP4, MOV, MKV, AVI, WMV, FLV, M4V, WEBM

Video files are converted with FFmpeg before transcription. The transcript is plain text.

## Models

| Model | Size | Best for |
|---|---|---|
| Tiny (English) | 78 MB | Quick drafts |
| Base (English) | 148 MB | Default. A useful balance of speed and accuracy |
| Small (English) | 488 MB | Higher accuracy |
| Tiny, Base, Small (multilingual) | Same sizes | Non-English audio |

Models are the GGML builds published by [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) on Hugging Face.

## Project structure

```text
src/
  bun/                  Main process
    index.ts            Entry point
    transcriber.ts      whisper.cpp subprocess
    model-manager.ts    Model downloads
    ffmpeg-manager.ts   FFmpeg download
    whisper-manager.ts  whisper.cpp build
    config.ts           ~/.whisp/config.json
    file-utils.ts       Audio conversion and temp files
    rpc/                RPC handlers and router
  shared/               Types and constants shared by the main process and the UI
    rpc/schema.ts       Typed RPC schema
  views/main/           React UI
    home.tsx            Drop zone, model picker, transcript
    lib/rpc.ts          RPC client
tests/                  Unit tests
docs/                   Design notes
```

`bin/`, `models/`, `data/`, and `build/` are gitignored. They hold binaries, downloaded models, and build output.

`skills/`, `agents/`, and `references/` are workflow instructions for coding agents. They are not part of the desktop app. See [AGENTS.md](AGENTS.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commit style, and pull requests. Bugs and ideas go to [GitHub Issues](https://github.com/kyrazolabs/Whisp/issues).

## Third-party software

Whisp itself is MIT. These components keep their own licenses:

- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) is built from source on install.
- Whisper GGML models are downloaded from Hugging Face.
- FFmpeg is downloaded on first run (the Linux build comes from [johnvansickle.com](https://johnvansickle.com/ffmpeg/)). FFmpeg's license is separate from Whisp's.

## License

[MIT](LICENSE) © 2026 Kyrazo LLC
