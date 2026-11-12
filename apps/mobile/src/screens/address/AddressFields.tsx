import type { MessageKey, PilotArea } from "@gigsync/core";
import { AddressLabel } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import type { IconName } from "../../ui/Icon.js";
import { AREAS } from "../../ui/places.js";

/** Each label's mark, on a saved address's card or row: a house, a briefcase, a pin. */
export const LABEL_ICON: Readonly<Record<AddressLabel, IconName>> = {
  [AddressLabel.enum.home]: "home",
  [AddressLabel.enum.work]: "jobs",
  [AddressLabel.enum.other]: "pin",
};

/** The form's text fields, in the order a visitor needs them; the label and the point are kept apart. */
export const F = {
  house: "house",
  floor: "floor",
  building: "building",
  street: "street",
  landmark: "landmark",
  area: "area",
  city: "city",
  pin: "pin",
} as const;
export type FieldName = (typeof F)[keyof typeof F];
export const FIELDS: readonly FieldName[] = Object.values(F);
export type Values = Record<FieldName, string>;
export const EMPTY: Values = {
  house: "",
  floor: "",
  building: "",
  street: "",
  landmark: "",
  area: "",
  city: "",
  pin: "",
};

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
const PIN_DIGITS = 6;
const NUMERIC = "numeric";

/**
 * The address's text fields, each labelled. `required` marks the ones a saved address must have, for the browser to
 * check; a form that checks them itself (the door pin's, whose fields may be folded away) leaves it off.
 */
export function AddressFields({
  fields,
  values,
  onChange,
  required = true,
  labels = {},
}: {
  fields: readonly FieldName[];
  values: Values;
  onChange: (name: FieldName, value: string) => void;
  required?: boolean;
  /** Other words for a field than its own, where the form asks for it differently ("Flat, floor or landmark"). */
  labels?: Readonly<Partial<Record<FieldName, MessageKey>>>;
}) {
  const { t } = useI18n();
  return fields.map((f) => (
    <label key={f} className={C.fieldLabel}>
      <span className={C.muted}>{t(labels[f] ?? FIELD_LABEL[f])}</span>
      <input
        className={C.field}
        name={f}
        value={values[f]}
        required={required && REQUIRED.has(f)}
        onChange={(e) => onChange(f, e.target.value)}
        {...(f === F.pin ? { inputMode: NUMERIC, maxLength: PIN_DIGITS } : {})}
        {...(AUTOCOMPLETE[f] ? { autoComplete: AUTOCOMPLETE[f] } : {})}
      />
    </label>
  ));
}

/** "Save as": Home, Work or Other, the name the address goes by in Find. */
export function LabelChips({ label, onPick }: { label: AddressLabel; onPick: (label: AddressLabel) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className={C.row} aria-label={t("addr.label")}>
      <span className={C.muted}>{t("addr.label")}</span>
      {AddressLabel.options.map((l) => (
        <label key={l} className={label === l ? C.chipOn : C.chip}>
          <input type="radio" name="label" checked={label === l} onChange={() => onPick(l)} />
          {t(`addr.label.${l}`)}
        </label>
      ))}
    </fieldset>
  );
}

/** The pilot areas to pick the nearest from, when GigSync cannot place a typed address. */
export function NearestArea({ onPick }: { onPick: (area: PilotArea) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className={C.row} aria-label={t("addr.near")}>
      {AREAS.map((a) => (
        <button key={a.key} type={C.button} className={C.chip} onClick={() => onPick(a)}>
          {t(`area.${a.key}`)}
        </button>
      ))}
    </fieldset>
  );
}
