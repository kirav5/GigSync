import { configureLog, LOCAL_ENVIRONMENT, LogFormat, LogLevel } from "@gigsync/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { registerServiceWorker, watchInstall } from "./adapters/install.js";
import { keepFocusedFieldVisible } from "./adapters/keyboard.js";
import { openedCode } from "./adapters/links.js";
import "./styles.css";
import { applyLook, watchDeviceLook } from "./ui/look.js";

const RELEASE_ENVIRONMENT = "production";

// Dev builds log everything to the browser console, private data included. Release builds keep only warnings and
// errors, with private data redacted, and those stay on the phone.
configureLog(
  import.meta.env.DEV
    ? { ENVIRONMENT: LOCAL_ENVIRONMENT, LOG_LEVEL: LogLevel.debug, LOG_PII: true, format: LogFormat.pretty }
    : { ENVIRONMENT: RELEASE_ENVIRONMENT, LOG_LEVEL: LogLevel.warn, format: LogFormat.pretty },
);

applyLook();
watchDeviceLook();
keepFocusedFieldVisible();
// Before the first render: Chrome can offer its install prompt as soon as the page loads.
watchInstall();
registerServiceWorker();
// A QR link the camera opened (`?to=`) leaves the address at once and waits, kept, for whoever signs in.
openedCode();

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
