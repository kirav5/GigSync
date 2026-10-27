# GigSync — Revenue model

> Status: **v1.0, 27 Oct 2026.** How GigSync earns without taking anything from the worker's job. The evidence is in
> [the revenue research report](../../reports/GigSync%20revenue%20model%20and%20competitors.md) (competitor unit
> economics, regulation, break-even arithmetic); this page is the decision. It binds [VISION.md](VISION.md) §6
> ("what GigSync is not") and [ROADMAP.md](ROADMAP.md) §8.

## 1. What the competitors actually do, in one table

Every number is sourced in the report. "Extracted from the worker" is what the worker gives up beyond the work.

| Model              | Who pays                     | Worker nets per hour                                         | Platform result                          | Extracted from the worker                                                                                 |
| ------------------ | ---------------------------- | ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Urban Company core | Household + professional     | ~₹311 (company figure); ₹100 on a ₹767 job (worker accounts) | Profitable on ~28% take                  | 28% commission, ~₹1,000 10-day plans, ₹2,500–3,500 credit float, ₹40–50k kits, product markups, ID blocks |
| UC InstaHelp       | Household; investors         | ~₹101 of logged time                                         | Loses ₹279 per order (Q2 FY27)           | ~₹2,000 docked per weekend off, lateness penalties, rating-tiered pay                                     |
| Snabbit            | Household; investors         | ~₹106–128 of logged time                                     | Spent ₹16 per ₹1 revenue (FY26)          | Uniform purchases, ~₹1,000/day leave deductions (disputed), fiat wage cuts                                |
| Pronto             | Household; AI labs (footage) | ~₹83–115 of logged time                                      | Undisclosed; ~$8M burned                 | 13–20% unpaid waiting, pay cut ₹28k→₹24k for new joiners, recorded work sold as AI data                   |
| Yes Madam          | Household + professional     | High per billed minute                                       | Profitable via products (54% of revenue) | 0–20% commission, mandatory training, product kits                                                        |
| Namma Yatri        | Driver                       | 100% of fare                                                 | Loses ₹51 Cr on ₹20–24 Cr (FY25)         | ₹25/day                                                                                                   |
| Apna / WorkIndia   | Employer                     | n/a                                                          | Lose ₹23–50 Cr                           | Nothing, but they sell supply                                                                             |
| Haqdarshak         | CSR / government per outcome | n/a                                                          | −1.9% on ₹40 Cr (FY25): near break-even  | ₹40–200 only when the citizen self-pays                                                                   |
| Nia.one            | Worker (bed); employers (5%) | n/a                                                          | ₹30 Cr ARR                               | ~₹3,000 of a ₹15,000 income, for a bed and meals                                                          |

