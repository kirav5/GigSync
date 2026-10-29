import type { GigDevice } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import { LinkThread } from "./LinkThread.js";
import { useLinks } from "./links.js";

interface Props {
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  syncedAt: Date | undefined;
  /** Whose link is open. */
  user: UserId | undefined;
  /** The link ended or they were blocked: back to where it was opened. */
  onGone: () => void;
}

/** One mentor link, opened from Profile; nothing once it has ended. */
export function LinkScreen({ device, run, syncedAt, user, onGone }: Props) {
  const { links } = useLinks();
  const link = links.find((l) => l.user === user);
  if (!link) return null;
  return <LinkThread device={device} link={link} run={run} syncedAt={syncedAt} onGone={onGone} />;
}
