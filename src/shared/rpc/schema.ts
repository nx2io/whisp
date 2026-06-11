import type { RPCSchema } from "electrobun";
import type * as Shared from "../types";

export type MainViewRPC = {
  bun: RPCSchema<{
    messages: {
      logToBun: {
        message: string;
      };
    };
    requests: {
      getEnvironment: {
        params: null;
        response: Shared.AppEnvironment;
      };
      openFileDialog: {
        params: null;
        response: Shared.FileDialogResult;
      };
      getConfig: {
        params: null;
        response: Shared.AppConfig;
      };
      updateConfig: {
        params: Partial<Shared.AppConfig>;
        response: Shared.AppConfig;
      };
      getModels: {
        params: null;
        response: Array<Shared.ModelInfo>;
      };
      downloadModel: {
        params: { modelKey: string };
        response: { started: boolean };
      };
      transcribe: {
        params: { filePath: string };
        response: { jobId: string };
      };
      cancelTranscription: {
        params: { jobId: string };
        response: { cancelled: boolean };
      };
      uploadDroppedFile: {
        params: { fileName: string; data: number[] };
        response: { filePath: string };
      };
      getFfmpegStatus: {
        params: null;
        response: { installed: boolean; downloading: boolean };
      };
      installFfmpeg: {
        params: null;
        response: { started: boolean };
      };
      getWhisperStatus: {
        params: null;
        response: { installed: boolean; downloading: boolean };
      };
      installWhisper: {
        params: null;
        response: { started: boolean };
      };
    };
  }>;
  webview: RPCSchema<{
    messages: {
      logToWebview: {
        message: string;
      };
      transcriptionProgress: {
        progress: Shared.TranscriptionProgress;
      };
      transcriptionComplete: {
        jobId: string;
        text: string;
      };
      transcriptionError: {
        jobId: string;
        error: string;
      };
      downloadProgress: {
        progress: Shared.DownloadProgress;
      };
      downloadComplete: {
        modelKey: string;
      };
      downloadError: {
        modelKey: string;
        error: string;
      };
    };
    requests: {
      getViewStatus: {
        params: null;
        response: {
          ready: boolean;
        };
      };
    };
  }>;
};
