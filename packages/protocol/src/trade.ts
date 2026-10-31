import { z } from "zod";

/** The trades GigSync lists. A worker offers one or more; a consumer asks for exactly one. */
export const Trade = z.enum([
  "electrician",
  "plumber",
  "maid",
  "carpenter",
  "ac_technician",
  "painter",
  "cook",
  "driver",
]);
export type Trade = z.infer<typeof Trade>;
