import { type GigDevice, type MessageKey, type Ports, womenOnly } from "@gigsync/core";
import { City, Lang, type MentorProfile, Trade } from "@gigsync/protocol";
import { useState } from "react";
import { type Account, personCard } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./mentor.css";
import { CheckRow } from "./CheckRow.js";
import { ChipPick } from "./ChipPick.js";
import { MentorResults } from "./MentorResults.js";
import { NoMentor } from "./NoMentor.js";
import { mentorProblem } from "./problems.js";
import { RequestList } from "./RequestList.js";
import { type RequestDraft, RequestSheet } from "./RequestSheet.js";
import { SafetyCopy } from "./SafetyCopy.js";
import { useMentors } from "./useMentors.js";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  syncedAt: Date | undefined;
}

/**
 * Find a mentor (round4-spec §2b), the landing journey's way to someone who knows the city: the safety words first,
 * the "are you a woman" question once (kept on this phone), then filters, the matched mentors to choose from (up to
 * three), the request, and the answers. An empty match offers introductions and the guide's helplines.
 */
export function FindMentor({ ports, account, device, run, syncedAt }: Props) {
  const { lang, t } = useI18n();
  const { prefs, requests, refresh } = useMentors(device, syncedAt);
  const [trade, setTrade] = useState<Trade>(account.worker?.trades[0] ?? Trade.enum.cook);
  const [speaks, setSpeaks] = useState<Lang>(lang);
  const [found, setFound] = useState<MentorProfile[]>();
  const [picked, setPicked] = useState<MentorProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();
  const [said, setSaid] = useState<{ key: MessageKey; name: string }>();
  const city = City.enum.bengaluru;
  const where = t(`mentor.city.${city}`);
  const onlyWomen = womenOnly(prefs);

  const change = (work: () => Promise<unknown>) => void work().then(refresh);
  async function search(women_only = onlyWomen) {
    setProblem(undefined);
    setPicked([]);
    try {
      setFound(await device.mentors.find({ city, trade, lang: speaks, women_only }));
    } catch (err) {
      setProblem(mentorProblem("finding mentors failed", err));
    }
  }
  async function send(draft: RequestDraft) {
    setBusy(true);
    setProblem(undefined);
    const card = personCard(account, lang);
    const ask = { city, trade, languages: card.languages, ...draft };
    let tooOld: MentorProfile[] = [];
    try {
      await run(async () => {
        ({ tooOld } = await device.mentors.request(picked, ask, card));
      });
      const old = tooOld[0];
      setSaid(old ? { key: "mentor.too_old", name: old.first_name } : { key: "mentor.sent", name: "" });
      setPicked([]);
      refresh();
    } catch (err) {
      setProblem(mentorProblem("sending landing requests failed", err));
    } finally {
      setBusy(false);
    }
  }

  const intro = (
    <div className={C.stack}>
      <h1 className={C.headline}>{t("mentor.find")}</h1>
      <span className={C.muted}>{t("mentor.find_about", { city: where })}</span>
    </div>
  );
  if (!prefs.safety_seen)
    return (
      <>
        {intro}
        <SafetyCopy onRead={() => change(() => device.mentors.safetySeen())} />
      </>
    );
  const womanChips = (
    <ChipPick
      label={t("mentor.woman_ask")}
      options={[
        { value: 1, text: t("mentor.yes") },
        { value: 0, text: t("mentor.no") },
      ]}
      chosen={prefs.woman === undefined ? [] : [prefs.woman ? 1 : 0]}
      onPick={(v) => change(() => device.mentors.answerWoman(v === 1))}
    />
  );
  if (prefs.woman === undefined)
    return (
      <>
        {intro}
        <div className={C.card}>{womanChips}</div>
      </>
    );
  return (
    <>
      {intro}
      <SafetyCopy />
      <div className={C.card}>
        <ChipPick
          label={t("mentor.trade")}
          options={Trade.options.map((tr) => ({ value: tr, text: t(`trade.${tr}`) }))}
          chosen={[trade]}
          onPick={setTrade}
        />
        <ChipPick
          label={t("mentor.lang")}
          options={Lang.options.map((l) => ({ value: l, text: t(`lang.${l}`) }))}
          chosen={[speaks]}
          onPick={setSpeaks}
        />
        <CheckRow
          checked={onlyWomen}
          onChange={(on) => {
            change(() => device.mentors.setWomenOnly(on));
            if (found) void search(on);
          }}
        >
          {t("mentor.women_only")}
        </CheckRow>
        {womanChips}
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={() => void search()}>
            {t("mentor.search")}
          </button>
        </div>
      </div>
      {found && found.length === 0 && (
        <NoMentor ports={ports} session={account.session} city={city} womenOnly={onlyWomen} device={device} run={run} />
      )}
      {found && found.length > 0 && (
        <MentorResults
          mentors={found}
          picked={picked}
          onPick={(m) =>
            setPicked((p) => (p.some((x) => x.user === m.user) ? p.filter((x) => x.user !== m.user) : [...p, m]))
          }
        />
      )}
      {picked.length > 0 && <RequestSheet count={picked.length} busy={busy} problem={problem} onSend={send} />}
      {problem && picked.length === 0 && <p className={C.error}>{t(problem, { name: "" })}</p>}
      {said && <p role="status">{t(said.key, { name: said.name })}</p>}
      <RequestList device={device} run={run} refresh={refresh} requests={requests} />
    </>
  );
}
