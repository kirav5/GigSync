import { addressChoice, type Line, type Ports, selectAddress } from "@gigsync/core";
import type { SavedAddress, Session } from "@gigsync/protocol";
import { useState } from "react";
import { addressesChanged, closeAddressDesk, locateFromDesk, useAddressDesk } from "../../find/addressDesk.js";
import { useAddressBook } from "../../find/useAddressBook.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AddressForm } from "../address/AddressForm.js";

/**
 * The address turn in Find's chat (ADR 0050 §6), opened by the header or by words like "change my address": the agent
 * says what it can do, with the saved addresses to pick from, "Use my current location" and "Add a new address". A
 * place outside the cities GigSync serves is refused in the form ("not in your area yet"). A new address is the one
 * in use once saved; `added` tells the chat's need about it.
 */
export function AddressDesk({
  ports,
  session,
  added,
  said,
}: {
  ports: Ports;
  session: Session;
  added: (address: SavedAddress) => void;
  /** What the chat says once an address is in use: "Using Work: Banashankari". */
  said: (line: Line) => void;
}) {
  const { t } = useI18n();
  const desk = useAddressDesk();
  const { saved, inUse } = useAddressBook(ports.storage);
  const [adding, setAdding] = useState(false);
  if (!desk.open) return null;
  const close = () => {
    setAdding(false);
    closeAddressDesk();
  };
  const use = async (a: SavedAddress) => {
    await selectAddress(ports.storage, a.id);
    addressesChanged();
    said({ key: "addr.using", params: { label: t(`addr.label.${a.label}`), area: a.area } });
    close();
  };
  return (
    <section className="msg-agent iv-ask" aria-label={t("addr.title")}>
      <p>{t(saved.length > 0 ? "addr.desk" : "addr.desk_none")}</p>
      <div className={`${C.row} iv-choices`}>
        {saved.map((a) => {
          const choice = addressChoice(a);
          return (
            <button
              key={a.id}
              type={C.button}
              aria-pressed={a.id === inUse?.id}
              className={a.id === inUse?.id ? C.chipOn : C.chip}
              onClick={() => void use(a)}
            >
              {t("addr.chip", { label: t(`addr.label.${a.label}`), area: choice.areaName })}
            </button>
          );
        })}
        <button type={C.button} className={C.chip} onClick={locateFromDesk}>
          {t("addr.use_location")}
        </button>
        <button type={C.button} className={C.chip} onClick={() => setAdding(true)}>
          {t("addr.new")}
        </button>
        <button type={C.button} className={C.quiet} onClick={close}>
          {t("addr.done")}
        </button>
      </div>
      {(adding || desk.locate) && (
        <AddressForm
          key={desk.locate ? "locate" : "type"}
          session={session}
          storage={ports.storage}
          locateFirst={desk.locate}
          onSaved={(a) => {
            added(a);
            void use(a);
          }}
          onCancel={close}
        />
      )}
    </section>
  );
}
