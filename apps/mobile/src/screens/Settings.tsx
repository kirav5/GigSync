import type { Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { savePayee } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";
import { Look, savedLook, saveLook } from "../ui/look.js";

const LOOKS: readonly { look: Look; label: string }[] = [
  { look: Look.auto, label: "Auto" },
  { look: Look.light, label: "Light" },
  { look: Look.dark, label: "Dark" },
];

/** Their UPI ID (kept only on this phone) and how the app looks. */
export function Settings({ ports, data, changed }: { ports: Ports; data: GigData; changed: () => Promise<void> }) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [look, setLook] = useState<Look>(savedLook());

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    try {
      await savePayee(ports.storage, { vpa: String(values.get("vpa") ?? ""), name: String(values.get("name") ?? "") });
      setError(undefined);
      setSaved(true);
      await changed();
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Settings</span>
        <h1 className={C.headline}>
          Yours to set. <span className={C.soft}>Kept on this phone.</span>
        </h1>
      </div>

      <form className={C.card} onSubmit={(e) => void onSave(e)}>
        <span className={C.label}>Get paid to</span>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Your UPI ID</span>
          <input
            className={C.field}
            name="vpa"
            placeholder="name@bank"
            defaultValue={data.payee?.vpa}
            autoComplete={C.off}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Your name, as customers see it</span>
          <input className={C.field} name="name" placeholder="Your name" defaultValue={data.payee?.name} />
        </label>
        {error && <p className={C.error}>{error}</p>}
        {saved && <span className="label fresh">Saved on this phone</span>}
        <div>
          <button type="submit" className={C.btn}>
            Save
          </button>
        </div>
        <span className={C.faint}>
          Shown only inside your payment QR, or sent locked to a customer you are working with. Never stored on a
          server.
        </span>
      </form>

      <div className={C.card}>
        <span className={C.label}>Look</span>
        <div className={C.row}>
          {LOOKS.map((l) => (
            <button
              key={l.look}
              type={C.button}
              aria-pressed={look === l.look}
              className={look === l.look ? "chip on" : "chip"}
              onClick={() => {
                saveLook(l.look);
                setLook(l.look);
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
