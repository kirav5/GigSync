import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";

/**
 * The sign-in pages a person sees when they add GigSync to Claude or ChatGPT: their number, the code, then what the
 * assistant may do. Light, plain and short, like the app. Every value that came from a client or a person is escaped.
 */

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The form's step, posted back to /authorize. */
export const Step = { phone: "phone", code: "code", consent: "consent" } as const;
/** The consent form's answer that grants access. */
export const APPROVE = "approve";

const STYLE = `
  :root { color-scheme: light; --bg: #fbf6ec; --ink: #2b2118; --muted: #6b5d4f; --accent: #c4561c; --line: #e6dccb; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.5 system-ui, sans-serif; }
  main { max-width: 420px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 20px; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input[type=tel], input[type=text] { width: 100%; padding: 14px; font-size: 18px; border: 1px solid var(--line);
    border-radius: 12px; background: #fff; }
  button { width: 100%; padding: 14px; margin-top: 16px; font-size: 17px; font-weight: 600; border: 0;
    border-radius: 12px; background: var(--accent); color: #fff; cursor: pointer; }
  button.quiet { background: transparent; color: var(--muted); margin-top: 8px; }
  ul { padding-left: 20px; margin: 0 0 20px; }
  .error { color: #a12a1a; font-weight: 600; }
  .note { font-size: 14px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

const errorLine = (error?: string) => (error ? `<p class="error">${escapeHtml(error)}</p>` : "");

export function phonePage(error?: string): string {
  return page(
    "Sign in to GigSync",
    `<h1>Connect GigSync</h1>
<p>Use the number you use in the GigSync app.</p>${errorLine(error)}
<form method="post"><input type="hidden" name="step" value="${Step.phone}">
<label for="phone">Phone number</label>
<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+91 98xxxxxxxx" required>
<button>Send code</button></form>`,
  );
}

export function codePage(phone: string, error?: string): string {
  return page(
    "Enter your code",
    `<h1>Enter the code</h1>
<p>Sent to ${escapeHtml(phone)}.</p>${errorLine(error)}
<form method="post"><input type="hidden" name="step" value="${Step.code}">
<input type="hidden" name="phone" value="${escapeHtml(phone)}">
<label for="code">6-digit code</label>
<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
<button>Continue</button></form>`,
  );
}

export function consentPage(details: ConsentDescription, handle: string): string {
  const name = escapeHtml(details.clientName ?? "This assistant");
  const local = details.redirectIsLoopback
    ? `<p class="error">This sends access to an app on this computer. Continue only if you just started from it.</p>`
    : "";
  return page(
    `Allow ${details.clientName ?? "this assistant"}?`,
    `<h1>Allow ${name} to use GigSync?</h1>
<p>Access goes to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>${local}
<p>It will be able to:</p>
<ul><li>Find workers near a place</li><li>See your own card</li></ul>
<p class="note">It cannot read or send your messages, and it cannot agree to any job. You can remove it any time.</p>
<form method="post"><input type="hidden" name="step" value="${Step.consent}">
<input type="hidden" name="handle" value="${escapeHtml(handle)}">
<button name="decision" value="${APPROVE}">Allow</button>
<button class="quiet" name="decision" value="deny">Not now</button></form>`,
  );
}

export function problemPage(message: string): string {
  return page("Something went wrong", `<h1>Something went wrong</h1><p>${escapeHtml(message)}</p>`);
}
