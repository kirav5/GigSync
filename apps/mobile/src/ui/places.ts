import { PAISE_PER_RUPEE, type Place, Trade } from "@gigsync/protocol";

/** Neighbourhoods offered in the pilot, by their centre. Only this approximate point is ever shared. */
export const AREAS: readonly (Place & { name: string })[] = [
  { name: "Indiranagar", lat: 12.9719, lon: 77.6412 },
  { name: "Koramangala", lat: 12.9352, lon: 77.6245 },
  { name: "HSR Layout", lat: 12.9116, lon: 77.6474 },
  { name: "Jayanagar", lat: 12.9308, lon: 77.5838 },
  { name: "Whitefield", lat: 12.9698, lon: 77.75 },
];

export const areaNamed = (name: string) => AREAS.find((a) => a.name === name) ?? (AREAS[0] as (typeof AREAS)[number]);

const T = Trade.enum;
export const TRADE_LABEL: Readonly<Record<Trade, string>> = {
  [T.electrician]: "Electrician",
  [T.plumber]: "Plumber",
  [T.maid]: "Maid",
  [T.carpenter]: "Carpenter",
  [T.ac_technician]: "AC technician",
  [T.painter]: "Painter",
  [T.cook]: "Cook",
  [T.driver]: "Driver",
};

/** ₹ for display, Indian grouping, no paise when whole. */
export function money(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export const toPaise = (rupees: string) => Math.round(Number(rupees) * PAISE_PER_RUPEE);
