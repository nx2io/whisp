import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".flac",
  ".wma",
  ".aac",
  ".opus",
  ".aiff",
  ".alac",
];

export function isAudioFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

export function getFileName(filePath: string): string {
  return basename(filePath);
}

export function getFileSize(filePath: string): number {
  try {
    return Bun.file(filePath).size;
  } catch {
    return 0;
  }
}

export function ensureTempDir(): string {
  const dir = join(tmpdir(), "whisp");
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();

  const proc = Bun.spawn({
    cmd: [ffmpegPath, ...args],
    stderr: "pipe",
    stdout: "pipe",
  });

  // Consume stdout + stderr to prevent pipe deadlock
  const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  };

  const stderrReader = proc.stderr.getReader();
  const stdoutReader = proc.stdout.getReader();

  const drainPromise = Promise.all([drain(stderrReader), drain(stdoutReader)]);

  const exitCode = await proc.exited;
  await drainPromise;

  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}`);
  }
}

export async function convertToWav(inputPath: string): Promise<string> {
  if (isAudioFile(inputPath)) {
    const ext = extname(inputPath).toLowerCase();
    if (ext === ".wav") {
      return inputPath;
    }
  }

  const tempDir = ensureTempDir();
  const outputPath = join(tempDir, `${randomUUID()}.wav`);

  await runFfmpeg([
    "-i",
    inputPath,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    "-y",
    outputPath,
  ]);

  return outputPath;
}

export function cleanupTempFile(filePath: string): void {
  try {
    if (existsSync(filePath) && filePath.includes(tmpdir())) {
      unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}

function resolveBinDir(): string {
  // In bundled app: process.cwd() IS the bin directory
  const cwd = process.cwd();
  if (cwd.endsWith("/bin") || cwd.endsWith("\\bin")) {
    return cwd;
  }
  // In dev: binaries are under cwd/bin
  const cwdBin = join(cwd, "bin");
  if (existsSync(cwdBin)) return cwdBin;
  return cwdBin;
}

function resolveFfmpegPath(): string {
  const { platform, arch } = process;
  const bin = resolveBinDir();
  const base = join(bin, "ffmpeg");

  let path: string;
  if (platform === "win32") {
    path = `${base}-win-${arch}.exe`;
  } else if (platform === "darwin") {
    path = `${base}-mac-${arch}`;
  } else {
    path = `${base}-linux-${arch}`;
  }

  // Ensure executable (dev build copies may strip permissions)
  if (platform !== "win32" && existsSync(path)) {
    chmodSync(path, 0o755);
  }

  return path;
}
