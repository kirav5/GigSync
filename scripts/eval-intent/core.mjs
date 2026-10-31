// The built core and protocol packages, and the zod they use, loaded from packages/core so this script needs no
// dependencies of its own. Run `pnpm --filter @gigsync/core build` first (`pnpm eval:intent` does).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const PACKAGES = new URL("../../packages/", import.meta.url);
const coreRequire = createRequire(new URL("core/package.json", PACKAGES));

export const core = await import(new URL("core/dist/index.js", PACKAGES).href);
export const protocol = await import(new URL("protocol/dist/index.js", PACKAGES).href);
/** Core's zod, for checking the data files. Protocol's schemas are read through their `options`, not composed. */
export const { z } = await import(pathToFileURL(coreRequire.resolve("zod")).href);

/** The card fields a route may name: the interview's slots without its own steps (core's `Field` type). */
const NOT_FIELDS = new Set([core.Slot.ask_first, core.Slot.confirm, core.Slot.done]);
export const FIELDS = Object.values(core.Slot).filter((slot) => !NOT_FIELDS.has(slot));
