import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mainViewRPC } from "./rpc/router";

const activeDownload = { current: false };

function resolveWhisperFileName(): string {
  const { platform, arch } = process;
  if (platform === "win32") return `whisper-cli-win-${arch}.exe`;
  if (platform === "darwin") return `whisper-cli-mac-${arch}`;
  return `whisper-cli-linux-${arch}`;
}

function resolveWhisperBinPath(): string {
  const cwd = process.cwd();
  const targetName = resolveWhisperFileName();
  if (cwd.endsWith("/bin") || cwd.endsWith("\\bin")) {
    return join(cwd, targetName);
  }
  return join(cwd, "bin", targetName);
}

export function isWhisperInstalled(): boolean {
  return existsSync(resolveWhisperBinPath());
}

export function isWhisperDownloading(): boolean {
  return activeDownload.current;
}

export async function installWhisper(): Promise<{ started: boolean }> {
  if (existsSync(resolveWhisperBinPath())) {
    return { started: false };
  }

  if (activeDownload.current) {
    return { started: true };
  }

  activeDownload.current = true;

  (async () => {
    const buildDir = join(tmpdir(), `whisper-build-${randomUUID()}`);
    try {
      mkdirSync(buildDir, { recursive: true });

      mainViewRPC.send.downloadProgress({
        progress: { modelKey: "whisper", percent: 0, speed: "Cloning..." },
      });

      const steps: Array<{ cmd: string[]; label: string; pct: number }> = [
        {
          cmd: [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            "v1.8.6",
            "https://github.com/ggml-org/whisper.cpp",
            "src",
          ],
          label: "Cloning whisper.cpp...",
          pct: 15,
        },
        {
          cmd: [
            "cmake",
            "-B",
            "build",
            "-S",
            "src",
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILD_SHARED_LIBS=OFF",
          ],
          label: "Configuring build...",
          pct: 35,
        },
        {
          cmd: ["cmake", "--build", "build", "--config", "Release", "-j"],
          label: "Compiling...",
          pct: 90,
        },
      ];

      for (const step of steps) {
        console.log(`[whisper] ${step.label}`);
        mainViewRPC.send.downloadProgress({
          progress: {
            modelKey: "whisper",
            percent: step.pct,
            speed: step.label,
          },
        });

        const proc = Bun.spawn({
          cmd: step.cmd,
          cwd: buildDir,
          stdout: "pipe",
          stderr: "pipe",
        });
        let stderr = "";
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        const drain = (async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stderr += decoder.decode(value, { stream: true });
          }
        })();
        const exitCode = await proc.exited;
        await drain;
        if (exitCode !== 0) {
          throw new Error(
            `${step.label} failed (code ${exitCode}): ${stderr.slice(-500)}`,
          );
        }
      }

      // Find built binary in multiple possible locations
      const possiblePaths = [
        join(buildDir, "build", "bin", "whisper-cli"),
        join(buildDir, "build", "bin", "Release", "whisper-cli"),
        join(buildDir, "build", "bin", "whisper-cli.exe"),
      ];
      const builtBinary = possiblePaths.find((p) => existsSync(p));
      if (!builtBinary) {
        throw new Error(
          `Build completed but binary not found. Checked: ${possiblePaths.join(", ")}`,
        );
      }

      // Save to app location + project bin
      const destPath = resolveWhisperBinPath();
      const destDir = join(destPath, "..");
      mkdirSync(destDir, { recursive: true });
      const data = await Bun.file(builtBinary).arrayBuffer();
      await Bun.write(destPath, data);
      chmodSync(destPath, 0o755);

      const projectBin = join(import.meta.dir, "..", "..", "bin");
      mkdirSync(projectBin, { recursive: true });
      const projectDest = join(projectBin, resolveWhisperFileName());
      await Bun.write(projectDest, data);
      chmodSync(projectDest, 0o755);

      mainViewRPC.send.downloadComplete({ modelKey: "whisper" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Whisper build failed: ${msg}`);
      mainViewRPC.send.downloadError({ modelKey: "whisper", error: msg });
    } finally {
      activeDownload.current = false;
      try {
        const { rmSync } = require("node:fs");
        rmSync(buildDir, { recursive: true, force: true });
      } catch {}
    }
  })();

  return { started: true };
}
