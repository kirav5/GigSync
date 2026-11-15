# Who can be a GigSync mentor: research and recommendation

Date: 2026-11-16. Status: proposal for the owner. Question: "How can one become a mentor? What conditions should we
make for someone to become a mentor?"

## 1. How mentors work today (from the code)

- **The rule** (`packages/core/src/mentor/eligibility.ts`, `packages/protocol/src/mentor.ts`): a worker may list as a
  mentor once _their own phone_ counts **20 finished jobs signed by both sides** and **6 months** since the first of
  them (`MENTOR_MIN_JOBS`, `MENTOR_MIN_MONTHS`). No union, steward or server approves anyone. The protocol leaves out
  ADR 0017's union gate on purpose (see `mentor.ts`, and ADR 0031's "mentors without a union gate").
- **The listing** (`PUT /v1/mentors/me`): first name, city, area (a neighbourhood, never an address), trades, languages,
  jobs and months, open slots (default 2, max 10), a self-declared `woman` flag and `women_only_newcomers`, and `active`.
  The server only checks that the numbers meet the minimum. It cannot verify them, because job records live on the phone.
- **Matching** (`POST /v1/mentors/match`): by city, trade and language, most jobs first, at most 10. A newcomer who says
  she is a woman gets women mentors only by default. A newcomer asks at most 3 mentors at once.
- **Contact**: a mentor link with notes (translated) that expires after 30 days and either side can renew. A newcomer
  never sees a phone number, contacts or the woman flag.
- **Safety**: block (ends the link, never matched again) and report with fixed reasons (`asked_money`,
  `asked_documents`, `unsafe`, `rude`, `other`). **3 reports from different people** take a mentor out of matching until
  someone reviews them (`REPORT_SUSPEND`). An admin-only "vouched by" badge (for a union or NGO) exists but has no UI.
- **Gaps**: no mentor guide, code of conduct or quiz. No check on how many _different_ households signed the 20 jobs. No
  ID-verified condition. No tiers. No recognition beyond the listing. No defined review after a suspension.

## 2. What others do

