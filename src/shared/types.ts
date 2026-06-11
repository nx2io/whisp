export type AppEnvironment = {
  appName: string;
  platform: NodeJS.Platform;
  startedAt: string;
};

export type FileDialogResult = {
  paths: Array<string>;
};

export type AppConfig = {
  model: string;
  modelsDir: string;
  language: string;
  theme: "system" | "light" | "dark";
};

export type ModelInfo = {
  key: string;
  name: string;
  size: string;
  downloaded: boolean;
  downloading: boolean;
};

export type TranscriptionJob = {
  jobId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  model: string;
  language: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  eta: string;
  text: string;
  error: string;
  startedAt: string;
};

export type TranscriptionProgress = {
  jobId: string;
  percent: number;
  eta: string;
};

export type DownloadProgress = {
  modelKey: string;
  percent: number;
  speed: string;
};
