import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import "./privacy.css";

/** One tier: its tile's icon and colour, its name, and what it holds for each side. */
interface Tier {
  icon: IconName;
  /** The tile's colour class in privacy.css: earth for what stays, rust for what is lent, green for what is shown. */
  tone: string;
  title: MessageKey;
  worker: MessageKey;
  household: MessageKey;
}

const TIERS: readonly Tier[] = [
  {
    icon: "lock",
    tone: "tier-icon earth",
    title: "me.tier.private",
    worker: "me.tier.private_worker",
    household: "me.tier.private_household",
  },
  {
    icon: "shield",
    tone: "tier-icon rust",
    title: "me.tier.protected",
    worker: "me.tier.protected_worker",
    household: "me.tier.protected_household",
  },
  {
    icon: "eye",
    tone: "tier-icon green",
    title: "me.tier.public",
    worker: "me.tier.public_worker",
    household: "me.tier.public_household",
  },
];

/**
 * Who sees what, in three tiers (design P3, collab's Private, Protected, Public), in words true for the owner's side:
 * what the agent keeps to itself, what goes to the other side for one signed job and is removed once it is settled
 * (ADR 0039 §3), and what anyone may see. No photo and no badges: GigSync has neither.
 */
export function Tiers({ isWorker }: { isWorker: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="tiers">
      {TIERS.map((tier) => (
        <li key={tier.title} className={`${C.card} tier`}>
          <div className="tier-head">
            <span className={tier.tone}>
              <Icon name={tier.icon} size={16} />
            </span>
            <h2 className={C.title}>{t(tier.title)}</h2>
          </div>
          <p className="fine">{t(isWorker ? tier.worker : tier.household)}</p>
        </li>
      ))}
    </ul>
  );
}
