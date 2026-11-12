import { CardPick, type Choice } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Choices, type ChoicesProps, tapChoice } from "./Choices.js";

/**
 * The readback's answer as one big Yes, with a search mark (or an arrow, for a chat addressed to one worker), and a
 * quiet "Change something", which is the No: the agent then asks what to change. The Yes keeps its one word, the name
 * the owner says or taps everywhere a question wants a yes. Any other chip (a Change for what memory filled in) stays
 * a chip under them.
 */
export function ReadbackActions({ addressed, ...props }: ChoicesProps & { addressed: boolean }) {
  const { t } = useI18n();
  const { chat, choices, onTap } = props;
  const yes = choices.find((c) => c.value === CardPick.yes);
  const no = choices.find((c) => c.value === CardPick.no);
  if (!yes || !no) return <Choices {...props} />;
  const rest = choices.filter((c) => c !== yes && c !== no);
  const tap = (c: Choice, label: string) => tapChoice(chat, c, label, onTap);
  return (
    <>
      <div className="readback-actions">
        <button type={C.button} className={`${C.wide} btn-big`} onClick={() => tap(yes, t(yes.key))}>
          <Icon name={addressed ? "arrow" : "search"} />
          {t(yes.key)}
        </button>
        <button type={C.button} className="btn quiet wide" onClick={() => tap(no, t("need.change"))}>
          {t("need.change")}
        </button>
      </div>
      <Choices {...props} choices={rest} />
    </>
  );
}
