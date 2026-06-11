import { Check, Loader2, Monitor, Moon, Sun, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "../../shared/constants";
import type {
  AppConfig,
  ModelInfo,
  TranscriptionProgress,
} from "../../shared/types";
import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { bus, rpc } from "./lib/rpc";

type AppState = "idle" | "loading" | "transcribing" | "result";

type ThemeOption = "system" | "dark" | "light";

type SelectOption = { value: string; label: React.ReactNode };

function Dropdown({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen(!open)}
        className={`justify-between gap-1.5 font-mono text-xs h-7 px-2.5 ${className ?? ""}`}
      >
        <span className="truncate max-w-[150px]">
          {selected?.label ?? value}
        </span>
        <svg
          className={`w-3 h-3 shrink-0 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="Toggle"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[160px] rounded-lg bg-popover border-0 shadow-lg">
          <div className="py-1 max-h-60 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between transition-colors ${
                  o.value === value
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span>{o.label}</span>
                {o.value === value && (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const Home = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<Array<ModelInfo>>([]);
  const [filename, setFilename] = useState<string>("");
  const [filePath, setFilePath] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [appState, setAppState] = useState<AppState>("idle");
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [ffmpegInstalled, setFfmpegInstalled] = useState<boolean>(false);
  const [ffmpegDownloading, setFfmpegDownloading] = useState<boolean>(false);
  const [whisperInstalled, setWhisperInstalled] = useState<boolean>(false);
  const [whisperDownloading, setWhisperDownloading] = useState<boolean>(false);
  const [downloadState, setDownloadState] = useState<
    Record<string, { percent: number; speed: string }>
  >({});
  const [theme, setTheme] = useState<ThemeOption>("system");
  const dragCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    const load = async () => {
      while (!cancelled && retries < 10) {
        try {
          const [cfg, mods, ffStatus, whStatus] = await Promise.all([
            rpc.request.getConfig(null),
            rpc.request.getModels(null),
            rpc.request.getFfmpegStatus(null),
            rpc.request.getWhisperStatus(null),
          ]);
          if (!cancelled) {
            setConfig(cfg);
            setModels(mods);
            setTheme(cfg.theme ?? "system");
            setFfmpegInstalled(ffStatus.installed);
            setFfmpegDownloading(ffStatus.downloading);
            setWhisperInstalled(whStatus.installed);
            setWhisperDownloading(whStatus.downloading);
            return;
          }
        } catch (err) {
          retries++;
          if (retries >= 10) {
            console.error("Failed to load config after 10 retries:", err);
            if (!cancelled) {
              setError("Failed to connect to the app runtime. Please restart.");
            }
          } else {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const applyTheme = (t: ThemeOption) => {
      const isDark =
        t === "dark" ||
        (t === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    };

    applyTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  useEffect(() => {
    const unsubProgress = bus.onTranscriptionProgress((data) => {
      setProgress(data.progress);
    });
    const unsubComplete = bus.onTranscriptionComplete((data) => {
      setTranscript(data.text);
      setAppState("result");
      setProgress(null);
    });
    const unsubError = bus.onTranscriptionError((data) => {
      setError(data.error);
      setAppState("idle");
      setProgress(null);
      setJobId("");
    });
    const unsubDlProgress = bus.onDownloadProgress((data) => {
      const key = data.progress.modelKey;
      if (key === "ffmpeg" || key === "whisper") {
        if (key === "ffmpeg") setFfmpegDownloading(true);
        if (key === "whisper") setWhisperDownloading(true);
        setDownloadState((prev) => ({
          ...prev,
          [key]: {
            percent: data.progress.percent,
            speed: data.progress.speed,
          },
        }));
        return;
      }
      setDownloadState((prev) => ({
        ...prev,
        [data.progress.modelKey]: {
          percent: data.progress.percent,
          speed: data.progress.speed,
        },
      }));
      setModels((prev) =>
        prev.map((m) =>
          m.key === data.progress.modelKey ? { ...m, downloading: true } : m,
        ),
      );
    });
    const unsubDlComplete = bus.onDownloadComplete((data) => {
      if (data.modelKey === "ffmpeg") {
        setFfmpegInstalled(true);
        setFfmpegDownloading(false);
        setDownloadState((prev) => {
          const n = { ...prev };
          delete n.ffmpeg;
          return n;
        });
        return;
      }
      if (data.modelKey === "whisper") {
        setWhisperInstalled(true);
        setWhisperDownloading(false);
        setDownloadState((prev) => {
          const n = { ...prev };
          delete n.whisper;
          return n;
        });
        return;
      }
      setDownloadState((prev) => {
        const next = { ...prev };
        delete next[data.modelKey];
        return next;
      });
      setModels((prev) =>
        prev.map((m) =>
          m.key === data.modelKey
            ? { ...m, downloaded: true, downloading: false }
            : m,
        ),
      );
    });
    const unsubDlError = bus.onDownloadError((data) => {
      if (data.modelKey === "ffmpeg") {
        setFfmpegDownloading(false);
        setDownloadState((prev) => {
          const n = { ...prev };
          delete n.ffmpeg;
          return n;
        });
        return;
      }
      if (data.modelKey === "whisper") {
        setWhisperDownloading(false);
        setDownloadState((prev) => {
          const n = { ...prev };
          delete n.whisper;
          return n;
        });
        return;
      }
      setDownloadState((prev) => {
        const next = { ...prev };
        delete next[data.modelKey];
        return next;
      });
      setModels((prev) =>
        prev.map((m) =>
          m.key === data.modelKey ? { ...m, downloading: false } : m,
        ),
      );
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubDlProgress();
      unsubDlComplete();
      unsubDlError();
    };
  }, []);

  const handleFileDrop = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;

    setFilename(file.name);
    setFileSize(file.size);

    const path = (file as unknown as { path?: string }).path;
    if (path) {
      setFilePath(path);
      return;
    }

    // No path available — read file content and upload via RPC
    try {
      const buf = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const result = await rpc.request.uploadDroppedFile({
        fileName: file.name,
        data: bytes,
      });
      setFilePath(result.filePath);
    } catch {
      setError(
        "Drag-and-drop not supported for this file. Use Browse instead.",
      );
      setTimeout(() => setError(""), 4000);
      setFilename("");
      setFileSize(0);
    }
  }, []);

  const handleBrowse = useCallback(async () => {
    const result = await rpc.request.openFileDialog(null);
    const paths = result.paths.filter((p) => p && p.length > 0);
    if (paths.length > 0 && paths[0]) {
      const path = paths[0];
      setFilePath(path);
      setFilename(path.split(/[/\\]/).pop() ?? path);
      setFileSize(0);
    }
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!filePath) return;
    setAppState("transcribing");
    setError("");
    setTranscript("");
    setProgress({ jobId: "", percent: 0, eta: "Starting..." });
    try {
      const result = await rpc.request.transcribe({ filePath });
      setJobId(result.jobId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start transcription",
      );
      setAppState("idle");
    }
  }, [filePath]);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    try {
      await rpc.request.cancelTranscription({ jobId });
    } catch {}
    setAppState("idle");
    setProgress(null);
    setJobId("");
  }, [jobId]);

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(transcript);
  }, [transcript]);

  const handleExport = useCallback(() => {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, filename]);

  const handleNewFile = useCallback(() => {
    setAppState("idle");
    setFilename("");
    setFilePath("");
    setFileSize(0);
    setTranscript("");
    setError("");
    setProgress(null);
    setJobId("");
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    const updated = await rpc.request.updateConfig({ model });
    setConfig(updated);
  }, []);

  const handleLanguageChange = useCallback(async (language: string) => {
    const updated = await rpc.request.updateConfig({ language });
    setConfig(updated);
  }, []);

  const handleThemeChange = useCallback(async (t: ThemeOption) => {
    setTheme(t);
    await rpc.request.updateConfig({ theme: t });
  }, []);

  const handleInstallFfmpeg = useCallback(async () => {
    try {
      const result = await rpc.request.installFfmpeg(null);
      if (result.started) {
        setFfmpegDownloading(true);
        setDownloadState((prev) => ({
          ...prev,
          ffmpeg: { percent: 0, speed: "" },
        }));
      }
    } catch (err) {
      console.error("FFmpeg install error:", err);
    }
  }, []);

  const handleInstallWhisper = useCallback(async () => {
    try {
      const result = await rpc.request.installWhisper(null);
      if (result.started) {
        setWhisperDownloading(true);
        setDownloadState((prev) => ({
          ...prev,
          whisper: { percent: 0, speed: "" },
        }));
      }
    } catch (err) {
      console.error("Whisper install error:", err);
    }
  }, []);

  const handleDownloadModel = useCallback(async (modelKey: string) => {
    try {
      const result = await rpc.request.downloadModel({ modelKey });
      if (result.started) {
        setDownloadState((prev) => ({
          ...prev,
          [modelKey]: { percent: 0, speed: "" },
        }));
        setModels((prev) =>
          prev.map((m) =>
            m.key === modelKey ? { ...m, downloading: true } : m,
          ),
        );
      }
    } catch (err) {
      console.error("Download error:", err);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      handleFileDrop(e.dataTransfer.files);
    },
    [handleFileDrop],
  );

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const themeOptions: SelectOption[] = [
    {
      value: "system",
      label: (
        <span className="flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5" />
          System
        </span>
      ),
    },
    {
      value: "light",
      label: (
        <span className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5" />
          Light
        </span>
      ),
    },
    {
      value: "dark",
      label: (
        <span className="flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5" />
          Dark
        </span>
      ),
    },
  ];

  const languageOpts: SelectOption[] = [
    { value: "auto", label: "Auto-detect" },
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "ja", label: "Japanese" },
    { value: "zh", label: "Chinese" },
    { value: "ko", label: "Korean" },
    { value: "pt", label: "Portuguese" },
    { value: "it", label: "Italian" },
    { value: "ru", label: "Russian" },
  ];

  const modelOpts: SelectOption[] = models.map((m) => ({
    value: m.key,
    label: `${m.name} (${m.size})${m.downloaded ? "" : " — not downloaded"}`,
  }));

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2 text-sm font-mono">Loading...</span>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="flex items-center justify-between px-6 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-muted-foreground">
            {APP_NAME}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {appState === "idle" && (
            <>
              <Dropdown
                value={config.model}
                options={modelOpts}
                onChange={handleModelChange}
                className="w-[200px]"
              />
              <Dropdown
                value={config.language}
                options={languageOpts}
                onChange={handleLanguageChange}
                className="w-[130px]"
              />
            </>
          )}
          <Dropdown
            value={theme}
            options={themeOptions}
            onChange={(v) => handleThemeChange(v as ThemeOption)}
            className="w-[120px]"
          />
        </div>
      </header>

      {appState === "loading" && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {appState === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* biome-ignore lint/a11y/useSemanticElements: drop zone needs drag event handling */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            className="w-full max-w-lg border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-4 hover:border-emerald-400 hover:bg-accent/50 transition-all"
          >
            <Upload className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Drop audio or video here
            </p>
            <p className="text-muted-foreground/50 text-xs">or</p>
            <Button size="sm" onClick={handleBrowse}>
              Browse files
            </Button>
            <p className="text-muted-foreground/50 text-xs">
              MP3 · WAV · M4A · MP4 · MOV · WEBM
            </p>
          </div>

          {filename && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="font-mono">{filename}</span>
                {fileSize > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {formatSize(fileSize)}
                  </span>
                )}
              </div>
              <Button onClick={handleTranscribe}>Transcribe</Button>
            </div>
          )}

          <div className="mt-8 w-full max-w-lg">
            <p className="text-xs text-muted-foreground font-mono mb-3">
              Models
            </p>
            <div className="space-y-2">
              {models.map((m) => {
                const dl = downloadState[m.key];
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between py-1.5 px-3 rounded-md border border-transparent hover:bg-accent/50 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">
                      {m.name}{" "}
                      <span className="text-muted-foreground/50">
                        ({m.size})
                      </span>
                    </span>
                    {m.downloaded ? (
                      <span className="text-emerald-600 dark:text-emerald-500 text-xs font-medium">
                        Installed
                      </span>
                    ) : m.downloading ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Progress
                          value={dl?.percent ?? 0}
                          className="w-24 h-1.5"
                        />
                        <span className="text-amber-600 dark:text-amber-500 whitespace-nowrap font-mono">
                          {dl?.percent ?? 0}%
                        </span>
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        size="xs"
                        className="text-xs h-auto px-0 py-0 underline"
                        onClick={() => handleDownloadModel(m.key)}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground font-mono mb-3">
                Dependencies
              </p>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md border border-transparent hover:bg-accent/50 text-xs">
                <span className="font-mono text-muted-foreground">
                  FFmpeg{" "}
                  <span className="text-muted-foreground/50">
                    (audio conversion)
                  </span>
                </span>
                {ffmpegInstalled ? (
                  <span className="text-emerald-600 dark:text-emerald-500 text-xs font-medium">
                    Installed
                  </span>
                ) : ffmpegDownloading ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Progress
                      value={downloadState.ffmpeg?.percent ?? 0}
                      className="w-24 h-1.5"
                    />
                    <span className="text-amber-600 dark:text-amber-500 whitespace-nowrap font-mono">
                      {downloadState.ffmpeg?.percent ?? 0}%
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="link"
                    size="xs"
                    className="text-xs h-auto px-0 py-0 underline"
                    onClick={handleInstallFfmpeg}
                  >
                    Install
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-md border border-transparent hover:bg-accent/50 text-xs">
                <span className="font-mono text-muted-foreground">
                  whisper.cpp{" "}
                  <span className="text-muted-foreground/50">
                    (transcription engine)
                  </span>
                </span>
                {whisperInstalled ? (
                  <span className="text-emerald-600 dark:text-emerald-500 text-xs font-medium">
                    Installed
                  </span>
                ) : whisperDownloading ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Progress
                      value={downloadState.whisper?.percent ?? 0}
                      className="w-24 h-1.5"
                    />
                    <span className="text-amber-600 dark:text-amber-500 whitespace-nowrap font-mono">
                      {downloadState.whisper?.percent ?? 0}%
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="link"
                    size="xs"
                    className="text-xs h-auto px-0 py-0 underline"
                    onClick={handleInstallWhisper}
                  >
                    Install
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {appState === "transcribing" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-muted-foreground text-sm font-mono">
              {filename}
            </p>
            <Progress value={progress?.percent ?? 0} className="w-full" />
            <div className="flex items-center justify-between w-full text-xs text-muted-foreground font-mono">
              <span>{progress?.percent ?? 0}%</span>
              <span>{progress?.eta ?? "Calculating..."}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {appState === "result" && (
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-mono text-muted-foreground">
                Done — {filename}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                Copy All
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                Export .txt
              </Button>
              <Button size="sm" onClick={handleNewFile}>
                New File
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-muted/50 border rounded-lg p-6 overflow-y-auto">
            <pre className="text-sm font-sans whitespace-pre-wrap leading-relaxed">
              {transcript}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </main>
  );
};
