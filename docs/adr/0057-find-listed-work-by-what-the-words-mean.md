# ADR 0057: Find listed work by what the words mean, and price it from what workers list

Date: 2026-11-06. Status: accepted by the founders, who asked that a person can ask for any work. Amends
[ADR 0047](0047-open-skills.md) §4 (the words stayed on the phone when matching a skill) and §6 (no price for a skill),
and [ADR 0041](0041-prices-from-drivers.md) (where a range may come from).

## Context

A worker can list any skill, but a household finds one only by naming it: "my tv not working" does not contain "TV
repair". Matching by meaning needs the 129 MB pack on the phone, so most phones had none, and Find said "nobody offers
this work" without looking. A category list was considered: forty to sixty kinds of work, a column on `worker_skills`
and a migration. It would need keeping up by hand, it would lag behind what workers list, and every label a model
writes differs between runs ("tv repair", "electronics repair", "TV not turning on"), so labels cannot be matched.

## Decision

1. **The model picks from what workers list.** Given the words and the board's skill list, most-listed first, up to 100,
   it answers with a number or none, then is asked plainly whether that worker is right for the request; no answer is a
   no (`skills/pick.ts`). If the words find nothing, the model's name for the work is tried. It can only point at the list, so a search never runs on a made-up
   label, a new skill is found the day it is listed, and the list needs no upkeep, no migration and no new table. The name
   in the words and the embedding pack still go first.
2. **"Nobody lists this" is only said after looking**, and the chat offers the trades and takes new words.
3. A household's words about a skill now reach GigSync's model, as all chat has since ADR 0052. A search still sends only
   a skill's key, and the server keeps nothing the words said.

## Consequences

- A need matches one listed name: "TV repair" and "TV mechanic", listed by different workers, are not found together.
- Choosing from a list leans towards choosing: before the second question, a Hindi "swimming teacher" matched "Car wash".
  The second question costs one more call on each pick, and two calls more when the first words find nothing.
- The check makes it careful in romanised Hindi and Kannada, where it finds less than it should (36 of 40 overall). A miss
  says nobody lists the work when somebody does; the owner can say it another way or pick from the list.
- With no model, skills are found by name, as before.
- Past 100 listed skills, the rest are not offered to the model.
