import type { Ports } from "@gigsync/core";
import type { City, Trade } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { ListCard, ListRow, RowTone } from "../../ui/ListRow.js";
import { useGoingRates } from "./useGoingRates.js";

interface Props {
  ports: Ports;
  account: Account;
  /** The city picked, when it has a guide; undefined for any other (or none picked yet). */
  city: City | undefined;
  /** A city was picked, with or without a guide. */
  picked: boolean;
  trade: Trade | undefined;
}

/**
 * "What comes with you" (design W18), each a fact and none a promise: the record GigSync keeps with the worker's number
 * (ADR 0036/0038), the going rate there as Talk's outlook gives it, someone who knows the city (a mentor, for a city
 * with a guide), and the registrations the guide lists, or e-Shram anywhere. The design's "not guesses" and "a mentor
 * from your union" are left out: the band is a guess when there is no estimate, and no mentor is a union's.
 */
export function ComesWithYou({ ports, account, city, picked, trade }: Props) {
  const { t, plural } = useI18n();
  const jobs = useOwnCard(ports, account).card?.record?.jobs;
  const rates = useGoingRates(account, city, trade);
  const rateLine = rates?.line ?? t(picked && !city ? "me.move_rates_none" : "me.move_rates_pick");
  return (
    <>
      <ListCard label={t("me.move_comes")}>
        <ListRow
          icon="doc"
          tone={RowTone.green}
          title={t("me.move_record")}
          sub={jobs === undefined ? t("me.move_record_sub") : plural("me.move_record_jobs", jobs)}
        />
        <ListRow icon="rupee" tone={RowTone.green} title={t("me.move_rates")} sub={rateLine} />
        {city && (
          <ListRow icon="people" tone={RowTone.green} title={t("me.move_mentor")} sub={t("me.move_mentor_sub")} />
        )}
        <ListRow
          icon="shield"
          tone={RowTone.green}
          title={t("me.move_reg")}
          sub={t(city ? "me.move_reg_guide" : "me.move_reg_any")}
        />
      </ListCard>
      {rates && <p className="fine">{rates.note}</p>}
    </>
  );
}
