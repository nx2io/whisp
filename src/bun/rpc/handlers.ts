import { join } from "node:path";
import { Utils } from "electrobun/bun";
import { APP_NAME } from "../../shared/constants";
import type {
  AppConfig,
  AppEnvironment,
  FileDialogResult,
  ModelInfo,
} from "../../shared/types";
import { loadConfig, saveConfig } from "../config";
import {
  installFfmpeg,
  isFfmpegDownloading,
  isFfmpegInstalled,
} from "../ffmpeg-manager";
import { ensureTempDir } from "../file-utils";
import { getModels } from "../model-manager";
import { cancelTranscription, startTranscription } from "../transcriber";
import {
  installWhisper,
  isWhisperDownloading,
  isWhisperInstalled,
} from "../whisper-manager";

const startedAt = new Date().toISOString();

export const getEnvironment = (): AppEnvironment => ({
  appName: APP_NAME,
  platform: process.platform,
  startedAt,
});

export const openFileDialog = async (): Promise<FileDialogResult> => {
  const raw = await Utils.openFileDialog({
    allowedFileTypes: "*",
    allowsMultipleSelection: false,
    canChooseDirectory: false,
    canChooseFiles: true,
    startingFolder: Utils.paths.home,
  });

  const paths = (raw ?? []).filter((p) => p && p.length > 0);

  return { paths };
};

export const getConfig = (): AppConfig => {
  return loadConfig();
};

export const updateConfig = (params: Partial<AppConfig>): AppConfig => {
  return saveConfig(params);
};

export const getModelsHandler = (): Array<ModelInfo> => {
  return getModels();
};

export const transcribeHandler = async ({
  filePath,
}: {
  filePath: string;
}): Promise<{ jobId: string }> => {
  return startTranscription(filePath);
};

export const cancelTranscriptionHandler = ({
  jobId,
}: {
  jobId: string;
}): { cancelled: boolean } => {
  return { cancelled: cancelTranscription(jobId) };
};

export const uploadDroppedFile = async ({
  fileName,
  data,
}: {
  fileName: string;
  data: number[];
}): Promise<{ filePath: string }> => {
  const tempDir = ensureTempDir();
  const filePath = join(tempDir, fileName);
  await Bun.write(filePath, new Uint8Array(data));
  return { filePath };
};

export const getFfmpegStatus = (): {
  installed: boolean;
  downloading: boolean;
} => {
  return {
    installed: isFfmpegInstalled(),
    downloading: isFfmpegDownloading(),
  };
};

export const installFfmpegHandler = async (): Promise<{
  started: boolean;
}> => {
  return installFfmpeg();
};

export const getWhisperStatus = (): {
  installed: boolean;
  downloading: boolean;
} => {
  return {
    installed: isWhisperInstalled(),
    downloading: isWhisperDownloading(),
  };
};

export const installWhisperHandler = async (): Promise<{
  started: boolean;
}> => {
  return installWhisper();
};
