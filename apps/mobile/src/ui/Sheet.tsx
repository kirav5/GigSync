import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { closeOnBack } from "../adapters/back.js";
import { Avatar, AvatarSize, AvatarTone } from "./Avatar.js";
import { C } from "./cls.js";
import { Icon, type IconName } from "./Icon.js";
import "./sheet.css";
import { useSheetDrag } from "./useSheetDrag.js";

interface SheetProps {
  title: string;
  /** One short muted line under the title, read out with it. */
  line?: string;
  /** An icon in a tile beside the title; `danger` tints the tile red, as for a delete. */
  icon?: IconName;
  /** A person's name: their round initial beside the title in place of an icon, as their row in a list draws it. */
  avatar?: string;
  danger?: boolean;
  /**
   * The words of a Done button at the top right. With it the sheet is the tall one, nearly the screen's height, whose
   * body scrolls under its title row (the profile); without it, a short confirm with its answers under the title.
   */
  done?: string;
  /** Called once the sheet has closed: Escape, a tap on the scrim, Done, or the caller's own button unmounting it. */
  onClose: () => void;
  /** The answers, full width under the title; a tall sheet's whole body. */
  children: ReactNode;
}

const SHEET = "sheet";
const TALL = "sheet tall";
/** The panel's slide down, in sheet.css; past this the sheet closes even if no animationend came (a hidden tab). */
const CLOSE_MS = 320;
/** Let go after a pull, the panel carries on down from where the finger left it, this fast. */
const FLING = "transform 200ms cubic-bezier(0.4, 0, 1, 1)";
const GONE = "translateY(110%)";
/** Set on the panel when a pull closed it, so sheet.css does not also play the slide down from the top. */
const FLUNG = "flung";
const BODY = ".sheet-body";

/**
 * A sheet that slides up from the bottom edge over a light scrim, as the phone's own sheets do (a centred card that
 * rises a little on a wide screen), and slides back down when Done, Escape or the scrim closes it. It is the native modal <dialog>, so the page behind is inert, Escape closes it and it sits above the drawer
 * and the tabs whatever they transform. Mount it to open it and unmount it to close it; focus goes to the sheet and,
 * after, back to the button that opened it (by hand, as an unmounted dialog does not hand it back).
 */
export function Sheet({ title, line, icon, avatar, danger, done, onClose, children }: SheetProps) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    // The sheet itself, not its first button: a confirm must not start on the answer that cannot be undone.
    // Without preventScroll the focus scrolls the dialog to the panel still below the screen, and it jumps up at once.
    panel.current?.focus({ preventScroll: true });
    if (dialog) dialog.scrollTop = 0;
    return () => {
      if (dialog?.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  // Done, Escape or the scrim: the panel slides down first (sheet.css), then the dialog closes.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => ref.current?.close(), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);
  const close = () => setClosing(true);
  const scroller = useCallback(() => panel.current?.querySelector<HTMLElement>(BODY) ?? panel.current, []);
  const fling = useCallback(() => {
    const el = panel.current;
    if (el) {
      el.dataset[FLUNG] = "";
      el.style.transition = FLING;
      el.style.transform = GONE;
    }
    setClosing(true);
  }, []);
  // Back closes the sheet, sliding down like the other ways out.
  useEffect(() => closeOnBack(() => setClosing(true)), []);
  // A finger can hold the sheet and pull it down to close it, as the phone's own sheets do.
  useSheetDrag(panel, scroller, fling);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the scrim's keyboard twin is Escape, which the <dialog> handles itself.
    <dialog
      ref={ref}
      className={done ? TALL : SHEET}
      data-closing={closing || undefined}
      aria-modal="true"
      aria-labelledby={id}
      aria-describedby={line ? `${id}-line` : undefined}
      // StrictMode closes and reopens it on mount; the close event that leaves comes after, with the sheet open again.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      // Escape: slide down like the other ways out, instead of the dialog vanishing at once.
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // The dialog fills the screen and the panel sits in it, so a tap that lands on the dialog itself is the scrim.
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div
        ref={panel}
        className="sheet-panel"
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (closing && e.target === panel.current) ref.current?.close();
        }}
      >
        <span className="sheet-handle" aria-hidden />
        {done ? (
          <>
            <div className="sheet-top">
              <h2 id={id} className="sheet-title">
                {title}
              </h2>
              <button type={C.button} className="sheet-done" onClick={close}>
                {done}
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </>
        ) : (
          <ShortHead id={id} title={title} line={line} icon={icon} avatar={avatar} danger={danger}>
            {children}
          </ShortHead>
        )}
      </div>
    </dialog>
  );
}

interface ShortHeadProps {
  id: string;
  title: string;
  line: string | undefined;
  icon: IconName | undefined;
  avatar: string | undefined;
  danger: boolean | undefined;
  children: ReactNode;
}

/** A short sheet's head (its icon tile or a person's initial, title and line) and its answers under it. */
function ShortHead({ id, title, line, icon, avatar, danger, children }: ShortHeadProps) {
  return (
    <>
      <div className="sheet-head">
        {avatar !== undefined && <Avatar name={avatar} size={AvatarSize.md} tone={AvatarTone.rust} />}
        {avatar === undefined && icon && (
          <span className={danger ? "sheet-tile danger" : "sheet-tile"} aria-hidden>
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="sheet-words">
          <h2 id={id} className="sheet-title">
            {title}
          </h2>
          {line && (
            <p id={`${id}-line`} className="sheet-line">
              {line}
            </p>
          )}
        </div>
      </div>
      <div className="sheet-actions">{children}</div>
    </>
  );
}
