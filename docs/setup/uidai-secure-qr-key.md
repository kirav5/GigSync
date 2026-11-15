# Turning on "Get verified": UIDAI's Secure QR key

**Status (15 Nov 2026): done.** UIDAI's five offline certificates are in `docs/setup/uidai-certs/` and their keys in
`packages/core/src/identity/uidai-key.ts`. Repeat the steps below only when UIDAI publishes a new certificate (the
newest is valid to 3 Feb 2029): add its key at the top of the list and keep the old ones.

"Get verified" scans the big QR code printed on every Aadhaar card and e-Aadhaar PDF, and checks UIDAI's digital
signature on it **on the phone**. It needs UIDAI's public key to check that signature. Until the key is in the app,
the screen says "This version of GigSync cannot check IDs yet" and offers no scan. It costs nothing: no partner, no
API calls, no per-check fee.

## What is kept, and where

- Kept, on the phone only, for the owner who checked: the name on the card, the year of birth, the gender, the last
  4 digits of the Aadhaar number, when it was checked, and how its mobile was bound (`signed_in` or
  `second_number`, never the number) (`apps/mobile/src/adapters/idcheck.ts`).
- Never kept, sent or logged: the full Aadhaar number, the address, the photo, the email hash. The mobile hash (or
  a V2 card's last 4 mobile digits) is read only into memory for the binding check below and dropped after it
  (`packages/core/src/identity/mobile-binding.ts`).
- The name on the card must share a word with the name the person gave GigSync, or the check is refused.

## 1. Download the certificates from UIDAI

A card is signed with the key UIDAI used the day it was printed, so the app keeps every published offline key and
tries each. Download them in your browser (UIDAI's file server often refuses scripted downloads):
1. Open <https://uidai.gov.in/en/data-and-download> and go to **UIDAI Certificates Details**.
2. Click each of these; they save to `~/Downloads` under the same names:
   - `uidai_offline_publickey_2026.cer` (the newest, valid to 3 Feb 2029)
   - `uidai_offline_publickey_17022026.cer`
   - `uidai_offline_publickey_26022021.cer`
   - `uidai_offline_publickey_29032019.cer`
   - `uidai_offline_publickey_26022019.cer`
3. Do **not** use `okyc-publickey.cer` from the Paperless Offline e-KYC page: in November 2026 that file was an
   expired test certificate (issued to "hcl-aua"), not UIDAI's signing key.
4. Check each one before trusting it (here the newest):

   ```bash
   openssl x509 -inform DER -in ~/Downloads/uidai_offline_publickey_2026.cer -noout -subject -issuer -dates -fingerprint -sha256
   ```

   The subject or issuer should name UIDAI (Unique Identification Authority of India). If openssl cannot read it,
   the file is text: use `-inform PEM` instead of `-inform DER`.

## 2. Turn each into the key the app needs

```bash
for f in ~/Downloads/uidai_offline_publickey_*.cer; do
  printf '%s\n' "$(basename "$f")"
  openssl x509 -inform DER -in "$f" -pubkey -noout | openssl pkey -pubin -outform DER | base64 | tr -d '\n'
  printf '\n\n'
done
```

Each file prints its name and one long line of base64: that certificate's public key (SPKI, DER).

## 3. Put them in the app

In `packages/core/src/identity/uidai-key.ts`, fill `UIDAI_SECURE_QR_KEYS`, newest first, one entry per certificate:

```ts
export const UIDAI_SECURE_QR_KEYS = [
  { certificate: "uidai_offline_publickey_2026.cer", spki: "MIIBIjANBgkq…" },
  { certificate: "uidai_offline_publickey_17022026.cer", spki: "MIIBIjANBgkq…" },
  // …the 2021 and 2019 ones
] as const;
```

Note in the comment above it the date you downloaded them and each SHA-256 fingerprint from step 1. Then:

```bash
pnpm --filter @gigsync/core build
pnpm --filter @gigsync/core test
```

Or send the `.cer` files to Claude Code in this project and it will do steps 1 to 3.

The test that expects "no key" skips itself once the key is there.

## 4. Try it with a real card

1. Run the app (`pnpm dev:app`) and sign in as someone who finds work.
2. Open the profile (your initial, top right) → **Get verified** → **Scan my Aadhaar**, and scan the big QR on your
   own Aadhaar card, or on the first page of an e-Aadhaar PDF opened on another screen.
3. You should see "You're verified" with your name, year of birth and "•••• 1234" (your last 4 digits).
4. If it says the signature does not match: the key is wrong, or the QR is the old (pre-2019) unsigned kind; a card
   printed recently, or a freshly downloaded e-Aadhaar, has the signed one.

## The second way: Aadhaar Paperless Offline e-KYC (OTP)

For someone without their card to hand, **Get verified → Use Aadhaar e-KYC file (OTP)** takes the ZIP UIDAI gives
at <https://myaadhaar.uidai.gov.in/offline-ekyc>: they enter their Aadhaar number and the OTP sent to their
Aadhaar mobile, set a share code, and download `offlineaadhaar<timestamp>.zip`. In GigSync they pick the ZIP and type
the share code; the phone opens it (`packages/core/src/identity/ekyc-zip.ts`: ZipCrypto or WinZip AES, both handled),
checks UIDAI's enveloped XML signature (`xml-dsig.ts`, Canonical XML 1.0 in `c14n.ts`, RSA with SHA-1 or SHA-256)
against the same five keys above, and keeps the same few fields as the QR. The share code, the XML, the address, the
photo, the mobile/email hashes and all but the first 4 digits of the reference id are never kept, sent or logged.
Free: no partner and no API call.

Format, from UIDAI's page <https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc> (read 16 Nov 2026): root
`OfflinePaperlessKyc` with `referenceId` (last 4 digits + `YYYYMMDDHHMMSSmmm`), `UidData` → `Poi` (name, dob,
gender, e, m), `Poa`, `Pht`, then `Signature` (C14N 20010315, RSA-SHA1, SHA-256 digest, enveloped-signature). UIDAI
calls the password a "Share Phrase" there and shows an 8-character example, so the app takes any length up to 64.
Again, not `okyc-publickey.cer`: the page links it, but it is the expired "hcl-aua" test certificate.

**Try it with your own file:** download your ZIP from myAadhaar, copy it to the phone (or the computer running
`pnpm dev:app`), open Get verified → Use Aadhaar e-KYC file (OTP), pick the ZIP, type your share code, Check. You
should see "Is this your own Aadhaar?" with your name. If it says the signature does not match, UIDAI signed it with a
key not in the list: download the newest certificate from the Data and Downloads page (step 1) and add it. Do not
commit your ZIP anywhere: it holds your address and photo.

## The third way: the e-Aadhaar PDF

**Get verified → Choose e-Aadhaar PDF** takes the PDF from <https://myaadhaar.uidai.gov.in> → Download Aadhaar (an
OTP to the Aadhaar mobile). Its password is the first 4 letters of the name in capitals and the birth year
(`ATIS1999`). pdf.js (`pdfjs-dist`, loaded only on this sheet, `apps/mobile/src/adapters/aadhaarPdf.ts`) opens it,
draws page 1 at 4x and the photo reader finds the big Secure QR, which then goes through the same check as a scan. The
PDF and the password stay in memory for the read. pdf.js is about 400 KB plus a 1 MB worker; the service worker leaves
both out of its precache and keeps them after their first use, so the PDF route works offline once it has been opened.

## Where people get these

The intro's "Where do I get these?" says it in one line each: a printed or PVC card → scan its big QR; e-Aadhaar PDF →
myAadhaar → Download Aadhaar (OTP) → Choose e-Aadhaar PDF; Offline e-KYC ZIP → myAadhaar after login → Offline eKYC
(where shown) or the mAadhaar app → set a share code → Use Aadhaar e-KYC file.

## Binding to the person

A genuine Aadhaar only proves the document; the binding proves the person holding the phone owns it: the mobile linked
to the Aadhaar must be one they hold. UIDAI's rules (`packages/core/src/identity/mobile-binding.ts`, tests in
`packages/core/test/mobile-binding.test.ts`):
- **Offline e-KYC**, `Poi` attribute `m`: hex SHA-256 over the 10-digit mobile (no +91) followed by the share code,
  repeated as many times as the last digit of the Aadhaar number (the 4th character of `referenceId`); 0 or 1 hashes
  once. Each round hashes the lowercase hex text of the round before. UIDAI's own example on
  <https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc>: mobile 1234567890, phrase Lock@487, Aadhaar ending 2 →
  `Sha256(Sha256(1234567890Lock@487))`, which is `f7250dc9…f3421a8f` (UIDAI prints no output; computed independently
  with Python and Node). An empty `m` means no mobile is linked.
