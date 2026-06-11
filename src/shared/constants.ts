export const APP_NAME = "Whisp";

export const MODELS_DIR = ".whisp/models";

export const CONFIG_FILE = ".whisp/config.json";

export const SUPPORTED_AUDIO_EXTENSIONS = [
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
  ".webm",
  ".mp4",
  ".mov",
  ".mkv",
  ".avi",
  ".wmv",
  ".flv",
  ".m4v",
];

export const WHISPER_MODELS: Record<
  string,
  { name: string; size: string; url: string }
> = {
  "tiny.en": {
    name: "Tiny (English)",
    size: "78 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
  },
  "base.en": {
    name: "Base (English)",
    size: "148 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
  },
  "small.en": {
    name: "Small (English)",
    size: "488 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
  },
  tiny: {
    name: "Tiny (Multilingual)",
    size: "78 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  },
  base: {
    name: "Base (Multilingual)",
    size: "148 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  },
  small: {
    name: "Small (Multilingual)",
    size: "488 MB",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
};
