# ADR 0004: Our own mailbox replaces Nostr relays for private messages

Date: 2026-10-21. Status: accepted.

## Decision

Agent-to-agent envelopes go through a GigSync mailbox (a Durable Object per user), not through public Nostr
relays as in the Swift app. Public listings move from Nostr events to AT Protocol records (ADR 0003).

## Why

| Need                        | Public Nostr relays                            | GigSync mailbox                         |
| --------------------------- | ---------------------------------------------- | --------------------------------------- |
| Guaranteed delivery         | May drop or not store                          | Stored until acknowledged, then deleted |
| Wake a sleeping phone       | Needs an open socket, which Indian phones kill | FCM wake built in                       |
| Spam and abuse control      | Each relay decides                             | Quotas, blocks, reports we enforce      |
| Deletion under the DPDP Act | Copies on relays we don't control              | Complete                                |
| Latency from India          | Most relays are in Europe and the US           | Nearest Indian city                     |

## Consequences

- The transport is ours to run and scale; it is also the simplest part (small sealed blobs).
- Nostr could return later as a fallback path when our servers are unreachable.
- The signed-event JSON the index already stores is fine to keep during the move; only the relays go.