- **Secure QR, older layout**: the same chain over the mobile alone, stored as 32 raw bytes, the last thing before the
  signature, when the first field (email/mobile indicator) is 2 or 3; 0 or 1 means no mobile.
- **Secure QR, versioned layout (V2 and later)**: no hash, the mobile's last 4 digits as the last text field.

The flow after a genuine document:
1. The signed-in number (already proven by GigSync's SMS code) matches the hash, or a V2 card's last 4 → "Is this your
   own Aadhaar?" → verified (`boundBy: signed_in`).
2. It does not match → "This Aadhaar is linked to another mobile number." → the person types it; the phone checks it
   against the hash or last 4. A number that fits gets GigSync's own SMS code (`POST /v1/phone/confirm/request`, then
   `POST /v1/phone/confirm` with the dev code or a Firebase ID token for that number: it never signs in or changes the
   session, and the API keeps nothing about the number) → "Is this your own Aadhaar?" → verified
   (`boundBy: second_number`). A number that does not fit says so; 3 a day, then it stops until tomorrow.
3. No mobile linked → "Link one at an Aadhaar centre, then check again." No badge.

A check kept before binding existed (no `boundBy`) shows no badge until the person checks again.

## What "verified" means today, and what it does not

The check proves to **this phone** that the card is genuine and that its mobile is one the person holds. It does not yet prove anything to
households: the badge shows on the person's own card and profile on their phone. Showing it to households needs a
decision, because their phones cannot re-check it without the Aadhaar data, and GigSync promises never to put that on
its servers. Two ways forward, for later:
- **Show it, marked as checked on the person's phone.** Simple; honest about what it proves; a modified app could fake
  it.
- **DigiLocker through a partner (Setu, Cashfree and others, about ₹4–10 a check).** The partner verifies and tells
  GigSync only "verified" and the name, so the badge can be trusted by households. It needs a company account.
