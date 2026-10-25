import { configureLog, LOCAL_ENVIRONMENT, LogFormat, LogLevel } from "@gigsync/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
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

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
