import { z } from "zod";

/** AT Protocol collection NSIDs for Collab's public records. Kept in the user's repo on Bluesky's PDS; D1 indexes copies. */
export const COLLECTIONS = {
  profile: "network.collabai.worker.profile",
  listing: "network.collabai.listing",
  note: "network.collabai.world.note",
  review: "network.collabai.review",
} as const;

const did = z.string().regex(/^did:(plc|web):[A-Za-z0-9._:%-]+$/, "did");
const isoDate = z.string().datetime({ offset: true });
/** Geohash cells at three sizes, roughly city / neighbourhood / street, as the index already stores them. */
const areaCells = z.object({ g4: z.string().length(4), g5: z.string().length(5), g6: z.string().length(6) });

/** A worker's public card. Never holds a phone number or exact address. */
export const WorkerProfile = z.object({
  $type: z.literal(COLLECTIONS.profile),
  name: z.string().min(1).max(80),
  categories: z.array(z.string().min(1).max(40)).min(1).max(10),
  languages: z.array(z.string().length(2)).min(1),
  area: areaCells,
  hours: z.string().max(120).optional(),
  about: z.string().max(500).optional(),
  createdAt: isoDate,
});
export type WorkerProfile = z.infer<typeof WorkerProfile>;

export const Listing = z.object({
  $type: z.literal(COLLECTIONS.listing),
  category: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  text: z.string().max(1000).optional(),
  priceInr: z.number().int().nonnegative().optional(),
  area: areaCells,
  createdAt: isoDate,
  expiresAt: isoDate,
});
export type Listing = z.infer<typeof Listing>;

export const WorldNote = z.object({
  $type: z.literal(COLLECTIONS.note),
  text: z.string().min(1).max(1000),
  createdAt: isoDate,
});
export type WorldNote = z.infer<typeof WorldNote>;

/** Counted by the index only when `engagement` points to a delivered engagement both sides signed. */
export const Review = z.object({
  $type: z.literal(COLLECTIONS.review),
  subject: did,
  stars: z.number().int().min(1).max(5),
  text: z.string().max(500).optional(),
  engagement: z.string().min(1),
  createdAt: isoDate,
});
export type Review = z.infer<typeof Review>;

export const Did = did;
