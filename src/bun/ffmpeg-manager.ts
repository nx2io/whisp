import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mainViewRPC } from "./rpc/router";

const activeDownload = { current: false };

function resolveFfmpegFileName(): string {
  const { platform, arch } = process;
  if (platform === "win32") return `ffmpeg-win-${arch}.exe`;
  if (platform === "darwin") return `ffmpeg-mac-${arch}`;
  return `ffmpeg-linux-${arch}`;
}

function resolveFfmpegBinPath(): string {
  const cwd = process.cwd();
  const targetName = resolveFfmpegFileName();

  // In bundled app: cwd IS the bin directory
  if (cwd.endsWith("/bin") || cwd.endsWith("\\bin")) {
    return join(cwd, targetName);
  }

  // In dev: binaries are under cwd/bin
  return join(cwd, "bin", targetName);
}

function getDownloadUrl(): string {
  const { platform } = process;

  if (platform === "linux") {
    return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz";
  }
  if (platform === "darwin") {
    return "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip";
  }
  return "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
}

export function isFfmpegInstalled(): boolean {
  return existsSync(resolveFfmpegBinPath());
}

export function isFfmpegDownloading(): boolean {
  return activeDownload.current;
}

export async function installFfmpeg(): Promise<{ started: boolean }> {
  if (existsSync(resolveFfmpegBinPath())) {
    return { started: false };
  }

  if (activeDownload.current) {
    return { started: true };
  }

  activeDownload.current = true;

  (async () => {
    const tmpDir = join(tmpdir(), `whisp-ffmpeg-${randomUUID()}`);
    const url = getDownloadUrl();
    const isTarXz = url.endsWith(".tar.xz");
    const ext = isTarXz ? ".tar.xz" : ".zip";
    const tmpFile = join(tmpdir(), `whisp-ffmpeg-${randomUUID()}${ext}`);
    try {
      mkdirSync(tmpDir, { recursive: true });

      console.log(`Downloading ffmpeg from ${url}`);

      mainViewRPC.send.downloadProgress({
        progress: { modelKey: "ffmpeg", percent: 0, speed: "Starting..." },
      });

      const response = await fetch(url, {
        signal: AbortSignal.timeout(300000),
        headers: { "User-Agent": "Whisp/1.0" },
      });
      console.log(
        `FFmpeg download response: ${response.status}, size: ${response.headers.get("content-length") || "unknown"}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get("content-length")) || 0;
      if (!response.body) throw new Error("No response body");

      const file = Bun.file(tmpFile);
      const writer = file.writer();
      let downloaded = 0;
      let lastProgress = 0;
      const startTime = Date.now();

      const reader = (response.body as ReadableStream<Uint8Array>).getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        downloaded += value?.length ?? 0;
        writer.write(value ?? new Uint8Array());

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        const percent =
          contentLength > 0
            ? Math.round((downloaded / contentLength) * 100)
            : Math.min(99, Math.round(downloaded / (50 * 1024 * 1024)) * 10);
        const speedStr =
          speed > 1024 * 1024
            ? `${(speed / (1024 * 1024)).toFixed(1)} MB/s`
            : `${(speed / 1024).toFixed(0)} KB/s`;

        // Throttle updates to every 5%
        if (percent - lastProgress >= 5 || done) {
          lastProgress = percent;
          console.log(`FFmpeg download: ${percent}% (${speedStr})`);
          mainViewRPC.send.downloadProgress({
            progress: { modelKey: "ffmpeg", percent, speed: speedStr },
          });
        }
      }

      await writer.end();

      // Extract
      if (tmpFile.endsWith(".tar.xz")) {
        await extractTarXz(tmpFile, tmpDir);
      } else {
        await extractZip(tmpFile, tmpDir);
      }

      // Find the ffmpeg binary in the extracted directory
      const ffmpegBinary = findFfmpegBinary(tmpDir);
      if (!ffmpegBinary) {
        throw new Error(
          "Could not find ffmpeg binary in archive. Structure: " +
            readdirSync(tmpDir).join(", "),
        );
      }

      // Save to app binary location
      const destPath = resolveFfmpegBinPath();
      const destDir = join(destPath, "..");
      mkdirSync(destDir, { recursive: true });
      const data = await Bun.file(ffmpegBinary).arrayBuffer();
      await Bun.write(destPath, data);
      if (process.platform !== "win32") chmodSync(destPath, 0o755);

      // Also save to project bin/ so it survives dev restarts
      const projectBin = join(import.meta.dir, "..", "..", "bin");
      if (!existsSync(projectBin)) mkdirSync(projectBin, { recursive: true });
      const projectDest = join(projectBin, resolveFfmpegFileName());
      await Bun.write(projectDest, data);
      if (process.platform !== "win32") chmodSync(projectDest, 0o755);

      mainViewRPC.send.downloadComplete({ modelKey: "ffmpeg" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FFmpeg install failed: ${msg}`);
      mainViewRPC.send.downloadError({ modelKey: "ffmpeg", error: msg });
    } finally {
      activeDownload.current = false;
      try {
        await Bun.file(tmpFile).unlink();
      } catch {}
      try {
        rmrf(tmpDir);
      } catch {}
    }
  })();

  return { started: true };
}

async function extractTarXz(
  archivePath: string,
  destDir: string,
): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["tar", "-xf", archivePath, "-C", destDir],
    stdout: "pipe",
    stderr: "pipe",
  });

  const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  };

  await Promise.all([
    drain(proc.stdout.getReader()),
    drain(proc.stderr.getReader()),
    proc.exited,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`tar extraction failed with code ${proc.exitCode}`);
  }
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["unzip", "-o", archivePath, "-d", destDir],
    stdout: "pipe",
    stderr: "pipe",
  });

  const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  };

  await Promise.all([
    drain(proc.stdout.getReader()),
    drain(proc.stderr.getReader()),
    proc.exited,
  ]);

  if (proc.exitCode !== 0) {
    throw new Error(`unzip extraction failed with code ${proc.exitCode}`);
  }
}

function findFfmpegBinary(dir: string): string | null {
  const search = (d: string, depth: number): string | null => {
    if (depth > 3) return null;
    const entries = readdirSync(d);
    for (const entry of entries) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        const found = search(full, depth + 1);
        if (found) return found;
      } else if (entry === "ffmpeg" || entry === "ffmpeg.exe") {
        return full;
      }
    }
    return null;
  };

  return search(dir, 0);
}

function rmrf(dir: string): void {
  try {
    const { rmSync } = require("node:fs");
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}
