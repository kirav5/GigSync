import { FORGET_ALL, forgetMemory, listMemory, log, type MemoryItem, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AnswerSetting } from "./AnswerSetting.js";
import { MemoryRow } from "./MemoryRow.js";
import { memoryOwner } from "./owner.js";
import "../jobs.css";
import "./memory.css";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Profile's "What my agent remembers": whether the agent asks before using what it remembers, then, folded away so a
 * long history never fills Profile, every fact, place, person and question it kept from past signed jobs, each with
 * Forget, and Forget everything. It is all on this phone.
 */
export function MemorySection({ ports, account }: { ports: Ports; account: Account }) {
  const { t, plural } = useI18n();
  const [items, setItems] = useState<MemoryItem[]>();
  const owner = useMemo(() => memoryOwner(ports, account), [ports, account]);

  const reload = useCallback(() => {
    listMemory(owner)
      .then(setItems)
      .catch((err: unknown) => log.warn("loading memory failed", failure(err)));
  }, [owner]);

  useEffect(reload, [reload]);

  function forget(key: string) {
    forgetMemory(owner, key)
      .then(reload)
      .catch((err: unknown) => log.warn("forgetting failed", failure(err)));
  }

  const title = t("memory.title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("memory.about")}</span>
      <AnswerSetting owner={owner} />
      {items?.length === 0 && <span className={C.empty}>{t("memory.empty")}</span>}
      {items && items.length > 0 && (
        <details className="job-fold memory-fold">
          <summary>{plural("memory.show", items.length)}</summary>
          <div className="stack">
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
          </div>
        </details>
      )}
    </section>
  );
}
