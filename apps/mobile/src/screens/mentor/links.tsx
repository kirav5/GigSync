import { type GigDevice, log, type MentorLink } from "@gigsync/core";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** What the mentor link rows, a link's thread and the Profile tab's dot read, kept in step with the sync loop. */
export interface LinksView {
  /** Live mentor links, by name. */
  links: readonly MentorLink[];
  /** Notes on any link not shown yet, all together. */
  unread: number;
  /** Reads everything again now, after a change made here. */
  refresh: () => void;
}

const NONE: LinksView = { links: [], unread: 0, refresh: () => undefined };

const LinksContext = createContext<LinksView>(NONE);

/** Reads the phone's mentor links after every sync (`syncedAt` moves) and after every change made here. */
export function LinksProvider({
  device,
  syncedAt,
  children,
}: {
  device: GigDevice;
  syncedAt: Date | undefined;
  children: ReactNode;
}) {
  const [links, setLinks] = useState<readonly MentorLink[]>([]);
  const [asked, setAsked] = useState(0);
  const refresh = useCallback(() => setAsked((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `syncedAt` and `asked` only exist to read again.
  useEffect(() => {
    let live = true;
    device.mentors.links().then(
      (list) => {
        if (live) setLinks(list);
      },
      (err: unknown) => log.warn("mentor links not read", { error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
  }, [device, syncedAt, asked]);

  const value = useMemo<LinksView>(
    () => ({ links, unread: links.reduce((n, l) => n + l.unread, 0), refresh }),
    [links, refresh],
  );
  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}

export function useLinks(): LinksView {
  return useContext(LinksContext);
}
