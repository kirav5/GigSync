# ADR 0039: Estimates come from GigSync's agreed prices first; contact details are deleted once a job is settled

Date: 2026-10-31. Status: accepted. Amends [ADR 0030](0030-rate-estimates-from-sourced-quotes.md) (estimates) and
[ADR 0038](0038-job-records-on-the-server.md) (job records), and the contact release of [ADR 0014](0014-agent-to-agent-jobs.md).

## Context

Job records on the server (ADR 0038) carry the agreed price, trade, job size, area and date of every job both sides
consented to keep. The founders want those prices to drive the ranges shown to workers and households, and the agent
to answer what the market pays, by area and city. Separately, once both sign, each phone keeps the other's phone
number and address for good; the founders want that time-bounded on both sides.

## Decision

1. **Market prices from job records.** An estimate for a trade, job size and area is computed first from agreed prices
   in job records (attested and one-sided both count; cancelled jobs do not) over the last twelve months: the 25th,
   50th and 75th percentiles, shown only when at least `K_MIN` (10) jobs fall in the group, between at least `K_MIN`
   different workers and `K_MIN` different households, so no one person's price can be read from a range and one
   worker with a second account cannot set an area's range. Too few in the area widens to the city, then to the web quotes of ADR 0030 as the fallback; the
   legal minimum stays the floor. The basis says which ("from 34 jobs on GigSync in Jayanagar"). Nobody is asked to
   share a price: agreed prices are platform data under the Terms and Privacy Notice, and only group ranges are ever
   shown. ADR 0030 §3's opt-in sharing and its question end.
2. **The agent answers market questions** ("what do cooks charge in Jayanagar?") from these figures in the chat; a model
   may word the answer, numbers come from code and are checked as in ADR 0033.
3. **Contacts are deleted once a job is settled**, on both phones: the other side's contact card and any phone number
   or address in that job's own words. The job record, payments, rating and the agents' structured talk stay; the job
   thread keeps working for follow-ups.
   - One-time job: when it is marked done and the worker has confirmed payment; if payment is never confirmed, three
     days after done.
   - Monthly or daily arrangement: kept while it is active; deleted when either side ends or cancels it and the last
     payment is confirmed, with the same three-day cap.
   - "Report a problem" before deletion keeps them until it is resolved, at most 30 days.
   - Hiring the same person again goes through GigSync, which releases contacts again after both sign.
   - GigSync deletes only its own copy: a number already saved in the phone's contacts or call log is beyond it.
4. **No separate records notice screen.** The sign-in screen carries one line, "By continuing, you agree to GigSync's
   Terms and Privacy Notice"; continuing records the agreement (notice version) on the server. The documents are
   written separately. ADR 0038 §5's notice screen is replaced by this.
5. **No phone-number lookup on the server.** Phone numbers stay a one-way hash for sign-in; the server never stores a
   readable number, address or contact card (ADR 0038 §6's promise stands).

## Consequences

- Estimates for busy areas reflect what GigSync workers actually agree; quiet areas still lean on the web.
- A worker or household can no longer reach the other outside the app weeks later from GigSync's data.
