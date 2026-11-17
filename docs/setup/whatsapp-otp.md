# Sign-in codes by WhatsApp

How to turn on WhatsApp sign-in codes (ADR 0069). **Meta business verification comes first**: Meta allows the
Authentication template the code is sent in (step 3) only on a verified business, and some accounts also need a higher
messaging limit or some sending history before it unlocks. On an unverified business, even with Meta's free test number,
creating it fails with "This WhatsApp business account does not have permission to create message template". Verify
the business under the app's **WhatsApp → Step 3. Business verification**, with registration documents whose legal name
matches the business portfolio. The other steps cost nothing.

GigSync's app and test number are set up already: the app "GigSync sign-in", the GigSync business portfolio
(unverified), and the test number's phone number ID `1493646687163276`.

## 1. Create the Meta app

1. Sign in at [developers.facebook.com](https://developers.facebook.com) and register as a developer if asked.
2. **My Apps → Create App**, type **Business**, name it (e.g. "GigSync sign-in").
3. On the app's dashboard, add **WhatsApp**. Meta makes an unverified business and a WhatsApp Business Account.

## 2. Note the test number

In **WhatsApp → API Setup**:
- the **Phone number ID** of the test number (this goes in `WHATSAPP_PHONE_NUMBER_ID`, not the number itself);
- the **To** list: add up to five phones that will try signing in. The test number reaches only these.

## 3. Create the template

In **WhatsApp Manager → Message templates → Create template**:
1. Category **Authentication**, name `gigsync_otp` (this goes in `WHATSAPP_TEMPLATE`).
2. Delivery **Copy code**.
3. Language **English** (`en`). For another language, set `WHATSAPP_TEMPLATE_LANGUAGE` to its code.
4. Submit. Authentication templates are usually approved within minutes.

## 4. Make a token that does not expire

The token on API Setup lasts 24 hours. For the Worker:
1. **Business Settings → Users → System users → Add**, role Admin.
2. **Assign assets**: the app and the WhatsApp account.
3. **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`, never expiring.

## 5. Turn it on

Locally, in `workers/api/.dev.vars`:

```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TEMPLATE=gigsync_otp
```

Deployed: put the token as a secret, and the other two in `workers/api/wrangler.toml`:

```bash
cd workers/api && npx wrangler secret put WHATSAPP_TOKEN
```

Once all three are set, sign-in codes go by WhatsApp and `DEV_OTP` no longer signs in. To check, sign in from the
app with one of the phones on the To list: the code arrives in WhatsApp with a Copy code button.

## 6. Going live

1. **Add your own number** in WhatsApp Manager: one not registered on the WhatsApp app, confirmed by SMS or a call.
   Its phone number ID replaces the test one.
2. **Display name**: Meta reviews it (e.g. "GigSync").
3. **Payment method** on the WhatsApp account: each code is a paid authentication message.
4. Verification (above) also raises how many new people a number can message a day.

If calls start failing after a long time, Meta may have retired the Graph API version: set `WHATSAPP_API_VERSION` (for
example `v26.0`) to a current one.
