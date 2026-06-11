import { BrowserView } from "electrobun/bun";
import type { MainViewRPC } from "../../shared/rpc/types";
import { downloadModel } from "../model-manager";
import * as handlers from "./handlers";

export const mainViewRPC = BrowserView.defineRPC<MainViewRPC>({
  handlers: {
    messages: {},
    requests: {
      getEnvironment: handlers.getEnvironment,
      openFileDialog: handlers.openFileDialog,
      getConfig: handlers.getConfig,
      updateConfig: handlers.updateConfig,
      getModels: handlers.getModelsHandler,
      downloadModel: async ({ modelKey }) => {
        return downloadModel(modelKey);
      },
      transcribe: handlers.transcribeHandler,
      cancelTranscription: handlers.cancelTranscriptionHandler,
      uploadDroppedFile: handlers.uploadDroppedFile,
      getFfmpegStatus: handlers.getFfmpegStatus,
      installFfmpeg: handlers.installFfmpegHandler,
      getWhisperStatus: handlers.getWhisperStatus,
      installWhisper: handlers.installWhisperHandler,
    },
  },
  maxRequestTime: Infinity,
});
