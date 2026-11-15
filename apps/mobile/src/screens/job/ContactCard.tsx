import { bothSigned, type JobRecord, SETTLE_CAP_DAYS } from "@gigsync/core";
import { PROBLEM_HOLD_DAYS } from "@gigsync/protocol";
import { directionsTo } from "../../adapters/map.js";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { PlaceMap } from "../../ui/PlaceMap.js";
import { J, shortHash } from "./look.js";

/** The phone's own dialler and messages app, for the number both signatures released. */
const TEL = "tel:";
const SMS = "sms:";
const NEW_TAB = "_blank";
const NO_OPENER = "noopener noreferrer";

/**
 * The other side's contact, released only once both signed (ADR 0039): name, number, the door and the way there when
 * the household gave them (a worker's own address is never sent), and Call, Message and Directions. It goes once the
 * job is settled, or later while a reported problem holds it. `primary` makes Call the screen's one rust button, for
 * the side that has no step of its own to take.
 */
export function ContactCard({ job, primary }: { job: JobRecord; primary: boolean }) {
  const { t } = useI18n();
  const contact = job.contact;
  if (!contact) return null;
  const hash = bothSigned(job) ? shortHash(job.mine.terms_hash) : undefined;
  const door = contact.point ?? contact.address;
  return (
    <fieldset className={`contact ${C.card}`} aria-label={t("a11y.contact")}>
      {hash && (
        <span>
          <Badge icon="tick" tone={BadgeTone.checked}>
            {t("jobcard.both_signed", { hash })}
          </Badge>
        </span>
      )}
      <div className="job-head">
        <Avatar name={contact.name} size={AvatarSize.lg} tone={AvatarTone.rust} />
        <div className={J.who}>
          <strong className={J.name}>{contact.name}</strong>
          <span className={C.muted}>
            {contact.phone} · {t("job.contact")}
          </span>
        </div>
      </div>
      {contact.address && <span>{contact.address}</span>}
      {/* The door, until the job settles: the pin and the way there go with the rest of the card (ADR 0039 §3). */}
      {contact.point && <PlaceMap at={contact.point} label={t("map.of", { place: contact.address ?? "" })} />}
      <div className="contact-actions">
        <a className={primary ? C.accent : C.secondary} href={TEL + contact.phone}>
          <Icon name="call" />
          {t("jobcard.call")}
        </a>
        <a className={C.secondary} href={SMS + contact.phone}>
          <Icon name="chat" />
          {t("jobcard.message")}
        </a>
        {door && (
          <a className={C.secondary} href={directionsTo(door)} target={NEW_TAB} rel={NO_OPENER}>
            <Icon name="map" />
            {t("map.directions")}
          </a>
        )}
      </div>
      <p className={J.fine}>{t("jobcard.contact_leaves", { days: SETTLE_CAP_DAYS, hold: PROBLEM_HOLD_DAYS })}</p>
    </fieldset>
  );
}
