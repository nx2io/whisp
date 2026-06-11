import { Electroview } from "electrobun/view";
import type { MainViewRPC } from "../../../shared/rpc/types";
import type {
  DownloadProgress,
  TranscriptionProgress,
} from "../../../shared/types";

type MessageHandler<T> = (data: T) => void;
type Unsubscribe = () => void;

const messageBus = {
  transcriptionProgress: new Set<
    MessageHandler<{ progress: TranscriptionProgress }>
  >(),
  transcriptionComplete: new Set<
    MessageHandler<{ jobId: string; text: string }>
  >(),
  transcriptionError: new Set<
    MessageHandler<{ jobId: string; error: string }>
  >(),
  downloadProgress: new Set<MessageHandler<{ progress: DownloadProgress }>>(),
  downloadComplete: new Set<MessageHandler<{ modelKey: string }>>(),
  downloadError: new Set<MessageHandler<{ modelKey: string; error: string }>>(),
};

export const bus = {
  onTranscriptionProgress(
    fn: MessageHandler<{ progress: TranscriptionProgress }>,
  ): Unsubscribe {
    messageBus.transcriptionProgress.add(fn);
    return () => messageBus.transcriptionProgress.delete(fn);
  },
  onTranscriptionComplete(
    fn: MessageHandler<{ jobId: string; text: string }>,
  ): Unsubscribe {
    messageBus.transcriptionComplete.add(fn);
    return () => messageBus.transcriptionComplete.delete(fn);
  },
  onTranscriptionError(
    fn: MessageHandler<{ jobId: string; error: string }>,
  ): Unsubscribe {
    messageBus.transcriptionError.add(fn);
    return () => messageBus.transcriptionError.delete(fn);
  },
  onDownloadProgress(
    fn: MessageHandler<{ progress: DownloadProgress }>,
  ): Unsubscribe {
    messageBus.downloadProgress.add(fn);
    return () => messageBus.downloadProgress.delete(fn);
  },
  onDownloadComplete(fn: MessageHandler<{ modelKey: string }>): Unsubscribe {
    messageBus.downloadComplete.add(fn);
    return () => messageBus.downloadComplete.delete(fn);
  },
  onDownloadError(
    fn: MessageHandler<{ modelKey: string; error: string }>,
  ): Unsubscribe {
    messageBus.downloadError.add(fn);
    return () => messageBus.downloadError.delete(fn);
  },
};

function notify<T>(set: Set<MessageHandler<T>>, data: T) {
  for (const fn of set) fn(data);
}

const viewRpc = Electroview.defineRPC<MainViewRPC>({
  maxRequestTime: Infinity,
  handlers: {
    messages: {
      logToWebview: ({ message }) => {
        console.log(`[bun] ${message}`);
      },
      transcriptionProgress: (data) =>
        notify(messageBus.transcriptionProgress, data),
      transcriptionComplete: (data) =>
        notify(messageBus.transcriptionComplete, data),
      transcriptionError: (data) => notify(messageBus.transcriptionError, data),
      downloadProgress: (data) => notify(messageBus.downloadProgress, data),
      downloadComplete: (data) => notify(messageBus.downloadComplete, data),
      downloadError: (data) => notify(messageBus.downloadError, data),
    },
    requests: {
      getViewStatus: () => ({ ready: true }),
    },
  },
});

export const electroview = new Electroview({ rpc: viewRpc });

const rpcClient = electroview.rpc;
// biome-ignore lint/style/noNonNullAssertion: RPC is always initialized in Electrobun webview
export const rpc = rpcClient!;
