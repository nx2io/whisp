# Contributing to Whisp

Thanks for helping improve Whisp. This guide covers how to set up the app, how we expect changes to be made, and what to include in a pull request.

Whisp is an offline desktop transcriber. Product code lives in `src/`. The `skills/`, `agents/`, and `references/` directories are instructions for coding agents that work in this repository. Change those only when you are updating agent workflow, and keep them consistent with [AGENTS.md](AGENTS.md).

## Before you start

- Linux is the supported development platform. The main process has filename branches for macOS and Windows, but install paths, packaging, and testing are exercised on Linux.
- Open an issue before a large change so we can agree on the approach.
- Bug fixes and small improvements can go straight to a pull request.

Report bugs and ideas at [GitHub Issues](https://github.com/kyrazolabs/Whisp/issues). Include your distro, the Whisper model you used, the input file type, and the steps that reproduce the problem.

## Setup

Install the build tools Whisper needs, then install Bun 1.3 if you do not already have it:

```bash
sudo apt install cmake make g++ git tar unzip
curl -fsSL https://bun.sh/install | bash
```

Clone your fork and install dependencies from the lockfile:

```bash
git clone https://github.com/<you>/Whisp.git
cd Whisp
bun install
bun run dev
```

The first launch builds whisper.cpp from source, downloads a static FFmpeg build, and downloads a speech model. Those artifacts are written outside git (`bin/`, `~/.whisp/`). Transcription itself does not need a network connection after that.

See the [README](README.md) for the day-to-day commands and the model list.

## Making a change

Branch from `main`. Keep the branch short-lived.

```text
feature/<short-description>
fix/<short-description>
chore/<short-description>
refactor/<short-description>
docs/<short-description>
```

Each commit should do one thing. Use a message that says why the change exists:

```text
<type>: <short description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

Keep formatting separate from behavior changes. Biome is the formatter and linter: two-space indent, recommended rules, applied to `src/`, `tests/`, and the TypeScript config files.

Before you open a pull request:

```bash
bun test
bun run typecheck
bun run lint
```

`bun run format` rewrites files to match Biome. Run it when lint reports formatting issues.

## What not to commit

These are local, generated, or machine-specific. `.gitignore` already excludes them:

- `bin/` — whisper.cpp and FFmpeg binaries
- `models/` and `~/.whisp/` — downloaded GGML models and app config
- `build/` and `.electrobun/` — build output
- `node_modules/`
- `.env` and anything containing a secret, token, or credential

`bun.lock` is tracked on purpose. If you add or upgrade a dependency, commit the lockfile with that change.

## Pull requests

Open the pull request against `main`. In the description, include:

- What changed and why
- How you tested it (`bun test`, and the UI path if you touched the interface)
- A screenshot or short recording when the change is visible in the window

UI work should be checked the way a user would use it: browse or drop a file, transcribe, copy, and export `.txt`. If you change shared state such as config, model downloads, or the RPC schema, check the other screens that read that state.

## Where code goes

| Path | Role |
|---|---|
| `src/bun/` | Main process: window, transcription, model and FFmpeg install, RPC handlers |
| `src/views/main/` | React UI rendered in the system webview |
| `src/shared/` | Types, constants, and the RPC schema shared by both sides |
| `tests/` | Unit tests run with `bun test` |
| `docs/` | Design notes for the product |

RPC methods are typed in `src/shared/rpc/schema.ts`. Add or change a method there first, then implement the handler in `src/bun/rpc/` and call it from `src/views/main/lib/rpc.ts`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) that covers this repository.
