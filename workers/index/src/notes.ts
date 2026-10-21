// Public ("World") notes: what Collab owners chose to publish under their handle (dev.collab.world.note: text and
// when, nothing else). Indexed for full-text search so anyone can discover them; the record in the owner's repo stays
// the source of truth, and apps re-read it there before trusting it.
import type { DB } from "./store.ts";

export const NOTE_COLLECTION = "dev.collab.world.note";
const MAX_TEXT = 1000;
/** A repo can't flood the index: only its newest notes are kept. */
export const MAX_NOTES_PER_REPO = 200;

export interface Note { uri: string; did: string; rkey: string; text: string; created_at: number }

/** A note record as published by the app, or null if it isn't one. */
export function noteFor(did: string, rkey: string, record: any): Note | null {
  if (record?.$type !== undefined && record.$type !== NOTE_COLLECTION) return null;
  const text = typeof record?.text === "string" ? record.text.trim() : "";
  const at = Date.parse(record?.createdAt ?? "");
  if (!text || text.length > MAX_TEXT || !Number.isFinite(at) || !/^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(did) || !/^[A-Za-z0-9._:~-]{1,512}$/.test(rkey)) return null;
  return { uri: `at://${did}/${NOTE_COLLECTION}/${rkey}`, did, rkey, text, created_at: Math.floor(at / 1000) };
}

export async function putNote(db: DB, n: Note, now: number) {
  await db.prepare("INSERT OR REPLACE INTO notes (uri, did, rkey, text, created_at, indexed_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(n.uri, n.did, n.rkey, n.text, n.created_at, now).run();
  // Keep only the repo's newest notes.
  await db.prepare(`DELETE FROM notes WHERE did = ? AND uri NOT IN (SELECT uri FROM notes WHERE did = ? ORDER BY created_at DESC LIMIT ${MAX_NOTES_PER_REPO})`)
    .bind(n.did, n.did).run();
}

export async function removeNote(db: DB, did: string, rkey: string) {
  await db.prepare("DELETE FROM notes WHERE uri = ?").bind(`at://${did}/${NOTE_COLLECTION}/${rkey}`).run();
}

/** Every word of the search must appear (any language FTS5's unicode tokenizer splits into words); best match first. */
export function ftsQuery(q: string, any = false): string | null {
  // Letters, digits and combining marks (Hindi and other Indic vowel signs are marks, part of the word).
  const words = q.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) ?? [];
  const kept = words.filter(w => [...w].length > 1 || /\p{N}/u.test(w)).slice(0, 8);
  return kept.length ? kept.map(w => `"${w}"*`).join(any ? " OR " : " ") : null;
}

/** Notes with every word first; if none, notes with any of them (best matches first). */
export async function searchNotes(db: DB, q: string, opts: { did?: string; limit?: number } = {}): Promise<Note[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  for (const any of [false, true]) {
    const fts = ftsQuery(q, any);
    if (!fts) return [];
    const sql = `SELECT n.uri, n.did, n.rkey, n.text, n.created_at FROM notes_fts f JOIN notes n ON n.rowid = f.rowid
                 WHERE notes_fts MATCH ?${opts.did ? " AND n.did = ?" : ""} ORDER BY bm25(notes_fts), n.created_at DESC LIMIT ${limit}`;
    const args: unknown[] = [fts];
    if (opts.did) args.push(opts.did);
    const rows = (await db.prepare(sql).bind(...args).all()).results as Note[];
    if (rows.length || !fts.includes(" ")) return rows;
  }
  return [];
}

export async function countNotes(db: DB): Promise<number> {
  return (await db.prepare("SELECT COUNT(*) AS n FROM notes").bind().first())?.n ?? 0;
}
