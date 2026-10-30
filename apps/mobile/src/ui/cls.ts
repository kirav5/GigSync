/** Class names and attribute values used across screens, named once (the lint bans repeated bare strings). */
export const C = {
  button: "button",
  submit: "submit",
  btn: "btn",
  accent: "btn accent",
  secondary: "btn secondary",
  quiet: "btn quiet compact",
  /** A smaller button in a row of several, as on the QR card. */
  secondaryCompact: "btn secondary compact",
  danger: "btn danger",
  wide: "btn accent wide",
  field: "field",
  fieldLabel: "field-label",
  card: "card",
  cardWait: "card wait",
  label: "label",
  labelSq: "label sq",
  headline: "headline",
  soft: "soft",
  title: "title",
  row: "row",
  /** A decision's buttons: side by side with room, stacked full width on a phone. */
  actions: "actions",
  stack: "stack",
  muted: "muted small",
  faint: "faint small",
  money: "money",
  empty: "empty",
  linkBtn: "link-btn",
  error: "error",
  off: "off",
  chip: "chip",
  chipOn: "chip on",
  /** A checkbox and its words as one 48px row, the box big enough to hit. */
  checkRow: "check-row",
  /** Body size and line height from the type tokens, re-read at this element: for a `lang` set below `<html>`. */
  textRoot: "text-root",
  /** The dock's status line above its button (`role="status"`); empty takes no room. */
  dockStatus: "dock-status",
  dockError: "dock-status error",
} as const;
