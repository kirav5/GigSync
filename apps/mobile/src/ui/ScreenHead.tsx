import type { ReactNode } from "react";
import { C } from "./cls.js";

/**
 * A screen's head, as collab's frame(): a two-tone headline, and anything said under it. The screen's name is in the
 * top bar already, so it is not repeated here.
 */
export function ScreenHead({ head, soft, children }: { head: string; soft?: string; children?: ReactNode }) {
  return (
    <div className={C.stack}>
      <h1 className={C.headline}>
        {head} {soft && <span className={C.soft}>{soft}</span>}
      </h1>
      {children}
    </div>
  );
}
