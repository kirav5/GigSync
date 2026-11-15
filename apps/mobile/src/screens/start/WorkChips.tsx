import { kindKey, tradesIn, t as translate } from "@gigsync/core";
import { GROUP_KINDS, Lang, WorkGroup, type WorkKind } from "@gigsync/protocol";
import { useRef } from "react";
import { Permission } from "../../adapters/permissions.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { PermissionSheet } from "../../ui/PermissionSheet.js";
import { useListen } from "../../ui/useListen.js";
import { ALL_KINDS, kindsMatching } from "./workKinds.js";
import "./work.css";

/** What the chips show and what tapping one does. */
export interface Picking {
  picked: readonly WorkKind[];
  /** The card holds as many kinds as it can: the chips not picked wait. */
  full: boolean;
  onToggle: (kind: WorkKind) => void;
}

/** A kind's names to search by: in the reader's language, and in English, which many workers type in too. */
export function useKindNames(): (kind: WorkKind) => string[] {
  const { t } = useI18n();
  return (kind) => [t(kindKey(kind)), translate(Lang.enum.en, kindKey(kind))];
}

/**
 * The kinds a search finds: by their names, and by the everyday words the card chat knows ("cleaning", "jhadu pocha",
 * "ಅಡುಗೆ" find Maid and Cook), so a worker finds their work however they say it.
 */
export function useFound(): (query: string) => WorkKind[] {
  const names = useKindNames();
  return (query) => {
    const said: WorkKind[] = tradesIn(query);
    const named = kindsMatching(ALL_KINDS, query, names);
    return [...new Set([...said, ...named])];
  };
}

/** Speech for one search: no answer is ever sent, so it may stay on the phone or go to the phone's recognizer. */
const NO_HINTS: readonly string[] = [];
const SEARCH_MAX = 60;

/** The search over every kind of work: type, or tap the mic and say it. */
export function WorkSearch({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const { t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  const mic = useListen({
    hints: NO_HINTS,
    onDeviceOnly: false,
    maxLength: SEARCH_MAX,
    field,
    setText: onQuery,
    onHeard: onQuery,
  });
  const label = t("work.search");
  return (
    <>
      <div className="work-search" data-listening={mic.listening || undefined}>
        <Icon name="search" size={20} />
        <input
          ref={field}
          type="search"
          className={C.field}
          aria-label={label}
          placeholder={mic.listening ? t("speech.listening") : label}
          maxLength={SEARCH_MAX}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button
          type={C.button}
          className="work-mic"
          aria-label={t(mic.listening ? "speech.cancel" : "work.say")}
          aria-pressed={mic.listening}
          onClick={() => (mic.listening ? mic.finish() : void mic.tapMic())}
        >
          <Icon name="mic" size={20} />
        </button>
      </div>
      {mic.note && (
        <p className={C.muted} role="status">
          {t(mic.note, { lang: "", vendor: "" })}
        </p>
      )}
      {mic.asking && (
        <div className="composer-sheet" role="dialog" aria-label={t("speech.cloud_yes")}>
          <p>{t("speech.cloud_ask", { lang: "", vendor: t(`speech.vendor_${mic.asking}`) })}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={() => mic.asking && mic.agree(mic.asking)}>
              {t("speech.cloud_yes")}
            </button>
            <button type={C.button} className={C.secondary} onClick={mic.decline}>
              {t("speech.cloud_no")}
            </button>
          </div>
        </div>
      )}
      {mic.why && <PermissionSheet permission={Permission.mic} onAnswer={mic.explained} />}
    </>
  );
}

/** One chip per kind, as Hinge and Tinder show interests: a word in a pill, ticked and tinted once picked. */
export function Chips({ kinds, pick }: { kinds: readonly WorkKind[]; pick: Picking }) {
  const { t } = useI18n();
  return (
    <ul className="work-chips">
      {kinds.map((kind) => {
        const on = pick.picked.includes(kind);
        return (
          <li key={kind}>
            <button
              type={C.button}
              className="work-chip"
              aria-pressed={on}
              disabled={pick.full && !on}
              onClick={() => pick.onToggle(kind)}
            >
              {on && <Icon name="tick" size={16} />}
              {t(kindKey(kind))}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Every kind of work, in Find's groups, each a small heading over its chips. */
export function ChipGroups({ pick }: { pick: Picking }) {
  const { t } = useI18n();
  return (
    <>
      {WorkGroup.options.map((group) => (
        <section key={group} className="work-group" aria-label={t(`group.${group}`)}>
          <h2 className="work-group-title">{t(`group.${group}`)}</h2>
          <Chips kinds={GROUP_KINDS[group]} pick={pick} />
        </section>
      ))}
    </>
  );
}
