import { countIn } from "@gigsync/core";
import { DetailFlag, type Lang, SKIPPED } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { Said } from "../ui/Said.js";

/** A bare count, in any script's digits: shown in shared digits rather than translated. */
const NUMBER_ONLY = /^[0-9०-९೦-೯]+$/;

/**
 * One detail the household gave (an answer to the worker's agent): yes, no and skipped as words in the reader's
 * language, a bare number in shared digits, anything else as the other side wrote it, translated on this phone.
 */
export function DetailValue({ value, from }: { value: string; from: Lang | undefined }) {
  const { t } = useI18n();
  const flag = DetailFlag.safeParse(value);
  if (flag.success) return <>{t(`flag.${flag.data}`)}</>;
  if (value === SKIPPED) return <>{t("ask.skipped")}</>;
  if (NUMBER_ONLY.test(value)) return <>{String(countIn(value))}</>;
  return <Said text={value} from={from} />;
}
