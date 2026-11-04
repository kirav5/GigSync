# GigSync's model on the Mac Studio: setup

How the pilot's model ([ADR 0052](../adr/0052-gigsync-model-on-a-mac-studio.md)) is wired, and the steps that are
done by hand. Until the last step, the API's model route answers 503 and every phone keeps its own model or lite mode.

```
phone ──(session)──► API Worker /v1/model/* ──(Cloudflare Tunnel + Access token)──► Mac Studio: Ollama :11434
```

## 1. The Mac Studio

1. Ollama installed and the model pulled: `ollama pull qwen3:30b-a3b-instruct-2507-q4_K_M`.
2. Ollama's settings, kept across reboots by a LaunchAgent. Save as
   `~/Library/LaunchAgents/network.gigsync.ollama-env.plist`, then `launchctl load` it and restart Ollama:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>network.gigsync.ollama-env</string>
     <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>
       launchctl setenv OLLAMA_HOST 0.0.0.0:11434;
       launchctl setenv OLLAMA_KEEP_ALIVE -1;
       launchctl setenv OLLAMA_NUM_PARALLEL 4;
       launchctl setenv OLLAMA_CONTEXT_LENGTH 4096;
       launchctl setenv OLLAMA_MAX_LOADED_MODELS 1
     </string></array>
     <key>RunAtLoad</key><true/>
   </dict></plist>
   ```

   Check with `grep "server config" ~/.ollama/logs/server.log | tail -1`.
3. System Settings › Energy: never sleep; start up after a power failure. Ollama opens at login.
4. Never forward port 11434 on the router: Ollama has no password. Only the tunnel reaches it from outside.

## 2. Cloudflare Tunnel (on the Studio)

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create gigsync-model
cloudflared tunnel route dns gigsync-model model.gigsync.network
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: gigsync-model
credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: model.gigsync.network
    service: http://localhost:11434
    originRequest:
      httpHostHeader: localhost:11434
  - service: http_status:404
```

Run it at boot: `sudo cloudflared service install`.

## 3. Cloudflare Access (Zero Trust dashboard)

1. Access › Service Auth › create a service token, `gigsync-api`. Copy its Client ID and Client Secret.
2. Access › Applications › add a self-hosted application for `model.gigsync.network`, with one policy: action
   **Service Auth**, include that service token. Nothing else may reach the tunnel.
3. Check from any computer: `curl https://model.gigsync.network/api/tags` answers 403 without the token, and with
   `-H "CF-Access-Client-Id: …" -H "CF-Access-Client-Secret: …"` lists the model.

## 4. The API Worker

1. Secrets, from `workers/api`:
   `npx wrangler secret put MODEL_ACCESS_ID` and `npx wrangler secret put MODEL_ACCESS_SECRET`.
2. Public settings, by pull request, in `wrangler.toml` `[vars]`:
   `MODEL_ORIGIN = "https://model.gigsync.network"` and `MODEL_NAME = "qwen3:30b-a3b-instruct-2507-q4_K_M"`.
   Merging deploys it, and phones start asking GigSync's model on their next sign-in or app start.
3. Check: `GET /v1/model/status` with a session answers `{"on":true}`; the Worker's logs show `model answered` lines
   with their time, never what was said.

## Locally

`workers/api/.dev.vars`: `MODEL_ORIGIN=http://<studio-ip>:11434` and `MODEL_NAME=…` (see `.dev.vars.example`), then
restart the API. The `.local` name does not always resolve inside `wrangler dev`; the IP does.

## Before the 500 owners

- A load test at about three times the expected peak (see the Studio runbook's eight-at-once check first).
- A Kannada and Hindi speaker reads a sample of the questions it asks.
- If the Studio is off, phones fall back within 4 seconds and stop asking for a minute: watch for `model unreachable`
  in the Worker's logs.
