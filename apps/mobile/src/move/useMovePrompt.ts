import { log, movePromptAnswered, movePromptDue, type Ports } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "../adapters/account.js";
import { openedCode } from "../adapters/links.js";

/**
 * After sign-in, "Moving from another phone?" is asked once, and only of an owner with nothing on this phone yet who
 * has another active device in the directory, and never over a QR link they opened to get here (read at mount, before
 * the link is shown and forgotten). `ask` opens that screen. Unanswered directory: no prompt; Settings still offers it.
 */
export function useMovePrompt(ports: Ports, session: Session, ask: () => void): void {
  const latest = useRef(ask);
  latest.current = ask;
  const [linkWaiting] = useState(() => openedCode() !== undefined);
  const { user, device } = session;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `session` is read once per signed-in owner and device.
  useEffect(() => {
    let live = true;
    const devices = async () => (await apiClient(session).directory(user)).devices.map((d) => d.device_id);
    movePromptDue(ports.storage, user, { me: device, devices, linkWaiting })
      .then((due) => {
        if (live && due) latest.current();
      })
      .catch((err: unknown) =>
        log.info("move prompt not checked", { error: err instanceof Error ? err.message : String(err) }),
      );
    return () => {
      live = false;
    };
  }, [ports, user, device, linkWaiting]);
}

/** The owner answered the prompt: scanned, or said not now. */
export function answerMovePrompt(ports: Ports, owner: Session["user"]): Promise<void> {
  return movePromptAnswered(ports.storage, owner, ports.clock.now());
}
