import {
  BoundBy,
  bindingFits,
  type CheckedId,
  checkAadhaarQr,
  type Genuine,
  idCheckAvailable,
  log,
  type MessageKey,
  MobileBinding,
  type MobileEvidence,
  type Ports,
} from "@gigsync/core";
import { useEffect, useState } from "react";
import { type Account, takeCardName } from "../../adapters/account.js";
import { readQrInPhoto } from "../../adapters/camera.js";
import { idCheckOptions, loadIdCheck, saveIdCheck } from "../../adapters/idcheck.js";
import { needsExplaining, Permission } from "../../adapters/permissions.js";
import { accountDraft, publishCard } from "../../card/publish.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { PermissionSheet } from "../../ui/PermissionSheet.js";
import { QrScanner } from "../../ui/QrScanner.js";
import { BindNumber } from "./BindNumber.js";
import { EkycSheet } from "./EkycSheet.js";
import { PdfSheet } from "./PdfSheet.js";
import { CAMERA, QR_PROBLEM } from "./problems.js";
import { ConfirmOwn, NotLinked, SEAL, TICK, TITLE, Verified } from "./VerifyStates.js";
import { WhereSheet } from "./WhereSheet.js";
import "./verify.css";

/**
 * Where the screen is: the intro (with its sheets: e-KYC file, e-Aadhaar PDF, where to get them), why the camera is
 * needed, the camera, the check, then the binding (another number, or none linked), "is this you?", or the result.
 */
const Stage = {
  intro: "intro",
  explain: "explain",
  scan: "scan",
  ekyc: "ekyc",
  pdf: "pdf",
  where: "where",
  checking: "checking",
  /** The Aadhaar's mobile is not the signed-in number: prove the one it is linked to. */
  other: "other",
  notLinked: "notLinked",
  confirm: "confirm",
  done: "done",
} as const;
type Stage = (typeof Stage)[keyof typeof Stage];

/** The intro's sheets, open over its own buttons. */
const SHEETS: ReadonlySet<Stage> = new Set([Stage.intro, Stage.ekyc, Stage.pdf, Stage.where]);
/** Any photo from the gallery or files: a screenshot of the e-Aadhaar PDF, or a photo of the card. */
const PHOTOS = "image/*";

/**
 * Get verified (Hinge-like): the person who offers work proves their Aadhaar on this phone (core/identity): the big
 * Secure QR on the card scanned or in a photo, the e-Aadhaar PDF, or the Offline e-KYC file, each checked against
 * UIDAI's signature. A genuine Aadhaar is then bound to the person: the mobile linked to it must be the number they
 * signed in with, or another they prove by GigSync's SMS code (BindNumber); with no mobile linked there is no badge.
 * Only the name, year of birth, gender, last 4 digits and how the number was bound are kept, on this phone; never the
 * Aadhaar number, address, photo or mobile. The owner confirms it is their own; then its name becomes the name everyone
 * sees (the card is published again with it) and the name they typed stays as a private nickname.
 */
