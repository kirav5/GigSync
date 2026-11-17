import { log, type MessageKey } from "@gigsync/core";
import { GEO_QUERY_MIN, type GeoPlace, type Place, type Session } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import { geocodingBusy, geocodingOff, placesNamed } from "../../adapters/geo.js";

/** How long the owner pauses before what they typed is looked up, in ms: a word, not every letter. */
export const TYPE_PAUSE_MS = 350;

/**
 * Places as the owner types (ADR 0045, 2026-11-16): once there are a few letters and they pause, the words are looked
 * up near `near`. One lookup at a time: words typed meanwhile wait for it and go next, and only the latest words'
 * answer is shown. `now` looks up at once (Enter, the arrow); `clear` forgets the words once a place is picked.
 */
export function usePlaceSearch(session: Session, near: Place | undefined) {
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<MessageKey>();
  /** The words to look up next, the ones last looked up, and whether a lookup is on its way. */
  const wanted = useRef("");
  const asked = useRef("");
  const going = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function run(): Promise<void> {
    const q = wanted.current;
    if (going.current || q.length < GEO_QUERY_MIN || q === asked.current) return;
    going.current = true;
    asked.current = q;
    setBusy(true);
    try {
      const found = await placesNamed(session, q, near);
      if (wanted.current !== q) return;
      setPlaces(found);
      setNote(found.length === 0 ? "addr.search_none" : undefined);
    } catch (err) {
      // Too many lookups this minute: the list stays as it was, and the next pause asks again.
      if (wanted.current !== q || geocodingBusy(err)) return;
      log.warn("place search failed", { error: err instanceof Error ? err.name : typeof err });
      setNote(geocodingOff(err) ? "addr.search_off" : "addr.search_none");
    } finally {
      going.current = false;
      setBusy(false);
      if (wanted.current !== q) void run();
    }
  }

  /** The words in the box changed: looked up once the owner pauses; fewer than a few letters clear the list. */
  function type(words: string) {
    wanted.current = words.trim();
    clearTimeout(timer.current);
    if (wanted.current.length < GEO_QUERY_MIN) {
      asked.current = "";
      setPlaces([]);
      setNote(undefined);
      return;
    }
    timer.current = setTimeout(() => void run(), TYPE_PAUSE_MS);
  }

  /** Enter or the arrow: the words now, even the same again. */
  function now(words: string) {
    wanted.current = words.trim();
    clearTimeout(timer.current);
    asked.current = "";
    void run();
  }

  /** A place was picked: no list, and no answer still on its way shows one. */
  function clear() {
    clearTimeout(timer.current);
    wanted.current = "";
    asked.current = "";
    setPlaces([]);
    setNote(undefined);
  }

  return { places, busy, note, type, now, clear };
}
