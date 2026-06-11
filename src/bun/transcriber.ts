import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { TranscriptionJob, TranscriptionProgress } from "../shared/types";
import { loadConfig } from "./config";
import {
  cleanupTempFile,
  convertToWav,
  getFileName,
  getFileSize,
} from "./file-utils";
import { mainViewRPC } from "./rpc/router";

const MAX_COMPLETED_JOBS = 20;
const jobs = new Map<string, TranscriptionJob>();
const processes = new Map<string, Bun.Subprocess>();

function resolveBinDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("/bin") || cwd.endsWith("\\bin")) {
    return cwd;
  }
  return join(cwd, "bin");
}

function resolveWhisperPath(): string {
  const { platform, arch } = process;
  const bin = resolveBinDir();
  const base = join(bin, "whisper-cli");

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

function resolveModelPath(modelKey: string): string {
  const config = loadConfig();
  return join(config.modelsDir, `ggml-${modelKey}.bin`);
}

function pruneJobs(): void {
  if (jobs.size <= MAX_COMPLETED_JOBS) return;
  const entries = [...jobs.entries()];
  entries.sort(
    (a, b) =>
      new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime(),
  );
  for (const [id] of entries.slice(0, jobs.size - MAX_COMPLETED_JOBS)) {
    jobs.delete(id);
  }
}

export async function startTranscription(
  filePath: string,
): Promise<{ jobId: string }> {
  const jobId = randomUUID();
  const config = loadConfig();
  const fileName = getFileName(filePath);
  const fileSize = getFileSize(filePath);

  const job: TranscriptionJob = {
    jobId,
    filePath,
    fileName,
    fileSize,
    model: config.model,
    language: config.language,
    status: "running",
    progress: 0,
    eta: "Calculating...",
    text: "",
    error: "",
    startedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);

  (async () => {
    let wavPath: string | null = null;
    let outputTxtPath: string | null = null;
    try {
      wavPath = await convertToWav(filePath);
      const modelPath = resolveModelPath(config.model);

      if (!existsSync(modelPath)) {
        throw new Error(
          `Model "${config.model}" not found. Please download it first.`,
        );
      }

      const whisperPath = resolveWhisperPath();
      const outputBase = join(process.cwd(), "data", jobId);
      outputTxtPath = `${outputBase}.txt`;
      const args = ["-m", modelPath, "-f", wavPath, "-otxt", "-of", outputBase];

      if (config.language !== "auto") {
        args.push("-l", config.language);
      }

      const proc = Bun.spawn({
        cmd: [whisperPath, ...args],
        stderr: "pipe",
        stdout: "pipe",
      });

      processes.set(jobId, proc);

      const decoder = new TextDecoder();
      let stderrAccum = "";

      const readStderr = async () => {
        const reader = proc.stderr.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stderrAccum += decoder.decode(value, { stream: true });
            const progress = parseProgress(stderrAccum, job.fileSize);
            if (progress && job.status === "running") {
              job.progress = progress.percent;
              job.eta = progress.eta;
              const p: TranscriptionProgress = {
                jobId,
                percent: progress.percent,
                eta: progress.eta,
              };
              try {
                mainViewRPC.send.transcriptionProgress({ progress: p });
              } catch {}
            }
          }
        } catch {
          // reader closed
        }
      };

      // Drain stdout too so it doesn't block
      const drainStdout = async () => {
        const reader = proc.stdout.getReader();
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } catch {
          // reader closed
        }
      };

      await Promise.all([readStderr(), drainStdout(), proc.exited]);
      const exitCode = proc.exitCode;

      processes.delete(jobId);

      if (exitCode === 0) {
        try {
          const text = await Bun.file(outputTxtPath).text();
          job.status = "completed";
          job.progress = 100;
          job.text = text;
          try {
            mainViewRPC.send.transcriptionComplete({ jobId, text });
          } catch {}
        } catch {
          job.status = "failed";
          job.error = "Failed to read transcription output";
          try {
            mainViewRPC.send.transcriptionError({
              jobId,
              error: job.error,
            });
          } catch {}
        }
      } else if (job.status === "cancelled") {
        // handled — no action
      } else {
        const errMsg = `whisper.cpp exited with code ${exitCode}`;
        job.status = "failed";
        job.error = errMsg;
        try {
          mainViewRPC.send.transcriptionError({ jobId, error: errMsg });
        } catch {}
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = errMsg;
      try {
        mainViewRPC.send.transcriptionError({ jobId, error: errMsg });
      } catch {}
    } finally {
      if (wavPath) cleanupTempFile(wavPath);
      if (outputTxtPath) {
        try {
          unlinkSync(outputTxtPath);
        } catch {}
      }
      pruneJobs();
    }
  })();

  return { jobId };
}

export function cancelTranscription(jobId: string): boolean {
  const job = jobs.get(jobId);
  const proc = processes.get(jobId);

  if (!job || job.status !== "running") return false;
  if (!proc) return false;

  job.status = "cancelled";
  proc.kill();
  processes.delete(jobId);
  return true;
}

function parseProgress(
  output: string,
  fileSize: number,
): Omit<TranscriptionProgress, "jobId"> | null {
  const lines = output.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? "";

    const percentMatch = line.match(/progress\s*=\s*(\d+)%/i);
    if (percentMatch) {
      const percent = Number.parseInt(percentMatch[1] ?? "0", 10);
      const eta = percent < 100 ? estimateEta(fileSize, percent) : "Done";
      return { percent, eta };
    }

    const timestampMatch = line.match(
      /\[(\d+):(\d+):(\d+)\.\d+\s*-->\s*(\d+):(\d+):(\d+)\.\d+\]/,
    );
    if (timestampMatch && fileSize > 0) {
      const endSec =
        Number.parseInt(timestampMatch[4] ?? "0", 10) * 3600 +
        Number.parseInt(timestampMatch[5] ?? "0", 10) * 60 +
        Number.parseInt(timestampMatch[6] ?? "0", 10);
      const estimatedDuration = fileSize / 32000;
      const percent = Math.min(
        99,
        Math.round((endSec / estimatedDuration) * 100),
      );
      const eta = estimateEta(fileSize, percent);
      return { percent, eta };
    }
  }

  return null;
}

function estimateEta(_fileSize: number, percent: number): string {
  if (percent <= 0) return "Calculating...";
  if (percent >= 100) return "Done";

  const remainingSec = ((100 - percent) / percent) * 2;

  if (remainingSec < 60) return `${Math.round(remainingSec)}s remaining`;
  if (remainingSec < 3600) return `${Math.round(remainingSec / 60)}m remaining`;
  return `${Math.round(remainingSec / 3600)}h remaining`;
}
