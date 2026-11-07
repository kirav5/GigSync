import { type BoardSkill, MAX_SKILL_LIST, type WorkCategory } from "@gigsync/protocol";
import type { Db } from "./client.js";

type SkillRow = Omit<BoardSkill, "category"> & { category: WorkCategory | null };

/**
 * The board's skill list (ADR 0047 §4): every skill on an active worker's card, once per key, with the words most of
 * its workers used, the kind of work most of them confirmed (ADR 0059), and how many list it, most-listed first. A household's phone matches its owner's words against
 * this list on the phone and searches by a key from it, so the words never reach the server.
 */
export async function listSkills(db: Db): Promise<BoardSkill[]> {
  const { rows } = await db.query<SkillRow>(
    `SELECT s.skill_key AS key, mode() WITHIN GROUP (ORDER BY s.text) AS text,
       mode() WITHIN GROUP (ORDER BY s.lang) AS lang, mode() WITHIN GROUP (ORDER BY s.category) AS category,
       count(*)::int AS workers
     FROM worker_skills s
     JOIN users u ON u.user_id = s.user_id AND u.status = 'active'
     GROUP BY s.skill_key
     ORDER BY workers DESC, s.skill_key
     LIMIT $1`,
    [MAX_SKILL_LIST],
  );
  return rows.map(({ category, ...skill }) => (category ? { ...skill, category } : skill));
}
