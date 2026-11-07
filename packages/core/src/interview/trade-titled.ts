import { Lang, Trade } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { normalize } from "./normalize.js";

const T = Trade.enum;

/** What people call a trade beyond its name in the catalogs. */
const TRADE_TITLES: Readonly<Record<Trade, readonly string[]>> = {
  [T.electrician]: ["electrician", "bijli wala", "बिजली वाला"],
  [T.plumber]: ["plumber", "nal wala", "नल वाला"],
  [T.maid]: ["maid", "kaamwali", "कामवाली"],
  [T.carpenter]: ["carpenter", "badhai"],
  [T.ac_technician]: ["ac technician", "ac mechanic"],
  [T.painter]: ["painter"],
  [T.cook]: ["cook"],
  [T.driver]: ["driver"],
};

/** Whole words only: "driver" is not in "screwdriver". */
const wholeWord = (title: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{M}])${normalize(title)}(?![\\p{L}\\p{M}])`, "u");

const TITLES = Trade.options.map(
  (tr) => [tr, [...TRADE_TITLES[tr], ...Lang.options.map((l) => t(l, `trade.${tr}`))].map(wholeWord)] as const,
);

/**
 * The trade the words ask for by name: "I need a plumber" is a plumber whatever a model reads. Only names count, unlike
 * `tradesIn`, whose lists also hold words that only suggest a trade ("kitchen"). Two trades named leave it to the model.
 */
export function tradeTitled(text: string): Trade | undefined {
  const said = normalize(text);
  const titled = TITLES.filter(([, titles]) => titles.some((title) => title.test(said)));
  return titled.length === 1 ? titled[0]?.[0] : undefined;
}
