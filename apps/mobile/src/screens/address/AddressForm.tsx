import type { Storage } from "@gigsync/core";
import { MAX_ADDRESSES, type SavedAddress, type Session } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { mapsAvailable } from "../../adapters/map.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AddressFields, FIELDS, LabelChips, NearestArea } from "./AddressFields.js";
import { DoorPin } from "./DoorPin.js";
import { LocateStep } from "./LocateStep.js";
import { PlaceSearch } from "./PlaceSearch.js";
import { NEAR, NOT_SERVED, PointFrom, useAddressDraft } from "./useAddressDraft.js";
import "./address.css";

export interface AddressFormProps {
  session: Session;
  storage: Storage;
  onSaved: (address: SavedAddress) => void;
  onCancel: () => void;
  /** Opened from "Use my current location": the location step starts at once. */
  locateFirst?: boolean;
  /** On its own screen (Saved places): the save button stands in the screen's dock, not at the form's foot. */
  docked?: boolean;
}

/**
 * A new saved address (ADR 0045). Where a map can be drawn, the door pin: the map first, the pin put on the door, one
 * field for the flat (S9). Without one (no key on the server, no connection), the typed form.
 */
export function AddressForm(props: AddressFormProps) {
  const [maps, setMaps] = useState<boolean>();
  useEffect(() => {
    let live = true;
    void mapsAvailable().then((ok) => live && setMaps(ok));
    return () => {
      live = false;
    };
  }, []);
  if (maps === undefined) return null;
  return maps ? <DoorPin {...props} /> : <TypedAddress {...props} />;
}

/**
 * The typed address, for a phone with no map: "Use my current location" or a search fills the area, city and PIN,
 * which the owner checks; they add the house or flat number and anything else a worker needs to find the door, and a
 * label. The point is the phone's own fix (the door), or the area's (never the door).
 */
function TypedAddress({ session, storage, onSaved, onCancel, locateFirst = false }: AddressFormProps) {
  const { t } = useI18n();
  const draft = useAddressDraft(session, storage, onSaved);
  const { values, spot, problem } = draft;

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.pinOk()) return;
    void draft.saving(async () => {
      const at = spot?.at ?? (await draft.placeTyped());
      // Search off or nothing found, and no pilot area in the words: the owner says which area it is nearest to.
      if (!at) return draft.setProblem(NEAR);
      if (!draft.isServed(at)) return draft.setProblem(NOT_SERVED);
      await draft.store(at, spot?.from === PointFrom.phone);
    });
  }

  return (
    <form className={C.card} aria-label={t("addr.add")} onSubmit={save}>
      <span className={C.label}>{t("addr.add")}</span>
      <p className={C.faint}>{t("addr.private")}</p>
      <LocateStep
        session={session}
        onFound={(place, at) => draft.fillFrom(place, at, PointFrom.phone)}
        precise
        asked={locateFirst}
      />
      {/* Not served: said where the owner is looking, next to the location they just used. */}
      {problem === NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(NOT_SERVED)}
        </p>
      )}
      <PlaceSearch session={session} near={draft.centre} onPick={(p) => draft.fillFrom(p, p.point, PointFrom.search)} />
      {draft.found && (
        <p className={C.muted} role="status">
          {t("addr.found", { area: draft.found })}
        </p>
      )}
      <AddressFields fields={FIELDS} values={values} onChange={draft.set} />
      <LabelChips label={draft.label} onPick={draft.setLabel} />
      {problem && problem !== NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(problem, { max: MAX_ADDRESSES })}
        </p>
      )}
      {problem === NEAR && (
        <NearestArea
          onPick={(a) => {
            draft.setSpot({ at: { lat: a.lat, lon: a.lon }, from: PointFrom.typed });
            draft.setProblem(undefined);
          }}
        />
      )}
      <div className={C.actions}>
        <button type={C.submit} className={C.accent} disabled={draft.busy} aria-busy={draft.busy}>
          {t("addr.save")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onCancel}>
          {t("addr.cancel")}
        </button>
      </div>
    </form>
  );
}
