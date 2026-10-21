# Collab PDS (not used)

Not deployed. Public records live in each user's repository on Bluesky's PDS instead (ADR 0005), so we run no
server outside Cloudflare.

This docker-compose file is kept for the day we run our own PDS again (the original plan, ADR 0003): Bluesky's
PDS image on a small VM, blobs in R2, accounts created by the API Worker. Users could then move their repos here.
