# Load tests

Two tests, one per part that can run out first:
- `model/`: the model on GigSync's computer (Ollama on the Mac Studio, through `model.gigsync.network`), by itself.
- `app/`: simulated phones going through the app's journeys against an API, optionally with model calls.

Both write every sample and a `summary.json` under `tests/load/runs/` (gitignored).

## Before you run anything

The Mac Studio's model and the Neon database are production, and pilot users share them. A run against either needs
the owner's yes **for the steps and length you will use**, asked before the run. A run slows pilot users: a model call
of theirs queues behind the test's, and the phone falls back to its own model after 4 s.
- Never send `num_ctx` or another `keep_alive` to Ollama: a different context size reloads the model (about 9 s),
  and every phone waits through it. `model/ollama.ts` sends exactly what the API sends.
- `app/run.ts` refuses a non-local API unless `--allow-remote` is passed. The deployed API rate-limits sign-in to 10 a
  minute per address, so a remote run cannot sign in many phones anyway.
- Test phones are `+9198…` numbers with random digits. Their cards are in the Bay of Bengal, and households ask only
  the step's own workers, so no real worker or household is ever matched. Cards come down and sessions are signed
  out when each step ends. User, device and session rows stay.

## The model

The prompts come from a production run's log (`tests/ui/prod-runs/<run>/model-calls.jsonl`, written by
`tests/ui/test/prod-kinds.spec.ts`). The test draws each purpose by its share in that run. `explain` counts once per
phone and prompt, as the phone has cached it since #75. JSON calls get a schema rebuilt from the reply's shape (see
`model/corpus.ts`).

```bash
pnpm --filter @gigsync/load-tests load:model --corpus <run>/model-calls.jsonl --steps 1,2,4,8,16,32 --seconds 60
```

Each step keeps C calls in flight for its length (a closed loop). The table gives calls and reply tokens per second,
the total, first-token and Ollama-side times, the share over the phone's 4 s and core's 8 s, and the most time spent
loading the model. The run stops climbing once half of a step's calls fail. Calls are streamed to time the first
token; Ollama's work is the same as for the API's unstreamed calls.

## The app

```bash
pnpm dev:workers                     # the API on :8787, on the database in .env.local
pnpm --filter @gigsync/load-tests load:app --users 10,25,50 --seconds 180 \
  [--corpus <run>/model-calls.jsonl] [--db-env DATABASE_URL_UNPOOLED]
```

In each step, 30% of the people are workers who sign in, list a card and keep the app open. The rest are households
who sign in, look up skills, rates and workers, ask two workers, answer their questions and sign. Everyone checks
their mailbox every 2 s, as the app does. With `--corpus`, each person also makes their side's share of the
production run's model calls through `POST /v1/model/generate`, 3 to 9 s apart. With `--db-env`, the database's
connections and transactions are sampled every 5 s, read only.

The generator's own event-loop delay and CPU are printed per step: past about 50 ms of loop delay, the timings
measure this machine, not the server.
