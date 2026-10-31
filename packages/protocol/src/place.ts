import { z } from "zod";

/** An approximate place (a neighbourhood, never a door): what discovery and the request use. */
export const Place = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
export type Place = z.infer<typeof Place>;
