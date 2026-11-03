/**
 * A model's reply as the owner may read and hear it. Qwen3 and Qwen3.5 reason in `<think>` blocks; with thinking turned
 * off, WebLLM 0.2.86 still starts the reply with an empty one, and a model held to the token limit stops inside one.
 * None of that is for the owner, nor for memory or the voice. Words a model marks up as Markdown are read as plain
 * text: the chat shows text as it is, the phone translates it, and speech would read the asterisks aloud.
 */

/** A reasoning block, closed or cut off by the token limit, with the space after it. */
const THINKING = /<think>[\s\S]*?(?:<\/think>|$)\s*/gi;
/** A closing tag left over: the engine put the opening one in the prompt, so all before it is reasoning. */
const BEFORE_CLOSE = /^[\s\S]*<\/think>\s*/i;

/** The reply without its reasoning; empty when the reply was only reasoning. */
export function withoutReasoning(reply: string): string {
  return reply.replace(THINKING, "").replace(BEFORE_CLOSE, "").trim();
}

const BOLD = /(\*\*|__)(\S(?:[\s\S]*?\S)?)\1/g;
/** One star either side of a word or phrase, never a lone star between numbers ("2 * 3"). */
const ITALIC = /\*(\S(?:[^*\n]*?\S)?)\*/g;
const CODE_FENCE = /^\s*```.*$\n?/gm;
const CODE = /`([^`\n]+)`/g;
const LINK = /\[([^\]\n]+)\]\([^)\s]+\)/g;
const HEADING = /^\s*#{1,6}\s+/gm;
const BULLET = /^\s*[*+-]\s+/gm;
/** How a list line starts in the agent's replies, the model's and the notes it quotes alike. */
export const BULLET_MARK = "• ";
const BLANK_LINES = /\n{3,}/g;
const PARAGRAPH = "\n\n";
/** The marked words themselves, the first group of each pattern above but BOLD. */
const MARKED = "$1";

/** The reply as plain text: no reasoning, and Markdown's marks taken off the words they mark. */
export function plainReply(reply: string): string {
  return withoutReasoning(reply)
    .replace(CODE_FENCE, "")
    .replace(BOLD, "$2")
    .replace(BULLET, BULLET_MARK)
    .replace(ITALIC, MARKED)
    .replace(CODE, MARKED)
    .replace(LINK, MARKED)
    .replace(HEADING, "")
    .replace(BLANK_LINES, PARAGRAPH)
    .trim();
}
