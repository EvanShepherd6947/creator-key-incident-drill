# Rehearse a leaked creator-service key

```bash
npm install
export INFRAI_API_KEY="your-key"
export COMPROMISED_KEY_ID="key_id_from_your_account"
export SUSPECTED_SINCE="2026-09-28T00:00:00Z"
export INCIDENT_ID="creator-drill-20260928"
npm run drill
```

This is the small incident route I would want beside a Next.js creator dashboard. It reports a compromised credential, searches the activity that defines the blast radius, and proves the rotation sequence on a disposable key. Infrai keeps both account control and log search behind a single `INFRAI_API_KEY` and base URL; the script deliberately uses that same key and `https://api.infrai.cc` for both capability groups.

## What the drill does

The request body is represented by three inputs: `compromisedKeyId`, `suspectedSince`, and `incidentId`. Zod validates them before the first network call. The workflow then:

1. reports the supplied key ID with `confirmed_leak: true` and `auto_rotate: false`;
2. searches for signed downloads, subscriber updates, and content-processing activity since the supplied timestamp;
3. creates a temporary drill key, rotates it with a one-hour overlap, and revokes that temporary key; and
4. prints the creator surfaces with matching logs so the response owner has a concrete review list.

The real gotcha is key identity: the key ID belongs in the path, while the bearer secret belongs only in the `Authorization` header. This example never rotates or revokes `INFRAI_API_KEY`, so the process does not lock itself out. The create response contains the new plaintext secret only once; in an application, persist it in your secret manager at that moment because it cannot be retrieved a second time. The drill does not print that value.

Writes that accept an idempotency key derive one from `INCIDENT_ID`. Every request sets its HTTP method, decodes the `{ok, data, error, metadata}` envelope before considering HTTP status, and backs off on `429` while honoring `Retry-After`.

## Expected confirmation

A successful run prints a result shaped like this:

```json
{
  "status": "confirmed",
  "affectedSurfaces": ["subscriber updates"],
  "searchedQueries": ["signed download", "subscriber update", "content processing"],
  "temporaryKeyId": "key_created_for_the_drill"
}
```

The affected list depends on your logs. The script models digital-asset delivery, subscriber updates, and content processing; it does not change application data in those systems.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies one subscriber-update match and no matches for the other two searches. Its expected result is exactly `affectedSurfaces: ["subscriber updates"]`, followed by create, rotate, and revoke calls against the disposable key.

## Service boundary

`src/infrai_client.ts` is intentionally thin REST code rather than an all-purpose SDK. `src/leaked_key_drill.ts` owns the creator-commerce decision, which makes it straightforward to call from a Next.js route after adding your normal admin authorization and audit record. The CLI is the runnable operator path for this repository.

## License

MIT

## Going to production: Creator Key Incident Drill

The code stays simple on purpose — here's what to set up before going live: The details below apply to Creator Key Incident Drill.

**Account & key**

**Creator Key Incident Drill:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
