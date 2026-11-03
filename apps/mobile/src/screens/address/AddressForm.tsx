import {
  log,
  type MessageKey,
  type PilotArea,
  pilotAreaOf,
  type Storage,
  saveAddress,
  served,
  TooManyAddressesError,
} from "@gigsync/core";
import {
  AddressLabel,
  type GeoPlace,
  MAX_ADDRESSES,
  PinCode,
  type Place,
  SavedAddress,
  type Session,
} from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { ulid } from "ulid";
import { placesNamed } from "../../adapters/geo.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PlaceMap } from "../../ui/PlaceMap.js";
import { AREAS } from "../../ui/places.js";
import { LocateStep } from "./LocateStep.js";
import { PlaceSearch } from "./PlaceSearch.js";

/** The form's text fields, in the order a visitor needs them; the label and the point are kept apart. */
/** "Sorry, we're not in your area yet": a place outside every city GigSync serves. */
const NOT_SERVED: MessageKey = "addr.not_served";

const F = {
  house: "house",
  floor: "floor",
  building: "building",
  street: "street",
  landmark: "landmark",
  area: "area",
  city: "city",
  pin: "pin",
} as const;
type FieldName = (typeof F)[keyof typeof F];
const FIELDS: readonly FieldName[] = Object.values(F);
const REQUIRED: ReadonlySet<FieldName> = new Set([F.house, F.area, F.city, F.pin]);
const FIELD_LABEL: Readonly<Record<FieldName, MessageKey>> = {
  house: "addr.house",
  floor: "addr.floor",
  building: "addr.building",
  street: "addr.street",
  landmark: "addr.landmark",
  area: "addr.area",
  city: "addr.city",
  pin: "addr.pin",
};
/** What the browser may fill each field from. */
const AUTOCOMPLETE: Readonly<Partial<Record<FieldName, string>>> = {
  street: "address-line1",
  city: "address-level2",
  pin: "postal-code",
};
const PIN_FIELD: FieldName = F.pin;
const ID_PREFIX = "adr_";
/** The pilot's city, filled in for the owner to change: GigSync runs in Bengaluru first. */
const PILOT_CITY_NAME = "Bengaluru";
const NEAR: MessageKey = "addr.near";

/** The pilot areas to pick the nearest from, when GigSync cannot place a typed address. */
function NearestArea({ onPick }: { onPick: (area: PilotArea) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className={C.row} aria-label={t(NEAR)}>
      {AREAS.map((a) => (
        <button key={a.key} type={C.button} className={C.chip} onClick={() => onPick(a)}>
          {t(`area.${a.key}`)}
        </button>
      ))}
    </fieldset>
  );
}

type Values = Record<FieldName, string>;
const EMPTY: Values = { house: "", floor: "", building: "", street: "", landmark: "", area: "", city: "", pin: "" };

