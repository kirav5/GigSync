import type { Ports } from "@gigsync/core";
import { PAYEE_NAME_MAX } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { savePayee } from "../payments/store.js";
import type { GigData } from "../state.js";
import { C } from "../ui/cls.js";
import { Look, savedLook, saveLook } from "../ui/look.js";
import { ModelSettings } from "./ModelSettings.js";

const LOOKS: readonly { look: Look; label: string }[] = [
  { look: Look.auto, label: "Auto" },
  { look: Look.light, label: "Light" },
  { look: Look.dark, label: "Dark" },
];
/** UPI IDs are typed as-is: no capitals or corrections added by the phone keyboard. */
const NO_CAPS = "none";

/** The worker's UPI ID and name (kept only on this device) and how the app looks. */
export function Settings({ ports, data, changed }: { ports: Ports; data: GigData; changed: () => Promise<void> }) {
  const [vpa, setVpa] = useState(data.payee?.vpa ?? "");
  const [name, setName] = useState(data.payee?.name ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [look, setLook] = useState<Look>(savedLook());

  // Fill the fields when the saved details arrive (the screen can open before they have loaded).
  useEffect(() => {
    setVpa(data.payee?.vpa ?? "");
    setName(data.payee?.name ?? "");
  }, [data.payee?.vpa, data.payee?.name]);

  function edit(set: (v: string) => void, value: string) {
    set(value);
    setSaved(false);
    setError(undefined);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await savePayee(ports.storage, { vpa, name });
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
          Yours to set. <span className={C.soft}>Kept on this device.</span>
        </h1>
      </div>

      <form className={C.card} onSubmit={(e) => void onSave(e)} noValidate>
        <span className={C.label}>Get paid to</span>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Your UPI ID</span>
          <input
            className={C.field}
            name="vpa"
            inputMode="email"
            placeholder="name@bank"
            value={vpa}
            onChange={(e) => edit(setVpa, e.target.value)}
            autoComplete={C.off}
            autoCapitalize={NO_CAPS}
            autoCorrect={C.off}
            spellCheck={false}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Your name, as customers see it</span>
          <input
            className={C.field}
            name="name"
            placeholder="Your name"
            maxLength={PAYEE_NAME_MAX}
            value={name}
            onChange={(e) => edit(setName, e.target.value)}
          />
        </label>
        {error && <p className={C.error}>{error}</p>}
        {saved && <span className="label fresh">Saved on this device</span>}
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

      <ModelSettings ports={ports} />

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
