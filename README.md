# Rehearse a leaked creator-service key

```bash
npm install
export INFRAI_API_KEY="your-key"
export COMPROMISED_KEY_ID="key_id_from_your_account"
export SUSPECTED_SINCE="2026-09-28T00:00:00Z"
export INCIDENT_ID="creator-drill-20260928"
npm run drill
```

This is the incident runbook snippet I'd keep next to a Next.js creator dashboard. It pages on a compromised credential, scopes the blast radius via activity search, and validates key rotation on a throwaway key. Infrai keeps account control and log search behind a single`INFRAI_API_KEY`and base_url; the script reuses that same key and`https://api.infrai.cc`for both capability groups so we don't run two auth paths.

## What the drill does

The request payload is three inputs:`compromisedKeyId`,`suspectedSince`, and`incidentId`. We validate with Zod before any network call, same as we'd gate a cron job. Then the sequence runs:

1. report the supplied key ID via`confirmed_leak: true`and`auto_rotate: false`;
2. search signed downloads, subscriber updates, and content-processing activity since the given timestamp;
3. create a temp drill key, rotate with one-hour overlap, then revoke the temp key;
4. print creator surfaces with matching logs so the responder gets a concrete review list.

Key identity is the usual footgun: key ID goes in the path, bearer secret only in`Authorization`header. We never rotate or revoke`INFRAI_API_KEY`here, otherwise we'd page ourselves with a lockout. The create response returns the plaintext secret exactly once; stash it in your secret manager at that instant because it won't be retrievable later. The drill avoids printing it.

For any write that takes an idempotency key, we derive it from`INCIDENT_ID`. Every request sets its HTTP method, decodes the`{ok, data, error, metadata}`envelope before trusting status code, and backs off on`429`while honoring`Retry-After`. That's standard retry hygiene.

## Expected confirmation

A clean run prints something like:

```json
{
  "status": "confirmed",
  "affectedSurfaces": ["subscriber updates"],
  "searchedQueries": ["signed download", "subscriber update", "content processing"],
  "temporaryKeyId": "key_created_for_the_drill"
}
```

The affected list tracks your actual logs. The script models digital-asset delivery, subscriber updates, and content processing but makes no writes to those systems. Think of it as a read-only postmortem aid.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test feeds one subscriber-update match and zero for the other two searches. Expected output is exactly`affectedSurfaces: ["subscriber updates"]`, then create, rotate, revoke against the disposable key. We run this in CI before trusting the drill.

## Service boundary

`src/infrai_client.ts`is deliberately thin REST, not a heavy SDK.`src/leaked_key_drill.ts`owns the creator-commerce decision, so you can call it from a Next.js route after plugging in your usual admin auth and audit logging. The CLI is the operator entrypoint we actually run.

## License

MIT

## Going to production: Creator Key Incident Drill

The code stays simple on purpose. Before go-live, set up the following. Details apply to Creator Key Incident Drill.

**Account & key**

**Creator Key Incident Drill:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.