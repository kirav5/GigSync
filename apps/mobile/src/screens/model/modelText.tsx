import { type MessageKey, Network, type Params } from "@gigsync/core";
import { MODEL, type ModelStatus } from "@gigsync/plugin-llm";
import { C } from "../../ui/cls.js";

/** What the chat card and Settings both say about the phone's model. */

type T = (key: MessageKey, params?: Params) => string;
const PERCENT = 100;

export const percentOf = (s: ModelStatus | undefined) => Math.round((s?.progress ?? 0) * PERCENT);

/** The model's size in MB: the engine's word, else the catalog's. */
export const sizeMb = (s: ModelStatus | undefined) => s?.model?.downloadMb ?? MODEL.downloadMb;

/** What a download costs on this connection: mobile data said plainly, Wi-Fi advised where the browser cannot tell. */
export function networkNote(network: Network, mb: number, t: T): string | undefined {
  if (network === Network.metered) return t("model.mobile_data", { mb });
  if (network === Network.unknown) return t("model.wifi_best");
  return undefined;
}

/** The slim progress line: a bar and how far it is. */
export function DownloadLine({ status, t }: { status: ModelStatus | undefined; t: T }) {
  const percent = percentOf(status);
  const text = t("model.downloading", {
    percent,
    done: status?.downloadedMb ?? 0,
    mb: sizeMb(status),
  });
  return (
    <div className="model-progress" role="status">
      <progress max={PERCENT} value={percent} aria-label={text} />
      <span className={C.faint}>{text}</span>
    </div>
  );
}