export function GetVerified({
  ports,
  account,
  onAccount,
}: {
  ports: Ports;
  account: Account;
  /** The account with the Aadhaar's name, once the owner says the card is theirs. */
  onAccount: (a: Account) => void;
}) {
  const { lang, t } = useI18n();
  const [stage, setStage] = useState<Stage>(Stage.intro);
  const [checked, setChecked] = useState<CheckedId>();
  const [boundBy, setBoundBy] = useState<BoundBy>(BoundBy.signed_in);
  const [mobile, setMobile] = useState<MobileEvidence>();
  const [problem, setProblem] = useState<MessageKey>();
  const phone = account.contact.phone;

  useEffect(() => {
    void loadIdCheck(ports.storage).then((kept) => {
      if (!kept) return;
      setChecked(kept);
      setStage(Stage.done);
    });
  }, [ports]);

  async function startScan() {
    setProblem(undefined);
    const explain = await needsExplaining(Permission.camera).catch(() => false);
    setStage(explain ? Stage.explain : Stage.scan);
  }

  async function read(text: string) {
    setStage(Stage.checking);
    const result = await checkAadhaarQr(text, idCheckOptions(phone));
    if (!result.ok) return fail(QR_PROBLEM[result.problem]);
    found(result);
  }

  /** A genuine Aadhaar: on to "is this you?" when its mobile is the signed-in number, else bind it first. */
  function found(result: Genuine) {
    setChecked(result.id);
    setMobile(undefined);
    if (bindingFits(result.binding)) {
      setBoundBy(BoundBy.signed_in);
      return setStage(Stage.confirm);
    }
    if (result.binding === MobileBinding.not_linked) return setStage(Stage.notLinked);
    setMobile(result.mobile);
    setStage(Stage.other);
  }

  /** The owner says the card is theirs: the check is kept and its name becomes theirs, on the card too. */
  async function confirm(id: CheckedId) {
    await saveIdCheck(ports.storage, { ...id, boundBy });
    setMobile(undefined);
    const named = await takeCardName(ports, account, id.name);
    setStage(Stage.done);
    onAccount(named);
    if (!named.worker || named.listed === false || named === account) return;
    await publishCard(ports, named, accountDraft(named), lang)
      .then(onAccount)
      .catch((err: unknown) => log.warn("card not published with the card name", { error: String(err) }));
  }

  async function readPhoto(photo: File | undefined) {
    if (!photo) return;
    setProblem(undefined);
    setStage(Stage.checking);
    const text = await readQrInPhoto(photo).catch(() => undefined);
    if (text) return read(text);
    fail("idcheck.no_qr_in_photo");
  }

  function fail(why: MessageKey) {
    setProblem(why);
    setMobile(undefined);
    setStage(Stage.intro);
  }

  const toIntro = () => fail("idcheck.confirm_no_line");

  if (stage === Stage.confirm && checked)
    return <ConfirmOwn id={checked} onYes={() => void confirm(checked)} onNo={toIntro} />;
  if (stage === Stage.done && checked) return <Verified id={checked} onAgain={() => setStage(Stage.intro)} />;
  if (stage === Stage.notLinked) return <NotLinked onBack={() => setStage(Stage.intro)} />;
  if (stage === Stage.other && mobile)
    return (
      <BindNumber
        storage={ports.storage}
        account={account}
        mobile={mobile}
        onBound={() => {
          setBoundBy(BoundBy.second_number);
          setStage(Stage.confirm);
        }}
        onBack={() => {
          setMobile(undefined);
          setStage(Stage.intro);
        }}
      />
    );

  /** The intro at rest: its own buttons show, with or without a sheet over them. */
  const resting = SHEETS.has(stage);
  return (
    <section className={`${C.stack} verify`} aria-label={t("idcheck.title")}>
      <span className={SEAL}>
        <Icon name="shield" size={44} />
      </span>
      <h1 className={TITLE}>{t("idcheck.title")}</h1>
      <p className={C.muted}>{t("idcheck.optional")}</p>
      {!idCheckAvailable() ? (
        <p className="verify-pill" role="status">
          {t("idcheck.unavailable")}
        </p>
      ) : (
        <>
          <ol className="verify-steps">
            <li>{t("idcheck.how")}</li>
          </ol>
          <ul className="verify-keep">
            <li>
              <Icon name={TICK} size={18} />
              {t("idcheck.keep")}
            </li>
            <li data-never>
              <Icon name="close" size={18} />
              {t("idcheck.never")}
            </li>
          </ul>
          {stage === Stage.explain && (
            <PermissionSheet
              permission={Permission.camera}
              onAnswer={(go) => setStage(go ? Stage.scan : Stage.intro)}
            />
          )}
          {stage === Stage.scan && (
            <QrScanner label={t("idcheck.how")} onRead={(text) => void read(text)} onProblem={(p) => fail(CAMERA[p])} />
          )}
          {stage === Stage.checking && (
            <p className={C.muted} role="status">
              {t("idcheck.checking")}
            </p>
          )}
          {problem && (
            <p className={C.error} role="alert">
              {t(problem)}
            </p>
          )}
          {(resting || stage === Stage.checking) && (
            <button
              type={C.button}
              className={`${C.wide} btn-big`}
              disabled={stage === Stage.checking}
              aria-busy={stage === Stage.checking}
              onClick={() => void startScan()}
            >
              {t("idcheck.scan")}
            </button>
          )}
          {stage === Stage.ekyc && <EkycSheet phone={phone} onChecked={found} onClose={() => setStage(Stage.intro)} />}
          {stage === Stage.pdf && <PdfSheet onQr={(text) => void read(text)} onClose={() => setStage(Stage.intro)} />}
          {stage === Stage.where && <WhereSheet onClose={() => setStage(Stage.intro)} />}
          {resting && <IntroWays onPhoto={readPhoto} onSheet={setStage} />}
          <p className="fine">{t("idcheck.free")}</p>
        </>
      )}
    </section>
  );
}

/** The quieter ways under the scan: a photo, the e-Aadhaar PDF, the e-KYC file, and where to get them. */
function IntroWays({
  onPhoto,
  onSheet,
}: {
  onPhoto: (photo: File | undefined) => Promise<void>;
  onSheet: (sheet: Stage) => void;
}) {
  const { t } = useI18n();
  const way = `${C.secondary} verify-gallery`;
  return (
    <>
      <label className={way}>
        <Icon name="image" size={20} />
        {t("idcheck.gallery")}
        <input
          type="file"
          accept={PHOTOS}
          hidden
          onChange={(e) => {
            void onPhoto(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </label>
      <button type={C.button} className={way} onClick={() => onSheet(Stage.pdf)}>
        <Icon name="doc" size={20} />
        {t("idcheck.pdf")}
      </button>
      <button type={C.button} className={way} onClick={() => onSheet(Stage.ekyc)}>
        <Icon name="shield" size={20} />
        {t("idcheck.ekyc")}
      </button>
      <button type={C.button} className={C.linkBtn} onClick={() => onSheet(Stage.where)}>
        {t("idcheck.where")}
      </button>
    </>
  );
}
