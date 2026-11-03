# ADR 0050: The hour a household books, working hours on the card, a job's steps, addresses by chat, and maps

Date: 2026-11-03. Status: accepted. Amends [ADR 0048](0048-worker-schedule-on-the-phone.md) §1 (a worker's working
hours, not their bookings, go on the card), [ADR 0045](0045-saved-addresses-and-coarse-location.md) (addresses and current location) and
[ADR 0043](0043-job-alerts-empty-web-push.md) §5 (a job's progress steps). Builds towards
[ADR 0049](0049-clock-slots-and-one-booking-per-slot.md), still proposed, without its protocol change.

## Context

Hand-testing against a home-services app the founders use found five gaps:
- A household picks a day but never a time: Find's When question offers Today, Tomorrow, Every day or a date, and a
  time only if it is typed. A board search then lists every worker of the trade nearby, whether or not they work then.
- Nothing on the server says when a worker works. Their bookings are on their phone (ADR 0048) and the board has no
  hours, so a household meets a busy worker only after asking them.
- On a signed job the worker sees "On my way" and "Mark done" together, and nobody can cancel: `GigDevice.cancelJob`
  exists and is never offered.
- A worker's "Use my location" lost the phone's point when the place found had a pilot area's name, falling back to
  that area's centre, kilometres off; with geocoding off it failed outright; the area list showed Indiranagar while
  nothing was picked. A household's location fix was low accuracy, a street or two out at a door.
- Addresses live in Settings and in a form at Find's "where" question. The founders want them handled by talking to
  the agent ("change my address", "add an address"), the chosen address shown at the top of Find, an address outside
  the area GigSync serves refused with a plain "not in your area yet", and a map to see the place on.

## Decision

1. **The hour, after the day.** Once the day is known and no time was said, Find asks "What time should they come?"
   with a chip for each hour from 7 am to 8 pm (`FIRST_HOUR`, `LAST_HOUR`; on today only hours after the phone's hour)
   and "Any time" (`need-time.ts`). The hour is kept as the owner reads it ("2 pm", "दोपहर 2 बजे", "ಮಧ್ಯಾಹ್ನ 2 ಗಂಟೆ"),
   as a typed time is, and the window the agents negotiate is read from it by `windowOf`. A time said with the day
   ("tomorrow 10 am") answers both; a day changed at the readback keeps the hour. The terms stay `{ day, window }`:
   clock-time terms are ADR 0049's, which needs a protocol bump and is not decided.
2. **Working hours on the card.** A worker may tick the days they work (Mon to Sun) beside the parts of the day they
   already tick (`TermPrefs.days`, `windows`). Either set puts `work_hours: { days, windows }` on the public card, the
   other filled with all; neither, and the card works any time, as every card did. These are shop hours, not a
   calendar: bookings and jobs stay on the phone (ADR 0048), and the form says so. Their agent also never takes a
   job on a day off (`workerStance`).
3. **The board leaves out who cannot come.** `GET /v1/board/workers` takes the need's `day` (a date or `daily`) and
   `window` (from the hour; none for "Any time"). A worker is left out when their hours exclude the day's weekday or
   the window, or when GigSync's record already holds an agreed job of theirs in that window on that date or every
   day (`job_records`, which the server keeps for every signed job since ADR 0038: no new data). Bookings on phones
   are not seen; such a worker still declines when asked, as today. Migration 0014 adds `work_days` and
   `work_windows` to `worker_profiles` (NULL = any) and an index for the agreed-jobs check. Neon is the live
   database and migrations run on deploy: merging this applies it.
4. **A job's moves, one at a time, and cancel.** The worker is offered the next step only: On my way, then "Arrived:
   start work" (the `started` update, which the progress line already drew when present), then Mark done. The next
   step is read from the step notes the job keeps, not its status, since a free-text note also moves a job to in
   progress (`nextWorkerStep`). Until the work is handed over (agreed or in progress), either side may cancel, after
   a second tap; it sends the `cancel` the state machine always allowed, and the record follows (ADR 0038).
5. **Where a worker works from.** The place found by "Use my location" is the card's base, at its own coarse point,
   even when its name is a pilot area's. With geocoding off, the pilot area the phone is in is used at the phone's
   own point. The area list starts on "Choose your area". A household's address asks the phone for its best fix
   (high accuracy, at most 30 s old); a worker's area keeps the coarse one.
6. **Addresses by chat.** In Find, words that ask to add, change or pick an address ("change my address", "नया पता",
   "ವಿಳಾಸ ಬದಲಿಸಿ") open the address turn in the chat, read by word lists on the phone so it works on every phone:
   the saved addresses as chips to pick, "Use my current location" and "Add a new address". Find's header shows the
   chosen address at the top, and tapping it opens the same turn. An address outside the area GigSync serves (the
   city circle, `CITY_AREA`, Bengaluru 30 km) is not saved: the chat says "Sorry, we're not in your area yet".
7. **Maps from Ola, through GigSync's API.** The map is drawn with MapLibre from Ola Maps' vector tiles, fetched
   through `GET /v1/geo/map/*` on GigSync's API, which adds the key and caches; the phone never calls Ola itself, so
   Ola sees GigSync's server, not who looks where, and the key never ships in the app. Shown in two places: picking a
   place (a household's address and a worker's area: the pin is the map's centre, "Current location" recentres it),
   and the worker's signed job, where the household's door is marked. For that, the contact card a household's
   phone sends once both have signed (`ContactCard`) gains the address's exact `point`, sealed to the worker's
   devices like the address text; an older phone ignores the field. On the job the worker can move and zoom the map
   around a marker on the door, and "Directions" opens the way there in the phone's maps app (Google Maps' directions
   link, which opens its app where installed): only that tap sends the point outside GigSync, from the worker's own
   phone. The point goes when the contacts do (ADR 0039 §3): with the card on both phones, and from the household's
   need it was sent from. Without `OLA_MAPS_API_KEY` the API answers 503 and no map is drawn; the Directions link
   needs no key, and everything else works without it.

## Consequences

- Every household need now has one more question, unless a time was said. Typed and spoken times still work.
- Workers with no hours set are listed at every time, so the filter helps only as workers fill their hours in.
- The server learns which days and parts of the day a worker works, by their choice; it learns nothing new about
  their bookings.
- "Arrived: start work" adds a tap for the worker; the household sees "Started" on the progress line.
- Cancelling a signed job has no reason picker yet (`CancelReason.other`), and no cut-off before the visit.
- Map tiles cost per request at Ola; the API caches them, but a busy pilot needs a budget, and a static map on the
  job card may be cheaper than an interactive one.
- The household's exact door reaches the worker they signed with. It went as text already; the point makes it
  navigable. A typed address saved without the owner seeing the pin takes its point from search, which can be wrong
  for a loosely written address, and the worker's directions follow it.