| Platform / programme                                  | Who can mentor or lead                            | Criteria                                                                                                                                                                                 | Safeguards                                                                                                     | Rewards                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urban Company partner trainers (India)                | Top-rated service partners                        | Top ratings in their category, then part-time trainer, then full-time trainer (an employee)                                                                                              | Company-run training content and on-site audits. SafeSteps: SOS button, 24x7 helpline, women's safety helpline | Paid trainer role and a career ladder ([UC blog](https://www.urbancompany.com/blog/setting-up-service-partners-for-success-upskilling-at-urban-company), [#UCUpskill](https://www.urbancompany.com/blog/ucupskill-rising-with-urban-company), [UC safety](https://investorrelations.urbancompany.com/announcements-and-highlights/service-partner-enablement)) |
| SEWA aagewans (India)                                 | Women members from the same trade and community   | Member of a SEWA trade. Volunteers, put forward by the community, trained in leadership and facilitation (Aagewan Vikas)                                                                 | Women-only organisation. Leadership is collective, not one-to-one, and leaders share members' conditions       | Standing in the community, training, fellowships ([SEWA Bharat](https://sewabharat.org/what-we-do/grassroots-leadership/page/2/), [SEWA Federation fellowship](https://www.sewafederation.org/?p=34273), [capacity building](https://sewafederation.org/capacity-building/))                                                                                   |
| Shadowfax (India delivery)                            | Experienced delivery partners                     | Can become a "community leader" and mentor newer partners in their area                                                                                                                  | Company-run                                                                                                    | Milestone bonuses, referral pay ([Shadowfax](https://www.shadowfax.in/blogs/life-of-a-delivery-partner-at-shadowfax))                                                                                                                                                                                                                                          |
| Uber / Ola / Rapido / Swiggy / Zomato                 | No published worker-to-worker mentor scheme found | Referral codes only. Example, Borzo: points once the referred partner finishes a first delivery                                                                                          | n/a                                                                                                            | Referral bonus ([Borzo](https://www.hrkatha.com/news/compensation-benefits/borzos-new-referral-programme-allows-delivery-partners-to-earn-extra/))                                                                                                                                                                                                             |
| Skill India / NSDC / SSC trainers and master trainers | Certified practitioners                           | Trainer: 1 to 2 years in the job role. Master trainer: about 5 years plus training experience (500+ hours cited). ToT certificate valid about 2 years. Aadhaar on the Skill India portal | Formal assessment, and the certificate expires                                                                 | Paid training work, certificate ([NCVET ToT guidelines](https://ncvet.gov.in/wp-content/uploads/2024/02/ToT-Guidelines.pdf), [FICSI ToT](https://www.ficsi.in/tot), [NSDC FAQ](https://stag-api.nsdcindia.org/system/files/2026-07/Trainer_Assessor%20FAQ%20English.pdf))                                                                                      |
| Pratham Project Rise / LabourNet (India)              | Staff, not alumni                                 | Staff-led migrant support (hostels, documents, counselling). A 2026 report recommends formalising migrant alumni as peer supporters                                                      | Organisation-run                                                                                               | n/a ([Pratham USA](https://prathamusa.org/press/%e2%80%8ba-lifeline-for-migrant-youth), [JustJobs 2026](https://justjobsnetwork.org/files/what-does-it-take-rural-women-migration-and-the-road-to-work_apr-2026.pdf))                                                                                                                                          |
| Airbnb Superhost                                      | Any host who meets the bar                        | Over 12 months: 10+ stays, rating 4.8+, response 90%+, cancellations under 1%. Checked every quarter                                                                                     | Status is lost automatically below the bar                                                                     | Badge, search filter, perks ([Airbnb](https://www.airbnb.co.in/resources/hosting-homes/a/how-to-become-a-superhost-702))                                                                                                                                                                                                                                       |
| TaskRabbit Elite                                      | Taskers who meet the bar                          | 7+ tasks a month, 150 lifetime, top 35% performance, no policy violations in the last 90 days                                                                                            | Re-checked regularly, and violations disqualify                                                                | Badge, ranking ([TaskRabbit](https://support.taskrabbit.com/hc/en-us/articles/360034622812-What-s-Required-to-Become-an-Elite-Tasker))                                                                                                                                                                                                                         |
| eBay Top Rated Seller                                 | Sellers who meet the bar                          | Defect rate 0.5% or less, counted only once defects come from several different buyers. Reviewed monthly                                                                                 | Status drops automatically                                                                                     | Badge, fee discount ([eBay](https://www.ebay.com/help/policies/selling-policies/seller-standards-policy?id=4347))                                                                                                                                                                                                                                              |
| ADPList (design mentors)                              | Applicants that staff review                      | 3+ years' experience and prior mentoring; about 30% accepted. Ongoing standards on response, cancellation and attendance                                                                 | Staff review, and mentees review mentors                                                                       | "Super Mentor" badge, tiers ([ADPList criteria](https://intercom.help/adplist-community/en/articles/8544615-adplist-mentor-criteria), [Super Mentor](https://intercom.help/adplist-community/en/articles/9414647-how-to-receive-the-adplist-super-mentor-badge))                                                                                               |
| Big Brothers Big Sisters / MENTOR "Elements"          | Screened volunteers                               | Application, references, interview, background check every 3 years, a time commitment, training before matching                                                                          | Screening for motivation and red flags, and staff monitoring of each match                                     | Volunteer recognition ([BBBS](https://www.bbbs.org/?p=6168), [MENTOR Elements](https://www.mentoring.org/?p=1579))                                                                                                                                                                                                                                             |

**Safety context for India.** Domestic workers in Bengaluru report sexual harassment, false accusations of theft, and
exploitation by placement agencies and traffickers. Many of them are women newly arrived from other states
([News Minute](https://www.thenewsminute.com/karnataka/benglaurus-shame-abuse-domestic-workers-middle-class-homes-36409),
[Deccan Herald](https://www.deccanherald.com/india/karnataka/bengaluru/bengaluru-domestic-workers-face-sex-abuse-low-pay-1100274.html)).
Platforms have SOS buttons and helplines, but workers report slow responses, and men answering women's calls
([ThePrint](https://theprint.in/ground-reports/snabbit-urban-company-women-gig-workers-molested-delhi-bengaluru/2877171)).
The POSH Act 2013 covers domestic workers through the district Local Committee, but few workers know of it or use it
([Outlook](https://www.outlookindia.com/national/posh-act-on-paper-silence-in-practice-why-domestic-workers-cant-access-justice),
[NCW guide](https://cdn.ncw.gov.in/wp-content/uploads/2025/08/NCW_Posh_Guide_17aug-1.pdf)). A mentor is a stranger who
wins a newcomer's trust when she is most exposed. Fake "agents" use exactly that pattern.

**What the comparison shows.**
1. Badges based on a record (Superhost, Elite, Top Rated) are automatic, re-checked on a schedule and lost
   automatically. That fits GigSync's rule that no one approves anyone.
2. Programmes that put a stranger in a position of trust (BBBS, MENTOR, SSC trainers) add training and a written
   commitment as well as a track record.
3. Indian worker collectives (SEWA) rely on women leaders from the same trade and community, backed by an organisation.
4. Different counterparties matter. eBay ignores defects until several different buyers are involved. The same logic
   should stop 20 jobs with one friendly household from making someone a mentor.

## 3. Recommendation

Keep mentors **open to anyone whose record qualifies, not invite-only**. Anyone who meets the conditions can list, the
app checks what it can, and nobody at GigSync picks mentors. Add a short guide and a code of conduct before listing,
tighten the record a little, and make suspension and removal clear.

### 3a. Conditions to list as a Mentor

| #   | Condition                                                                                          | Why                                                                                                     | How the app checks                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **20 finished jobs, both sides signed** (keep)                                                     | Shows a real working life in the city                                                                   | Already counted on the phone (`mentorRecord`)                                                                                              |
| 2   | **Those jobs were with at least 5 different households** (new)                                     | Stops one friendly household from making a mentor (eBay's different-buyers logic)                       | Count the different counterparties in the same job records                                                                                 |
| 3   | **6 months since the first such job** (keep) and **a job in the last 60 days** (new)               | Knows the city as it is now; active people reply                                                        | Dates in the job records                                                                                                                   |
| 4   | **No open dispute, and no job the other side ended as a problem, in the last 90 days** (new)       | Matches TaskRabbit's 90-day clean record; disputes are a warning sign                                   | On the phone: `JobRecord.problem` (a problem either side reported) and a disputed payment already exist; filter them by date               |
| 5   | **Phone verified** (have) and **ID check passed**, if GigSync adds one (open question)             | Newcomers need to trust the person is real, and reports must stay attached to a person                  | Sign-in already verifies the phone. An ID check would be a yes/no flag on the account, never the number                                    |
| 6   | **Same trade and city** as the newcomer, with an area and languages listed (keep)                  | SEWA's leaders come from the same trade, and local knowledge is the whole point                         | Already in the listing and matching                                                                                                        |
| 7   | **No reports in the last 90 days, and not suspended now** (new as a listing condition)             | Someone under report should not open new links                                                          | Server: `mentor_reports` already has `created_at` and `reviewed_at`; refuse `PUT /v1/mentors/me` when a recent or unreviewed report exists |
| 8   | **Reads the mentor guide (5 short cards, spoken in their language) and answers 3 questions** (new) | BBBS and MENTOR train people before matching them. The guide sets out what a mentor does and never does | A quiz on the phone; the phone remembers that it was passed                                                                                |
| 9   | **Agrees to the mentor code**, read out in their language (new)                                    | A written promise that others can point to when they report                                             | A saved tick with the code's version, asked again when the code changes                                                                    |

**The mentor code (short, spoken):** I never ask for money, fees or a "commission" for work. I never ask to hold
anyone's Aadhaar, phone or papers. I never send someone to a house or room I have not worked at myself through GigSync. I
meet only in public places, and only if she wants to. I do not ask for photos or personal numbers. I tell the truth
about pay. If something is wrong I say so, and I can stop any time. Each line matches a report reason, so a broken
promise is easy to report.

### 3b. Tiers

| Tier                              | Conditions                                                                                                                                       | What changes                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mentor**                        | Meets everything in 3a                                                                                                                           | Listed, with up to 2 newcomers at a time (can raise it to 3)                                                                                                                                         |
| **Senior mentor**                 | 12 months on GigSync, 50 jobs with 10+ households, 6 months as a mentor with 3+ links that were renewed or ended well, and no upheld report ever | Up to 5 newcomers, shown first in matching, and a "Senior mentor" badge                                                                                                                              |
| **Vouched** (a badge at any tier) | A union, SEWA chapter or NGO vouches for them (the admin route exists)                                                                           | Shows "Vouched by …". A vouched worker can mentor before 6 months, for people a collective already knows. This needs a protocol change: `MentorListing` enforces `months >= MENTOR_MIN_MONTHS` today |

The phone re-checks every 3 months, as Airbnb does for Superhosts. Falling below the bar pauses the listing with a plain
message and the way back. It is never a penalty.

### 3c. How someone becomes a mentor

- **They apply; GigSync does not invite.** When the phone sees the record is met, Today asks once: "You have worked 20
  jobs here. Would you like to help someone new to Bengaluru?" Then come the guide, the quiz, the code and the listing.
  There is no form to send GigSync and nobody to wait for.
- **A vouch is the only invitation.** A union or NGO partner can vouch for someone who has not reached 6 months yet,
  because a collective knows its members better than a count does.

### 3d. Pausing and removal

- **A mentor pauses themselves** with `active: false` or 0 slots (have). Taking a break never costs anything.
- **The app pauses a listing** when the record falls below the bar at a re-check, after 60 days with no job, or when a
  newcomer's request goes unanswered for 7 days twice in a row.
- **Suspension**: 3 reports from different people (have). New: **a single `asked_money`, `asked_documents` or `unsafe`
  report suspends at once** while it is reviewed, because these are the fraud and trafficking patterns. Open links stay
  readable, but the mentor cannot start new ones.
- **Review** within 7 days, by GigSync with a union or NGO partner where there is one. Both sides answer fixed
  questions. The result is one of three: cleared (the reports no longer count), a warning, or removal.
- **Removal**: an upheld `asked_money`, `asked_documents` or `unsafe` report ends mentor status for good. Other upheld
  reports end it for 6 months. Removal does not affect their ordinary work on GigSync unless the report was about that too.

### 3e. Women's safety rules

1. A newcomer who says she is a woman sees **women mentors only by default** (have). Only she can widen that; the app
   never does it for her.
2. Women mentors can choose to take **women newcomers only** (have).
3. **Contact stays in the app**: no number, contacts or address shared (have). Either side can offer to share a number.
   It is shared only when **both** tap "share", and either can take it back by ending the link.
4. **No meeting before 3 days of notes.** The app then suggests public places (a bus stand, a temple, a market) and says
   "tell someone you trust where you are going".
5. **Report and block on every note**, always one tap away (have). The reasons stay a fixed list; add a spoken line
   explaining each one.
6. **The guide's helplines on every mentor screen**: Women Helpline 181, Police 112, the Karnataka domestic workers'
   union, and the district Local Committee under POSH, with one sentence on what each does.
7. **Caps**: by default a mentor has at most 2 open links (5 for a Senior mentor), and a newcomer asks at most 3 mentors
   at once (have). A mentor who ends many links early is paused for review.
8. The app never asks a mentor about a newcomer's gender, and never shows the woman flag (have).

### 3f. What mentors get (GigSync takes no commission)

- **A badge on their worker card** that households see: "Mentor" or "Senior mentor", plus "Vouched by …" where set.
- **Priority**: a small, stated lift in household search in the mentor's own trade and area, because households trust
  people other workers trust. It is always shown as a reason, never a hidden boost.
- **Thanks from the newcomer**: when a link ends well, the newcomer can record a spoken thank-you that the mentor keeps.
  It also counts toward Senior mentor.
- **No money from GigSync and none from newcomers.** A small token later (say a phone recharge paid by a partner or a
  grant) is possible. Paying mentors would push people to collect mentees and blur the "never ask for money" rule.

## 4. Open questions for the owner

1. **ID check**: should "ID verified" be a condition? The app confirms the number linked to Aadhaar but holds no ID
   flag. Adding one means deciding what gets checked and by whom: DigiLocker, a partner, or nobody.
2. **Who reviews suspensions** in the pilot: GigSync staff, a union or NGO partner, or both? Today nobody is an admin
   until `ADMIN_KEY` is set.
3. **Suspending at once on one serious report**: is it worth it? A false report could pause an honest mentor for up to
   7 days, but fraud and trafficking would be stopped fast.
4. **Thresholds**: keep 20 jobs and 6 months, or lower them for the pilot (for example 10 jobs and 3 months) so
   Bengaluru has mentors in the first months, with vouches filling the gap?
5. **A search lift for mentors**: acceptable, or does it break the rule that the server only matches by fixed rules?
6. **A vouching partner in Bengaluru**: which union or NGO (a domestic workers' union, SEWA Karnataka, Stree Jagruti
   Samiti) would vouch for mentors and help review reports?
