/** The Collab mark GigSync shares: two square hooks holding each other across a gap. Yours is brand pink. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <g fill="none" strokeWidth="8">
        <path className="you" d="M42 12H12V40H42" />
        <path className="them" d="M22 24H52V52H22" />
      </g>
    </svg>
  );
}
