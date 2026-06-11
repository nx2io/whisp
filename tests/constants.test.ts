import { describe, expect, test } from "bun:test";
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  WHISPER_MODELS,
} from "../src/shared/constants";

describe("constants", () => {
  test("supported audio extensions cover common formats", () => {
    expect(SUPPORTED_AUDIO_EXTENSIONS).toContain(".mp3");
    expect(SUPPORTED_AUDIO_EXTENSIONS).toContain(".wav");
    expect(SUPPORTED_AUDIO_EXTENSIONS).toContain(".mp4");
    expect(SUPPORTED_AUDIO_EXTENSIONS).toContain(".mov");
    expect(SUPPORTED_AUDIO_EXTENSIONS).toContain(".webm");
  });

  test("whisper model URLs are valid HuggingFace paths", () => {
    for (const [key, model] of Object.entries(WHISPER_MODELS)) {
      expect(model.url).toContain("huggingface.co/ggerganov/whisper.cpp");
      expect(model.url).toContain(`ggml-${key}.bin`);
      expect(model.size).toMatch(/^\d+/);
    }
  });

  test("default model base.en exists", () => {
    expect(WHISPER_MODELS["base.en"]).toBeDefined();
    expect(WHISPER_MODELS["base.en"]?.size).toBe("148 MB");
  });

  test("has both English-only and multilingual models", () => {
    expect(WHISPER_MODELS["tiny.en"]).toBeDefined();
    expect(WHISPER_MODELS.tiny).toBeDefined();
    expect(WHISPER_MODELS["base.en"]).toBeDefined();
    expect(WHISPER_MODELS.base).toBeDefined();
    expect(WHISPER_MODELS["small.en"]).toBeDefined();
    expect(WHISPER_MODELS.small).toBeDefined();
  });

  test("multilingual models are larger or equal to English-only", () => {
    const tinyEnSize = Number.parseInt(
      WHISPER_MODELS["tiny.en"]?.size ?? "0",
      10,
    );
    const tinySize = Number.parseInt(WHISPER_MODELS.tiny?.size ?? "0", 10);
    expect(tinySize).toBeGreaterThanOrEqual(tinyEnSize);
  });
});
