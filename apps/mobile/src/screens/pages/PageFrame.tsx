import type { ReactNode } from "react";
import { C } from "../../ui/cls.js";
import { ScreenHead } from "../../ui/ScreenHead.js";

interface Props {
  /** The page's headline. The page's name is in the top bar already, so this says what the page is for. */
  title: string;
  /** One short line under the headline; shown on a phone too, unlike the headline's soft half. */
  subtitle?: string;
  /** The page's hairline cards, in order. */
  children: ReactNode;
}

/** A page the menu opens, framed as collab's frame(): a headline, a short line under it, then hairline cards. */
export function PageFrame({ title, subtitle, children }: Props) {
  return (
    <>
      <ScreenHead head={title}>{subtitle && <span className={C.muted}>{subtitle}</span>}</ScreenHead>
      {children}
    </>
  );
}
