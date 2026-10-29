import { FORGET_ALL, forgetMemory, listMemory, log, type MemoryItem, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { MemoryRow } from "./MemoryRow.js";
import { memoryOwner } from "./owner.js";
import "./memory.css";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Profile's "What my agent remembers": every fact, place, person and question the agent kept from past signed jobs,
 * each with Forget, and Forget everything. It is all on this phone; signing out wipes it.
 */
export function MemorySection({ ports, account }: { ports: Ports; account: Account }) {
  const { t } = useI18n();
  const [items, setItems] = useState<MemoryItem[]>();

  const reload = useCallback(() => {
    listMemory(memoryOwner(ports, account))
      .then(setItems)
      .catch((err: unknown) => log.warn("loading memory failed", failure(err)));
  }, [ports, account]);

  useEffect(reload, [reload]);

  function forget(key: string) {
    forgetMemory(memoryOwner(ports, account), key)
      .then(reload)
      .catch((err: unknown) => log.warn("forgetting failed", failure(err)));
  }

  const title = t("memory.title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("memory.about")}</span>
      {items?.length === 0 && <span className={C.empty}>{t("memory.empty")}</span>}
      {items && items.length > 0 && (
        <>
          <ul className="memory-rows">
            {items.map((item) => (
              <MemoryRow key={item.key} item={item} onForget={forget} />
            ))}
          </ul>
          <div>
            <button type={C.button} className={C.secondary} onClick={() => forget(FORGET_ALL)}>
              {t("memory.forget_all")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
