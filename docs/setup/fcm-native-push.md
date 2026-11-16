# Job alerts in the Android app (FCM)

The installed Android app gets its job alerts through Firebase Cloud Messaging ([ADR 0067](../adr/0067-native-android-alerts-through-fcm.md)).
The web app keeps Web Push (ADR 0043) and needs none of this. Until both halves below are done, the app's Settings
says notifications are not switched on yet, and nothing breaks.

## 1. Firebase project and the app's file

1. In the [Firebase console](https://console.firebase.google.com/), create a project (or open the existing one used
   for phone sign-in, `docs/setup/firebase-phone-sign-in.md`).
2. Add an **Android app** with the package name **`app.gigsync`**.
3. Download **`google-services.json`** and put it at `apps/mobile/android/app/google-services.json`. It is in
   `.gitignore`: never commit it. Without it the app still builds, and simply never registers for alerts.

## 2. The API's key

1. Firebase console › Project settings › **Service accounts** › **Generate new private key**. This downloads a JSON
   file with `project_id`, `client_email` and `private_key`.
2. Give it to the API as a secret, the whole file as one value:

   ```bash
   cd workers/api && npx wrangler secret put FCM_SERVICE_ACCOUNT < path/to/service-account.json
   ```

   Locally, put it on one line in `workers/api/.dev.vars` as `FCM_SERVICE_ACCOUNT='{"type":"service_account",...}'`.
   Keep the file itself out of the repository and delete the download once the secret is set.

## 3. Build and check

```bash
pnpm --filter @gigsync/mobile build && cd apps/mobile && npx cap sync android
```

Then build the APK in Android Studio. On the phone: Settings › Notifications in the app, turn it on, allow it when
Android asks (Android 13 and later), close the app, and from another phone send this worker a request. The alert says
"GigSync · Something new on your job. Open GigSync to see it."; tapping it opens the app, which syncs at once.

The API logs each send as counts only (`push wake-ups`: sent, gone, failed, skipped), never a token.

## Not covered

iPhone apps: they would need APNs through Firebase and an Apple push key. The iPhone web app on the Home Screen keeps
Web Push.
