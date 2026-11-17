# Sign-in codes by WhatsApp

How to turn on WhatsApp sign-in codes (ADR 0069). Steps 1 to 4 need no verified business and cost nothing: Meta's free
test number sends real codes to up to five phones you add yourself.

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
4. Until the business is verified, the number reaches about 250 new people a day; verification raises that.

If calls start failing after a long time, Meta may have retired the Graph API version: set `WHATSAPP_API_VERSION` (for
example `v24.0`) to a current one.
