import { useEffect, useRef } from "react";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import "./listening.css";

interface Props {
  /** The words heard so far (after what was typed, for the small mic). */
  heard: string;
  /** Ends the listen: the round button's words are sent, the small mic's go into the field. */
  onDone: () => void;
  /** Drops what was heard. */
  onCancel: () => void;
}

/** The level meter's five bars, as the design draws them; each is its own key. */
const BARS = [0, 1, 2, 3, 4] as const;
const CANCEL_ICON_PX = 22;
const WORD_GAP = /\s+/;
const SPACE = " ";

/** The last words of a partial, which a recognizer still revises as more is heard. */
const IN_FLUX = 3;

/**
 * Splits the heard words into those that have settled and those still changing: what agrees with the last partial
 * has settled, as has everything but the last few words; the last word is always still being heard.
 */
function settle(now: string, before: string): [string, string] {
  const words = now.split(WORD_GAP).filter(Boolean);
  const was = before.split(WORD_GAP).filter(Boolean);
  let same = 0;
  while (same < words.length - 1 && words[same] === was[same]) same += 1;
  const cut = Math.max(same, Math.min(words.length - 1, words.length - IN_FLUX));
  return [words.slice(0, cut).join(SPACE), words.slice(cut).join(SPACE)];
}

/**
 * The listening sheet (the design's "Listening · clear Done, easy Cancel"): it rises over the chat while either mic
 * listens, with the language it listens in, a warm breathing orb and a small level meter, the words as they come
 * (settled in ink, still-changing muted), and at its foot a round × to cancel and a wide Done. The recognizer gives no
 * level, so the orb and the meter move on their own; with Reduce Motion they stand still. A modal <dialog>, so the
 * chat behind is inert and Escape cancels; it closes the moment the listen ends.
 */
export function ListeningSheet({ heard, onDone, onCancel }: Props) {
  const { lang, t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const before = useRef("");
  const [settled, changing] = settle(heard, before.current);
  useEffect(() => {
    before.current = heard;
  }, [heard]);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    done.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="listen-sheet"
      aria-modal="true"
      aria-label={t("speech.listening")}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="listen-panel">
        <p className="listen-lang">{t("speech.listening_in", { lang: t(`lang.${lang}`) })}</p>
        <span className="listen-orb" aria-hidden />
        <span className="listen-level" aria-hidden>
          {BARS.map((bar) => (
            <i key={bar} />
          ))}
        </span>
        <p className="listen-heard" aria-live="polite">
          {settled}
          {settled && changing ? SPACE : ""}
          {changing && <span className="listen-changing">{changing}</span>}
        </p>
        <div className="listen-controls">
          <button type={C.button} className="listen-cancel" aria-label={t("speech.cancel")} onClick={onCancel}>
            <Icon name="close" size={CANCEL_ICON_PX} />
          </button>
          <button ref={done} type={C.button} className="listen-done" onClick={onDone}>
            {t("speech.done")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
