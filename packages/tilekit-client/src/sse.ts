/**
 * A minimal Server-Sent Events reader for a fetch() response body. The browser's EventSource cannot POST, and
 * Tilekit streams `/agent/prompt` and `/atproto/login` as replies to POSTs, so we parse the stream ourselves.
 * Follows the WHATWG event-stream rules we need: `event:` and `data:` fields, multi-line data, comments, and a
 * blank line dispatching the event.
 */
export interface SseEvent {
  /** The `event:` field, or "message" when the server sent none. */
  readonly event: string;
  readonly data: string;
}

const DEFAULT_EVENT = "message";
const FIELD_EVENT = "event";
const FIELD_DATA = "data";
const COMMENT_PREFIX = ":";
const LINE_BREAK = /\r\n|\r|\n/;

interface Pending {
  event: string;
  data: string[];
}

function emptyPending(): Pending {
  return { event: DEFAULT_EVENT, data: [] };
}

/** Applies one line to the event being built; returns a finished event on a blank line. */
function applyLine(line: string, pending: Pending): SseEvent | null {
  if (line.length === 0) {
    if (pending.data.length === 0) return null;
    return { event: pending.event, data: pending.data.join("\n") };
  }
  if (line.startsWith(COMMENT_PREFIX)) return null;
  const colon = line.indexOf(":");
  const field = colon < 0 ? line : line.slice(0, colon);
  let value = colon < 0 ? "" : line.slice(colon + 1);
  if (value.startsWith(" ")) value = value.slice(1);
  if (field === FIELD_EVENT) pending.event = value;
  else if (field === FIELD_DATA) pending.data.push(value);
  return null;
}

/** Yields each event in `body` as it arrives. A trailing event without a blank line is still delivered. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pending = emptyPending();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split(LINE_BREAK);
      buffer = done ? "" : (lines.pop() ?? "");
      if (done && (lines.at(-1) ?? "").length > 0) lines.push("");
      for (const line of lines) {
        const event = applyLine(line, pending);
        if (line.length === 0) pending = emptyPending();
        if (event) yield event;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
