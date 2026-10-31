import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/** WebLLM's engine in its own thread, so downloading, loading and answering never freeze the screen. */
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => handler.onmessage(message);
