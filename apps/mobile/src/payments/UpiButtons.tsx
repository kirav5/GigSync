import { UPI_APP_NAME, UpiApp, upiAppLink } from "@gigsync/core";
import { useState } from "react";
import { payInChooser, UpiOpen, upiOpen } from "../adapters/upi.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { K } from "./kit.js";

const UPI_APPS = Object.keys(UpiApp) as UpiApp[];
/** The words on the one button, and the name of the row of buttons. */
const OPEN_UPI = "job.open_upi";

/**
 * Where the household picks their UPI app: Android's chooser in the app; in a browser on Android, a button per common
 * app and one for any other (the phone's default); elsewhere the plain link. When the chooser fails, the plain link.
 */
export function UpiButtons({ link }: { link: string }) {
  const { t } = useI18n();
  const [way, setWay] = useState(upiOpen);
  if (way === UpiOpen.chooser) {
    const choose = async () => {
      if (!(await payInChooser(link, t("job.upi_choose")))) setWay(UpiOpen.link);
    };
    return (
      <button type={C.button} className={K.big} onClick={() => void choose()}>
        <Icon name="rupee" size={20} />
        {t(OPEN_UPI)}
      </button>
    );
  }
  if (way === UpiOpen.link) {
    return (
      <a className={K.big} href={link}>
        <Icon name="rupee" size={20} />
        {t(OPEN_UPI)}
      </a>
    );
  }
  return (
    <nav className={C.row} aria-label={t(OPEN_UPI)}>
      {UPI_APPS.map((app) => (
        <a key={app} className={C.secondaryCompact} href={upiAppLink(link, app)}>
          {UPI_APP_NAME[app]}
        </a>
      ))}
      <a className={C.secondaryCompact} href={link}>
        {t("job.upi_other")}
      </a>
    </nav>
  );
}
