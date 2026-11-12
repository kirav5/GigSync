import type { ReactNode } from "react";
import { C } from "../../ui/cls.js";
import "./pages.css";

interface Props {
  /** The page's headline. The page's name is in the top bar already, so this says what the page is for. */
  title: string;
  /** One short line under the headline. */
  subtitle?: string;
  /** The page's cards and list cards, in order. */
  children: ReactNode;
}

/** A page opened from Me or Settings: the design's serif title line, a short line under it, then its cards. */
export function PageFrame({ title, subtitle, children }: Props) {
  return (
    <>
      <div className="page-head">
        <h1 className="hero-title">{title}</h1>
        {subtitle && <p className={C.muted}>{subtitle}</p>}
      </div>
      {children}
    </>
  );
}
