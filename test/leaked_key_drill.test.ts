import assert from "node:assert/strict";
import test from "node:test";
import type { InfraiApi } from "../src/infrai_client.ts";
import { runLeakedKeyDrill } from "../src/leaked_key_drill.ts";

test("flags only creator surfaces with matching blast-radius logs", async () => {
  const calls: string[] = [];
  const api: InfraiApi = {
    async reportSuspectedCompromise(id) {
      calls.push(`report:${id}`);
    },
    async searchLogs(query) {
      calls.push(`search:${query}`);
      return query === "subscriber update" ? { items: [{ timestamp: "2026-09-28T01:00:00Z" }] } : { items: [] };
    },
    async createTemporaryKey(idempotencyKey) {
      calls.push(`create:${idempotencyKey}`);
      return { key_id: "key_drill_42" };
    },
    async rotateTemporaryKey(id, idempotencyKey) {
      calls.push(`rotate:${id}:${idempotencyKey}`);
    },
    async revokeTemporaryKey(id) {
      calls.push(`revoke:${id}`);
    },
  };

  const result = await runLeakedKeyDrill(
    {
      compromisedKeyId: "key_reported_7",
      suspectedSince: "2026-09-28T00:00:00Z",
      incidentId: "incident_20260928",
    },
    api,
  );

  assert.deepEqual(result.affectedSurfaces, ["subscriber updates"]);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(calls.slice(-3), [
    "create:incident_20260928-create",
    "rotate:key_drill_42:incident_20260928-rotate",
    "revoke:key_drill_42",
  ]);
});
