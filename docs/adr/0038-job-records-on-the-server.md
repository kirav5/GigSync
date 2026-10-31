# ADR 0038: Structured job records are kept on the server, with no contact details; free text stays on the phones

Date: 2026-10-31. Status: accepted. Supersedes [ADR 0037](0037-server-held-record-earnings-and-moving-phones.md) §1–2
(stars and monthly earnings sent on their own) and amends the [HLD](../gigsync/HLD.md) §2 non-goal "a central database
of workers that the worker cannot see": the database exists, and the worker can see and take all of it.

**Amended 2026-10-31:** §3's record counts only jobs with status done (one-sided ones still only once the household's
agree was delivered), and no longer counts households who came back (ADR 0036, amended).

## Context

The founders want each worker's record (jobs, work done, stars, payments) held by GigSync so it survives any phone,
can be pulled by the worker and taken anywhere (other platforms let no worker keep their history), and supports
per-worker analytics and incentives. They require that phone numbers, addresses and contact details are never stored
on the server.

Job records with worker and household ids, prices and times are personal data under India's DPDP Act 2023 even
without phone numbers: the ids link to names on cards and to phone-number hashes. Free text (what a household wrote,
the agents' questions and answers, notes, review words) routinely carries addresses, phone numbers and household
circumstances.

## Decision

1. **What the server keeps per job (structured only)**: worker and household ids, trade, the job's structured scope
   (counts and yes/no details: rooms, people, meals, pets, area band, labour only, coats, hours), date and time window,
   the agreed price and terms fields, status (agreed, done, cancelled), payments (amount, date, method; never a UPI
   reference), and the household's stars. Never free text, contact cards, addresses or UPI ids.
2. **Two-party attestation**: after both sign, each phone sends the structured record and its signature over the full
   terms. The server stores the record only when both phones sent the same structured fields and both signatures
   verify against their devices' keys; a mismatch is kept aside, not counted. Status changes, payments and stars are
   accepted only from the side entitled to them (payment confirmed by the worker who received it, done by either,
   stars by the household).

   **One-sided jobs.** When only the worker's side reaches the server (the household declined the notice, so its phone
   never sends), her verified submission is stored as a job marked not attested, with the household's id. It counts on
   her record (jobs and came back) without the household's consent. The household's matching submission later makes it
   attested; a differing one sets it aside and withdraws the job. A household's submission alone never makes a job.
   Exports and analytics show which jobs are one-sided. A worker's signature alone would let her inflate her record by
   inventing jobs that name any user as the household. So a one-sided job is stored only once the server has
   delivered the household's own signed `agree` on that engagement to that worker: the mailbox checks the sender's
   session and device signature, and keeps that header (who signed which engagement to whom; never content). The
   household's phone sends that agree whatever it chose on the notice. Until it arrives the worker's side waits, and
   becomes one-sided when it does. Inventing a job then needs a second account (a phone number), as attestation does.
3. **The record and analytics come from these rows**: jobs, average stars with how many rated, came back, revenue per
   worker. Cards serve the record (Privacy's switch hides it, all or nothing). Incentives reward workers; they never
   change who households see first or how they are sorted.
4. **The worker can pull her record**: a "My work record" export from the server (jobs, dates, trades, earnings, stars),
   on any phone she signs in to.
5. **Notice and agreement, both sides**: at sign-up (and once for existing users), a plain notice says what is kept,
   why (your record, analytics, incentives), that phone numbers and addresses never are, and how to delete. Deletion on
   request removes the person's rows (a household's deletion keeps the worker's side of the record without the
   household's id).
6. **Promise**: "We never store phone numbers, addresses or contact details on our servers. Your work record is kept
   so you can take it anywhere."
7. **Unchanged**: the agents' messages, chats, memory and every free-text field stay on the phones, sealed in transit.

## Consequences

- Migration 0008: job records, payments, stars, consent and deletion; ADR 0036's signature and review id rows are
  folded in. 0007 (phone transfer) stands.
- Job history restores from the server after a reinstall; moving phones still carries chats, memory and free text.
- GigSync becomes a data fiduciary for this data: notice, purpose, access limits, breach reporting and deletion.
- The terms hash covers free text (the scope and slot words), which the server never receives, so it cannot check the
  structured fields against the hash itself: it checks that both sides signed the same hash and sent the same fields.
  One tampered phone cannot store a false job; two colluding accounts (each costing a phone number) could.
