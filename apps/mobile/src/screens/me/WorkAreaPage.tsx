import { log, nearestPilotArea, type Ports } from "@gigsync/core";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { accountDraft, DEFAULT_RADIUS_KM, publishCard } from "../../card/publish.js";
import { type I18n, useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { AreaField, type WorkArea } from "../card/AreaField.js";

/**
 * The name of the place a worker's card says they work from, on the board or off it: the place they found, else the
 * pilot area in their language; none before there is a card.
 */
export function workAreaName(account: Account, t: I18n["t"]): string | undefined {
  const rules = account.worker;
  if (!rules) return undefined;
  const pilot = nearestPilotArea(rules.base);
  return rules.base_name ?? (pilot && t(`area.${pilot.key}`));
}

/**
 * A worker's work area on a page of its own, from the profile (it was only deep in My card's form): the place they
 * work from, found by their location, a place search or the list of areas, moved on its map, and how far they go, as
 * the circle and slider. Saving puts the card on the board again with it; the rest of the card stays as it was.
 */
export function WorkAreaPage({
  ports,
  account,
  onSaved,
  onCard,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
  /** Opens My card, to make one first. */
  onCard: () => void;
}) {
  const { t, lang } = useI18n();
  const draft = accountDraft(account);
  const [where, setWhere] = useState<WorkArea>({
    area: draft.area,
    place: draft.place,
    radius_km: draft.radius_km ?? DEFAULT_RADIUS_KM,
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  if (!account.worker)
    return (
      <div className={C.card}>
        <p>{t("me.work_area_no_card")}</p>
        <button type={C.button} className={C.accent} onClick={onCard}>
          {t("nav.card")}
        </button>
      </div>
    );

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      // The card as it is, with this area in place of the old one (a pilot area from the list has no place).
      const { area: _area, place: _place, ...card } = draft;
      const next = {
        ...card,
        ...(where.area ? { area: where.area } : {}),
        ...(where.place ? { place: where.place } : {}),
        radius_km: where.radius_km,
      };
      const saved = await publishCard(ports, account, next, lang);
      setError(undefined);
      setStatus(t("me.work_area_saved", { area: workAreaName(saved, t) ?? "", km: where.radius_km }));
      onSaved(saved);
    } catch (err) {
      log.warn("work area not saved", { error: err instanceof Error ? err.name : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={C.card}>
        <AreaField session={account.session} value={where} onChange={setWhere} />
      </div>
      <Dock>
        <p role="status" aria-live="polite" className={error ? C.dockError : C.dockStatus}>
          {error ?? status}
        </p>
        <button type={C.button} className={C.wide} disabled={busy} aria-busy={busy} onClick={() => void save()}>
          {t("me.work_area_save")}
        </button>
      </Dock>
    </>
  );
}
