import type { Ports } from "@gigsync/core";
import type { City, Trade } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { useGoingRates } from "./useGoingRates.js";

interface Props {
  ports: Ports;
  account: Account;
  /** The city picked, when it has a guide; undefined for any other (or none picked yet). */
  city: City | undefined;
  /** A city was picked, with or without a guide. */
  picked: boolean;
  trade: Trade | undefined;
  /** Opens Find a mentor, for someone who knows a city with a guide. */
  onFindMentor: () => void;
}

/**
 * "What you get" (design W18), each a fact and none a promise. For a city with a guide: the checklist for the first
 * days, the going rate there as Talk's outlook gives it, and someone who knows the city (a tap opens Find a mentor);
 * anywhere: the record GigSync keeps with the worker's number (ADR 0036/0038), and for a city without a guide, e-Shram,
 * which works from anywhere. The design's "not guesses" and "a mentor from your union" are left out: the band is a
 * guess when there is no estimate, and no mentor is a union's.
 */
export function ComesWithYou({ ports, account, city, picked, trade, onFindMentor }: Props) {
  const { t, plural } = useI18n();
  const jobs = useOwnCard(ports, account).card?.record?.jobs;
  const rates = useGoingRates(account, city, trade);
  const rateLine = rates?.line ?? t(picked && !city ? "me.move_rates_none" : "me.move_rates_pick");
  return (
    <>
      <ListCard label={t("me.move_comes")}>
        {city && <ListRow icon="check" title={t("moving.checklist")} sub={t("me.moving_sub")} />}
        <ListRow icon="rupee" title={t("me.move_rates")} sub={rateLine} />
        {city && (
          <ListRow
            icon="people"
            title={t("me.move_mentor")}
            sub={t("me.move_mentor_in", { city: t(`landing.city.${city}`) })}
            onClick={onFindMentor}
          />
        )}
        <ListRow
          icon="doc"
          title={t("me.move_record")}
          sub={jobs === undefined ? t("me.move_record_sub") : plural("me.move_record_jobs", jobs)}
        />
        {picked && !city && <ListRow icon="shield" title={t("me.move_reg")} sub={t("me.move_reg_any")} />}
      </ListCard>
      {rates && <p className="fine">{rates.note}</p>}
    </>
  );
}
