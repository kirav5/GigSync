import type { EngagementId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { ReceivedOffer, SentOffer } from "./types.js";

/** Offers to work this phone received and sent, over the Storage port. Never leaves the phone. */
export class OfferStore {
  constructor(private readonly storage: Storage) {}

  received(): Promise<ReceivedOffer[]> {
    return this.storage.list<ReceivedOffer>(Collection.workOffers);
  }

  receivedOn(channel: EngagementId): Promise<ReceivedOffer | undefined> {
    return this.storage.get<ReceivedOffer>(Collection.workOffers, channel);
  }

  saveReceived(o: ReceivedOffer): Promise<void> {
    return this.storage.put(Collection.workOffers, o.channel, o);
  }

  removeReceived(channel: EngagementId): Promise<void> {
    return this.storage.delete(Collection.workOffers, channel);
  }

  sent(): Promise<SentOffer[]> {
    return this.storage.list<SentOffer>(Collection.offersSent);
  }

  saveSent(o: SentOffer): Promise<void> {
    return this.storage.put(Collection.offersSent, o.channel, o);
  }
}
