import { useI18n } from "../i18n.js";
import { useBar } from "../ui/Bar.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";

interface Props {
  /** The shell's title for the open screen; a screen's own (ui/Bar.tsx `BarTitle`) wins over it. */
  title: string;
  /** There is somewhere to go back to: the open screen was opened from inside another. */
  canBack: boolean;
  onBack: () => void;
}

/**
 * The title row, one cream band with the phone's status bar above it: Back while there is somewhere to go back to,
 * the open screen's title, and at its end the screen's own icon buttons (ui/Bar.tsx `BarEnd`). The page's one banner.
 */
export function TopBar({ title, canBack, onBack }: Props) {
  const { t } = useI18n();
  const bar = useBar();
  return (
    <header className="topbar">
      {canBack && (
        <button type={C.button} className="back" aria-label={t("a11y.back")} onClick={onBack}>
          <Icon name="back" size={22} />
        </button>
      )}
      <span className="topbar-title">{bar.title ?? title}</span>
      <span className="bar-end" ref={bar.setSlot} />
    </header>
  );
}
