import type { Choice, Storage } from "@gigsync/core";
import type { Place, SavedAddress, Session } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { LABEL_ICON } from "../address/AddressFields.js";
import { Adding } from "./AddAddress.js";
import { Choices, type ChoicesProps, tapChoice } from "./Choices.js";
import { DoorCheck } from "./DoorCheck.js";

/** What Find's "where" question needs from the chat around it. */
export interface WhereTools {
  /** The household's saved addresses, for each card's own line. */
  saved: readonly SavedAddress[];
  storage: Storage;
  /** For naming the place under a moved pin. */
  session: Session;
  /** An address saved again from the chat (its pin put on the door). */
  onSaved: (address: SavedAddress) => void;
  /** "Add an address" or "Use my current location": the app opens the address form (ADR 0045). */
  onAdd: (how: Adding) => void;
  /** The address form open under the question, if any: its own map has "Use my current location". */
  adding?: Adding | undefined;
}

/** What a visitor looks for at the door: the house, floor, building and landmark, as the card's second line. */
const doorLine = (a: SavedAddress): string =>
  [a.house, a.floor, a.building, a.landmark].filter((part) => part?.trim()).join(", ");

const hasPoint = (a: SavedAddress | undefined): a is SavedAddress & { point: Place } => a?.point !== undefined;

/** The tick on the saved address in use, the size of the card's words. */
const TICK_PX = 20;

/**
 * Find's "where" question (ADR 0045): the saved doors first under "Saved addresses", each a card named as its chip was
 * ("Home · Koramangala") with its door underneath, the one in use ticked; then "Use my current location", "Add an
 * address" and any areas as chips. When the address in use has no door pin yet, its map, to put the pin on the door
 * once, and "Use this address" under it to answer with that address. While the address form is open, its map stands in
 * for both: neither the door map nor a second "Use my current location".
 */
export function AddressOptions({
  where,
  inUse,
  ...props
}: Omit<ChoicesProps, "onAddAddress"> & { where: WhereTools; inUse: string | undefined }) {
  const { t } = useI18n();
  const { chat, choices, onTap } = props;
  const byId = new Map(where.saved.map((a) => [a.id, a]));
  const cards = choices.filter((c) => byId.has(c.value));
  // Chosen once, as the question opens: the map stays while the owner moves it, after the pin is saved.
  const [checking] = useState(() => {
    const used = inUse === undefined ? undefined : byId.get(inUse);
    return used?.pinned === true ? undefined : used?.id;
  });
  const check = checking === undefined ? undefined : byId.get(checking);
  const card = (c: Choice) => {
    const a = byId.get(c.value);
    const name = t(c.key, c.params);
    const line = a && doorLine(a);
    const on = c.value === inUse;
    return (
      <button
        key={c.value}
        type={C.button}
        className={on ? "option-row where-card in-use" : "option-row where-card"}
        aria-label={name}
        aria-current={on || undefined}
        onClick={() => tapChoice(chat, c, name, onTap)}
      >
        <span className="where-icon" aria-hidden="true">
          <Icon name={a ? LABEL_ICON[a.label] : "pin"} />
        </span>
        <span className="where-text">
          <span className="where-name">{name}</span>
          {line && <span className="sub">{line}</span>}
        </span>
        {on && (
          <span className="where-tick" aria-hidden="true">
            <Icon name="tick" size={TICK_PX} />
          </span>
        )}
      </button>
    );
  };
  const checkCard = check && cards.find((c) => c.value === check.id);
  const pickChecked = () => checkCard && tapChoice(chat, checkCard, t(checkCard.key, checkCard.params), onTap);
  return (
    <>
      {cards.length > 0 && (
        <div className="where-cards">
          <p className="where-head">{t("addr.title")}</p>
          {cards.map(card)}
        </div>
      )}
      <Choices
        {...props}
        choices={choices.filter((c) => !byId.has(c.value))}
        onAddAddress={() => where.onAdd(Adding.typed)}
        lead={
          !where.adding && (
            <button type={C.button} className={C.chip} onClick={() => where.onAdd(Adding.locate)}>
              {t("addr.use_location")}
            </button>
          )
        }
      />
      {hasPoint(check) && !where.adding && (
        <>
          <DoorCheck address={check} storage={where.storage} session={where.session} onSaved={where.onSaved} />
          {checkCard && (
            <button type={C.button} className={C.wide} onClick={pickChecked}>
              {t("addr.use_this")}
            </button>
          )}
        </>
      )}
    </>
  );
}
