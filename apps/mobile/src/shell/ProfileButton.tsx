import { useId } from "react";
import { useI18n } from "../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../ui/Avatar.js";
import { C } from "../ui/cls.js";

interface Props {
  /** The owner's name: the button shows its first letter, as no photo exists. */
  name: string;
  /** What the dot on it says, while something needs the owner (alerts, a mentor note); empty for no dot. */
  dot: string;
  onOpen: () => void;
}

/**
 * The round button at the top bar's end that opens the profile sheet: the owner's initial in terracotta on its tint,
 * with a small dot while something waits. Named by its words alone; the dot is its description.
 */
export function ProfileButton({ name, dot, onOpen }: Props) {
  const { t } = useI18n();
  const id = useId();
  return (
    <button
      type={C.button}
      className="profile-btn"
      aria-label={t("profile.open")}
      aria-describedby={dot ? id : undefined}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
      {dot && <span id={id} className="profile-dot" role="img" aria-label={dot} />}
    </button>
  );
}
