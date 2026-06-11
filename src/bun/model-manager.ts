import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WHISPER_MODELS } from "../shared/constants";
import type { DownloadProgress, ModelInfo } from "../shared/types";
import { loadConfig } from "./config";
import { mainViewRPC } from "./rpc/router";

const activeDownloads = new Map<string, AbortController>();

export function getModels(): Array<ModelInfo> {
  const config = loadConfig();

  return Object.entries(WHISPER_MODELS).map(([key, info]) => {
    const modelPath = join(config.modelsDir, `ggml-${key}.bin`);
    return {
      key,
      name: info.name,
      size: info.size,
      downloaded: existsSync(modelPath),
      downloading: activeDownloads.has(key),
    };
  });
}

export async function downloadModel(
  modelKey: string,
): Promise<{ started: boolean }> {
  const modelInfo = WHISPER_MODELS[modelKey];
  if (!modelInfo) throw new Error(`Unknown model: ${modelKey}`);

  const config = loadConfig();
  mkdirSync(config.modelsDir, { recursive: true });

  const modelPath = join(config.modelsDir, `ggml-${modelKey}.bin`);

  if (existsSync(modelPath)) {
    return { started: false };
  }

  if (activeDownloads.has(modelKey)) {
    return { started: true };
  }

  const controller = new AbortController();
  activeDownloads.set(modelKey, controller);

  (async () => {
    const tmpPath = join(tmpdir(), `whisp-model-${randomUUID()}.bin`);
    try {
      console.log(`Downloading model ${modelKey} from ${modelInfo.url}`);

      const response = await fetch(modelInfo.url, {
        signal: controller.signal,
        headers: { "User-Agent": "Whisp/1.0" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get("content-length")) || 0;
      if (!response.body) throw new Error("No response body");

      const tmpFile = Bun.file(tmpPath);
      const writer = tmpFile.writer();
      let downloaded = 0;
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
            : 0;
        const speedStr =
          speed > 1024 * 1024
            ? `${(speed / (1024 * 1024)).toFixed(1)} MB/s`
            : `${(speed / 1024).toFixed(0)} KB/s`;

        const progress: DownloadProgress = {
          modelKey,
          percent,
          speed: speedStr,
        };
        try {
          mainViewRPC.send.downloadProgress({ progress });
        } catch {}
      }

      await writer.end();

      // Atomic rename from temp to final location
      const tmpData = Bun.file(tmpPath);
      await Bun.write(modelPath, tmpData);

      try {
        await Bun.file(tmpPath).unlink();
      } catch {}

      try {
        mainViewRPC.send.downloadComplete({ modelKey });
      } catch {}
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "The operation was aborted") {
        console.error(`Download failed for ${modelKey}: ${msg}`);
        try {
          mainViewRPC.send.downloadError({ modelKey, error: msg });
        } catch {}
      }
      // Clean up temp file
      try {
        await Bun.file(tmpPath).unlink();
      } catch {}
    } finally {
      activeDownloads.delete(modelKey);
    }
  })();

  return { started: true };
}