/** The point of a typed address, from search, when the owner neither used their location nor picked a place. */
async function pointFor(session: Session, v: Values): Promise<Place | undefined> {
  try {
    const [place] = await placesNamed(session, `${v.area} ${v.city} ${v.pin}`);
    return place?.point;
  } catch (err) {
    log.warn("finding the typed area failed", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}

/**
 * A new saved address (ADR 0045): "Use my current location" or a search fills the area, city and PIN, which the owner
 * checks; they add the house or flat number and anything else a worker needs to find the door, and a label. Kept on
 * this phone only; the worker gets it once both have signed.
 */
export function AddressForm({
  session,
  storage,
  onSaved,
  onCancel,
  locateFirst = false,
}: {
  session: Session;
  storage: Storage;
  onSaved: (address: SavedAddress) => void;
  onCancel: () => void;
  /** Opened from "Use my current location": the location step starts at once. */
  locateFirst?: boolean;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Values>({ ...EMPTY, city: PILOT_CITY_NAME });
  const [label, setLabel] = useState<AddressLabel>(AddressLabel.enum.home);
  const [point, setPoint] = useState<Place>();
  const [found, setFound] = useState<string>();
  const [problem, setProblem] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);

  const set = (name: FieldName, value: string) => setValues((v) => ({ ...v, [name]: value }));
  function fillFrom(place: GeoPlace, at: Place) {
    // Outside the cities GigSync serves (ADR 0050 §6): said at once, and nothing filled in.
    if (!served(at)) return setProblem(NOT_SERVED);
    setProblem(undefined);
    setValues((v) => ({
      ...v,
      area: place.locality,
      city: place.city ?? v.city,
      pin: place.pin ?? v.pin,
      street: v.street || (place.street ?? ""),
    }));
    setPoint(at);
    setFound(place.locality);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!PinCode.safeParse(values.pin.trim()).success) return setProblem("addr.err_pin");
    setBusy(true);
    try {
      const at = point ?? (await pointFor(session, values)) ?? pilotAreaOf(values);
      // Search off or nothing found, and no pilot area in the words: the owner says which area it is nearest to.
      if (!at) return setProblem("addr.near");
      if (!served(at)) return setProblem(NOT_SERVED);
      const filled = Object.fromEntries(FIELDS.map((f) => [f, values[f].trim()]).filter(([, v]) => v));
      const parsed = SavedAddress.safeParse({
        id: `${ID_PREFIX}${ulid()}`,
        label,
        ...filled,
        ...(at ? { point: at } : {}),
      });
      if (!parsed.success) return setProblem("addr.err_missing");
      await saveAddress(storage, parsed.data);
      onSaved(parsed.data);
    } catch (err) {
      setProblem(err instanceof TooManyAddressesError ? "addr.max" : "error.generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={C.card} aria-label={t("addr.add")} onSubmit={(e) => void save(e)}>
      <span className={C.label}>{t("addr.add")}</span>
      <p className={C.faint}>{t("addr.private")}</p>
      <LocateStep session={session} onFound={fillFrom} precise asked={locateFirst} />
      {/* Not served: said where the owner is looking, next to the location they just used. */}
      {problem === NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(NOT_SERVED)}
        </p>
      )}
      <PlaceSearch session={session} onPick={(p) => fillFrom(p, p.point)} />
      {found && (
        <p className={C.muted} role="status">
          {t("addr.found", { area: found })}
        </p>
      )}
      {/* The pin on the door (ADR 0050 §7): moving the map moves the exact point the worker will come to. */}
      {point && (
        <PlaceMap
          at={point}
          label={t("map.of", { place: found ?? values.area })}
          onMove={(at) => {
            setPoint(at);
            setProblem(served(at) ? undefined : NOT_SERVED);
          }}
        />
      )}
      {FIELDS.map((f) => (
        <label key={f} className={C.fieldLabel}>
          <span className={C.muted}>{t(FIELD_LABEL[f])}</span>
          <input
            className={C.field}
            name={f}
            value={values[f]}
            required={REQUIRED.has(f)}
            onChange={(e) => set(f, e.target.value)}
            {...(f === PIN_FIELD ? { inputMode: "numeric" as const, maxLength: 6 } : {})}
            {...(AUTOCOMPLETE[f] ? { autoComplete: AUTOCOMPLETE[f] } : {})}
          />
        </label>
      ))}
      <fieldset className={C.row} aria-label={t("addr.label")}>
        <span className={C.muted}>{t("addr.label")}</span>
        {AddressLabel.options.map((l) => (
          <label key={l} className={label === l ? C.chipOn : C.chip}>
            <input type="radio" name="label" checked={label === l} onChange={() => setLabel(l)} />
            {t(`addr.label.${l}`)}
          </label>
        ))}
      </fieldset>
      {problem && problem !== NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(problem, { max: MAX_ADDRESSES })}
        </p>
      )}
      {problem === NEAR && (
        <NearestArea
          onPick={(a) => {
            setPoint({ lat: a.lat, lon: a.lon });
            setProblem(undefined);
          }}
        />
      )}
      <div className={C.actions}>
        <button type={C.submit} className={C.accent} disabled={busy}>
          {t("addr.save")}
        </button>
        <button type={C.button} className={C.secondary} onClick={onCancel}>
          {t("addr.cancel")}
        </button>
      </div>
    </form>
  );
}
