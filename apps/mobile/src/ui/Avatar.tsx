/** The round tile's sizes: 32, 40, 56 and 80px (`.avatar.sm` and so on in styles.css). */
export const AvatarSize = { sm: "sm", md: "md", lg: "lg", xl: "xl" } as const;
export type AvatarSize = (typeof AvatarSize)[keyof typeof AvatarSize];

/** Earth with ivory (the owner, the design's default) or rust with cream (someone else, as in a job's row). */
export const AvatarTone = { earth: "earth", rust: "rust" } as const;
export type AvatarTone = (typeof AvatarTone)[keyof typeof AvatarTone];

/** The first letter of a name, as the reader would write it; nothing for a blank name. */
function initialOf(name: string | undefined): string | undefined {
  const first = name ? Array.from(name.trim())[0] : undefined;
  return first?.toLocaleUpperCase();
}

/**
 * A person as a round tile: the first letter of their name, or a warli figure (the design's kit.js warli(): a head with
 * a bun, two triangles, lines for limbs) when there is no name. GigSync keeps no photos, so this is all it draws. The
 * name is always said beside it, so the tile is hidden from readers.
 */
export function Avatar({
  name,
  size,
  tone = AvatarTone.earth,
}: {
  name?: string | undefined;
  size: AvatarSize;
  tone?: AvatarTone | undefined;
}) {
  const initial = initialOf(name);
  return (
    <span className={`avatar ${size} ${tone}`} aria-hidden="true">
      {initial ?? (
        <svg className="warli" viewBox="0 0 40 64" aria-hidden="true">
          <circle cx="20" cy="9" r="6" />
          <circle cx="27" cy="7" r="2.5" />
          <path d="M12 19h16L20 34zM20 34l-9 16h18z" />
          <path className="warli-limbs" d="M15 50l-3 12M25 50l3 12M12 20l-7 8M28 20l7 8" />
        </svg>
      )}
    </span>
  );
}
