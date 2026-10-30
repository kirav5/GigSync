/** A line that says how a step of the move went, read out by screen readers as it changes. */
export function StatusLine({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className} role="status">
      {text}
    </p>
  );
}
