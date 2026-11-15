import {
  type DeviceRegistration,
  type PhoneConfirm,
  PhoneConfirmed,
  type PhoneTokenVerify,
  Session,
} from "@gigsync/protocol";
import { HttpMethod } from "../http.js";
import { ApiClient, ApiPath } from "./api.js";

/** ApiClient with the sign-in a phone makes when Firebase sent and checked its SMS code. */
export class PhoneSignInClient extends ApiClient {
  /** Signs in with the ID token Firebase gave for the confirmed number, registering this device's keys. */
  async verifyPhoneToken(idToken: string, device: DeviceRegistration): Promise<Session> {
    const body: PhoneTokenVerify = { id_token: idToken, device };
    return Session.parse(await this.call(HttpMethod.post, ApiPath.phoneVerify, body));
  }

  /** Asks for the dev code to a second number, as the signed-in person; it never signs in with it. */
  async requestConfirmCode(phone: string): Promise<void> {
    await this.call(HttpMethod.post, ApiPath.phoneConfirmRequest, { phone });
  }

  /** Proves the signed-in person holds a second number, by its code or Firebase's ID token; the session stays. */
  async confirmPhone(proof: PhoneConfirm): Promise<PhoneConfirmed> {
    return PhoneConfirmed.parse(await this.call(HttpMethod.post, ApiPath.phoneConfirm, proof));
  }
}
