import { z } from "zod";

/** A neighbourhood as a slug ("jayanagar", "hsr-layout"): the pilot area's name, never an address. */
export const AreaKey = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "area slug")
  .max(60);
export type AreaKey = z.infer<typeof AreaKey>;
