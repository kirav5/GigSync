import { MAX_TRADES, type WorkKind } from "@gigsync/protocol";
import { useId, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { Icon } from "../../ui/Icon.js";
import { ChipGroups, Chips, type Picking, useFound, WorkSearch } from "./WorkChips.js";
import { type OwnWork, OwnWorkAdd, OwnWorkPicked } from "./WorkCustom.js";
import "./work.css";

/**
 * A worker's first step with no card yet: what work they do, picked as chips the way Hinge and Tinder show interests,
 * no pictures, so the card chat that follows starts from it (core `startWithWork`) and asks only the details. Every
 * kind is on the page under its group; the search on top takes typing or speech and knows everyday words ("cleaning"
 * finds Maid). Work the list does not name can be added in the worker's own words, with the kinds closest to them
 * offered beside; the card chat then works out with them which kind it is. Up to a card's limit may be picked, own
 * words included. `onSkip` is the quiet Later, which lands on Home's greeting, with "Make my card by talking" a tap away.
 */
export function WorkStep({
  onDone,
  onSkip,
}: {
  onDone: (kinds: WorkKind[], custom: string[]) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const find = useFound();
  const [picked, setPicked] = useState<WorkKind[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const count = picked.length + custom.length;
  const full = count >= MAX_TRADES;
  const pick: Picking = {
    picked,
    full,
    onToggle: (kind) =>
      setPicked((was) => (was.includes(kind) ? was.filter((k) => k !== kind) : full ? was : [...was, kind])),
  };
  const own: OwnWork = {
    words: custom,
    onAdd: (words) => setCustom((was) => (full || was.includes(words) ? was : [...was, words])),
    onRemove: (words) => setCustom((was) => was.filter((w) => w !== words)),
  };
  const found = query.trim() ? find(query) : undefined;
  return (
    <>
      <section className={`${C.stack} work-step`} aria-labelledby={id}>
        <h1 id={id} className={C.headline}>
          {t("iv.ask.trade")}
        </h1>
        <p className={C.muted}>{t("work.sub", { n: MAX_TRADES })}</p>
        <WorkSearch query={query} onQuery={setQuery} />
        {found === undefined ? (
          <>
            <OwnWorkPicked own={own} />
            <ChipGroups pick={pick} />
          </>
        ) : (
          <>
            {found.length > 0 ? <Chips kinds={found} pick={pick} /> : <p>{t("work.none")}</p>}
            <OwnWorkAdd query={query} found={found} pick={pick} own={own} />
          </>
        )}
      </section>
      <Dock>
        <div className="work-actions">
          <p className={C.dockStatus} role="status">
            {full ? t("work.full", { n: MAX_TRADES }) : ""}
          </p>
          <button
            type={C.button}
            className={`${C.wide} btn-big`}
            disabled={count === 0}
            onClick={() => onDone(picked, custom)}
          >
            {t("work.continue", { n: count, max: MAX_TRADES })}
            <Icon name="arrow" size={20} />
          </button>
          <button type={C.button} className="btn ghost" onClick={onSkip}>
            {t("start.later")}
          </button>
        </div>
      </Dock>
    </>
  );
}
