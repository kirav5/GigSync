import { type CityGuide, type GuidePlace, PlaceKind } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { Sheet } from "../../ui/Sheet.js";
import { ExternalLink, GUIDE_LANG, GuideText } from "../landing/SectionView.js";
import { CallRows } from "./CallRows.js";

/** The guide's numbers as rows of one card, each a tap to call (as on the moving journey). */
export function GuideLines({ guide }: { guide: CityGuide }) {
  const { t } = useI18n();
  const lines = guide.helplines.map((h) => ({
    name: <GuideText text={h.name} original={false} />,
    said: h.name,
    number: h.number,
  }));
  return <CallRows label={t("mentor.helplines")} lines={lines} folded />;
}

/** One union in a sheet: what the sources say, and the source. */
function UnionSheet({ union, onClose }: { union: GuidePlace; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet title={union.name} line={union.area} icon="people" done={t("progress.done")} onClose={onClose}>
      <div className={C.stack}>
        <GuideText text={union.detail} />
        <ExternalLink href={union.source}>{t("landing.source")}</ExternalLink>
      </div>
    </Sheet>
  );
}

/**
 * The unions the guide lists, a row each with its area (whose office it marks not verified); a tap opens what the
 * sources say and the source. No steward, no "your union" and no call button: the guide gives no number, and GigSync is
 * no part of any union (ADR 0017 is not built).
 */
export function GuideUnions({ guide, city }: { guide: CityGuide; city: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<GuidePlace>();
  const unions = guide.places.filter((p) => p.kind === PlaceKind.enum.union);
  if (unions.length === 0) return null;
  return (
    <>
      <ListCard label={t("me.unions", { city })}>
        {unions.map((u) => (
          <ListRow
            key={u.name}
            icon="people"
            title={u.name}
            sub={<span lang={GUIDE_LANG}>{u.area}</span>}
            onClick={() => setOpen(u)}
          />
        ))}
      </ListCard>
      <p className="fine">{t("me.unions_about")}</p>
      {open && <UnionSheet union={open} onClose={() => setOpen(undefined)} />}
    </>
  );
}