Two conclusions drive everything below. **No platform that refuses a cut has published a profit**, and the three
instant-help products pay workers more than they charge, which means their eventual margin will come from the
worker's time or wage. **The only near-sustainable models without a cut are paid per outcome by an institution**
(Haqdarshak) or sit on a real asset (Nia.one's beds). Namma Yatri's ₹25 a day works only because it routes
demand; GigSync does not route demand, so a worker access fee is not available to it.

## 2. The rule: nothing GigSync earns may depend on the worker earning less

This is the test every line below passes, and the sense in which the model is better than the competitors'.
Their extraction is now mostly invisible: unpaid waiting, docked leave, credit floats, product markups, fiat wage
cuts, footage sold. GigSync's lines are structured so that **no revenue rises when a worker's rate falls, waits
longer, is steered, or is ranked.** Concretely:

| GigSync never                                             | Because                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Takes a percentage of any job                             | A cut is a cut, whoever is billed; and it makes GigSync a payment aggregator |
| Charges a worker for access, leads, slots or visibility   | That is the Urban Company subscription model unions strike against           |
| Ranks workers, sells placement in results, or sells leads | Steering is how Vahan and Apna earn; it breaks the vouch and the board       |
| Sells, licenses or trains on worker data or footage       | DPDP purpose limitation, and Pronto Verified is the cautionary case          |
| Holds, routes or settles money                            | RBI payment-aggregator net-worth and escrow rules; UPI goes to the worker    |
| Charges a listing fee to be a "vouched" partner           | A vouch that can be bought is not a vouch                                    |

## 3. The revenue stack

In order of evidence and of when each starts. Prices are anchors from the report; every one is an assumption
to be tested, and the report marks which.

### 3.1 Institution-paid outcomes (primary)

**What is sold:** a registered, day-counted worker and a filed, evidenced grievance. These are the outputs of
the Record and Landing pillars (ADR 0019), and they are exactly what Haqdarshak sells to CSR and government
programmes at near break-even, what the Centre pays CSCs ₹20 per e-Shram registration for, and what Karnataka's
Board has a statutory duty to produce with a projected ₹250–300 Cr a year and a 5% admin cap.

**Buyers, in order of approach:** the Karnataka Platform-Based Gig Workers Welfare Board; a CSR programme in
the Haqdarshak coalition's mould; the state domestic-workers board once the draft Bill passes; a foundation
already paying for Bengaluru gig-worker infrastructure (Azim Premji Foundation funds the Board's verification
system).

**Price anchors:** ₹20–50 per registered and day-counted worker; ₹25–50 lakh per programme contract. **Who does
the field work:** the union's stewards, paid from the contract. This is how "union-paid" becomes real: the
contract pays the union, GigSync is the tool and the record.

**Why this passes the rule:** the worker gets PMSBY cover, a UAN and a day count toward statutory benefits; the
buyer pays for a public outcome; the worker's rate is untouched.

### 3.2 Partner handover fee (secondary, constrained)

**What is sold:** a completed handover of a worker who chose a vouched partner (a bed taken, a training seat
filled, a loan disbursed). Nia.one charges employers 5% for placements; Vahan and Apna live on placement fees;
this is the best-evidenced third-party fee in India.

**Constraints that make it compatible with principle 7 ("GigSync introduces; it does not sell"):**
- A **flat fee per kind**, identical for every partner of that kind, so GigSync has no reason to prefer one.
- Paid only on an outcome the worker confirmed in their ledger (a `partner` receipt), never per lead or per query.
- Shown on the worker's confirm card: "Nia.one pays GigSync ₹250 if you take this bed."
- Every vouched partner of a kind is shown, sorted by distance and price, never by fee.
- No partner may pay to be vouched; the union vouches, GigSync does not.

**Price anchor:** ₹250 per landed worker (one-third of Nia.one's 5% on a ₹15,000 placement). **Not before G3.**

### 3.3 Insurance through a licensed partner (secondary)

**What is sold:** distribution of a gig-worker health or accident cover inside the app, with GigSync as a
sub-channel of a licensed corporate agent or broker (Covrzy with Namma Yatri is the live template). Commission
is bounded by IRDAI's expense-of-management caps and is paid by the insurer, not the worker. The worker sees the
premium and the commission. **Anchor:** ~15% of a ~₹600 annual premium, about ₹88 net per insured worker. **Not
before G5**, and only with a product the union has reviewed.

### 3.4 Household-paid agreement and verification (optional, to be tested)

**What is sold to the household:** a verified identity tier (Tier 2, the "verify the maalik" the unions ask
for) and a written, both-signed agreement that the Karnataka draft Bill may soon require. This is a document
and verification service, priced per outcome or per year, never per wage rupee and never routed through the
worker's pay. **Anchors:** ₹49 per signed agreement or ₹199 a year, below the unverified Urban Company Plus
price. **Evidence:** none on willingness to pay; BookMyBai and Broomees show households pay agencies for a
helper. The pilot measures this; if households will not pay, the line is dropped and verification stays free.

### 3.5 Worker-paid, only per outcome and only optional

A worker may pay for a concrete thing they asked for: an evidence pack filed to a portal, a printed record, a
registration done at a union desk. **Anchor:** ₹20–50, Haqdarshak's citizen charge. Never for access, never
recurring, and free through the union's contract where one exists. **Target:** under 10% of revenue, ever.

### 3.6 The union desk is free

Tooling for the union is a cost GigSync carries for distribution and trust, funded by the grant or by line 3.1.
Union dues are ₹5 a year at SEWA and unpublished elsewhere; unions are a channel, not a payer.

### 3.7 Grants are runway, not revenue

A single grant of ₹50–90 lakh (Mozilla Data Futures Lab ceiling, SAMRIDH-class awards, Omidyar or Ford
programmes) buys the 18 months to produce the three proofs an institutional buyer will ask for: a union filing
real cases from the record, one institution accepting the record, households signing. Driver's Seat and Alia
died when the grant ended with no buyer; the plan below exists to avoid that.

## 4. Break-even path

Assumptions from the report: two founders at ₹1 lakh a month plus ₹12 lakh for cloud, counsel, compliance and
field costs, so **₹36 lakh a year** (₹24 lakh lean); 18% GST absorbed on worker and household lines, charged on
institutional contracts; no marketing spend. Per-job variable cost: at most ₹1.5 in WhatsApp or SMS notices
(ADR 0021), carried by GigSync and never charged to the worker.

| Year                       | Revenue lines                                                                                                  | Estimate                 | Needs                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| 1 (G1–G5, Bengaluru pilot) | Grant                                                                                                          | ₹50–90 lakh              | One funder; the pilot's three proofs                                       |
| 2                          | One institutional contract (₹25–30 lakh) + 2,000 handovers × ₹212 + 5,000 insured × ₹88 + 1,000 outcomes × ₹42 | **₹34–39 lakh**          | 5,000–10,000 active workers; one buyer; a housing and an insurance partner |
| 2, without the contract    | Same user base                                                                                                 | ₹9–10 lakh               | Not viable; back to grant or public-good funding                           |
| 3                          | Second state contract; second city's partners; household line if the pilot proved it                           | ₹60–80 lakh (assumption) | A second union and board                                                   |

The pilot itself yields under ₹30,000 a year across every line. Break-even is not a function of fee design; it
is a function of **one buyer in Karnataka** and a user base 100–200 times the pilot within 18 months. That is
the plan's honest shape.

## 5. What makes it better than theirs, and what makes it harder

**Better for the worker:** no commission, no subscription, no fines, no credit float, no ranking, no data sale,
and the only worker-paid line is optional and per outcome. The worker keeps 100% of the agreed rate, holds the
record, and gets registered. Against Urban Company's ~28% take, Pronto's unpaid fifth of the day and Snabbit's
docked leave, that is the whole difference.

**Better for the buyer:** an institution buys a verifiable public outcome (a countersigned day count, a filed
case) instead of a lead or an ad, which is what CSR and welfare funds are already mandated to spend on.

**Harder, and said plainly:**
1. No buyer exists yet in the evidence. No state board has contracted an app; no housing partner has paid a
   worker app; no insurer's gig-channel commission is public. The first 18 months are a procurement effort.
2. Haqdarshak's near break-even rests on 52,000 field agents. GigSync's field force is the union's stewards,
   which needs an MoU no one has signed.
3. Classification risk: an agent that agrees jobs through a board may meet the "connects buyer and provider"
   test in the Code on Social Security and the Karnataka Act. The 1% fee (capped at ₹1.50 a transaction) is
   trivial; the mandatory worker database is not, and it conflicts with the product. Counsel before G2; design
   the board as a directory and the agreement as peer to peer; if classified, the public board cards are the
   only "database" GigSync can offer.
4. Every per-unit line is worth ₹20–₹300, so scale, not price, decides survival.
5. If no institution has paid for a single registration by month 18, GigSync is a public good like Yatri Sathi
   or Fairwork and should be funded as one. The founders should decide now which of the two they are building.

## 6. Measures

Reported from G2 onward, in aggregate only:

| Measure                                            | Target by end of year 2 |
| -------------------------------------------------- | ----------------------- |
| Share of revenue paid by workers                   | < 10%                   |
| Institutional contracts signed                     | ≥ 1                     |
| Revenue per active worker per year                 | ≥ ₹400                  |
| Handover fee as share of partner's price to worker | ≤ 2%                    |
| Households paying for verification (if offered)    | measured, no target     |
| Grant share of total funding                       | falling each year       |

## 7. Decisions for the founders

1. Approach the Karnataka Board or a CSR funder first, and with what per-outcome price (anchor ₹20–50).
2. Accept the handover fee at all, given principle 7, and if so the flat amounts per kind.
3. Test the household line in the pilot or keep verification free.
4. Company or public good: which is being built, decided before the grant application, not after it ends.
5. Commission counsel on the aggregator classification and the person-to-person UPI position before G2.
