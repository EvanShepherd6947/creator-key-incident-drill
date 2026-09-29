import { z } from "zod";
import type { InfraiApi } from "./infrai_client.ts";

export const drillInputSchema = z.object({
  compromisedKeyId: z.string().min(1),
  suspectedSince: z.string().datetime({ offset: true }),
  incidentId: z.string().min(3).regex(/^[A-Za-z0-9_-]+$/),
});

export type DrillInput = z.infer<typeof drillInputSchema>;
export type CreatorSurface = "digital-asset delivery" | "subscriber updates" | "content processing";

export type DrillResult = {
  status: "confirmed";
  affectedSurfaces: CreatorSurface[];
  searchedQueries: string[];
  temporaryKeyId: string;
};

const searches: ReadonlyArray<{ query: string; surface: CreatorSurface }> = [
  { query: "signed download", surface: "digital-asset delivery" },
  { query: "subscriber update", surface: "subscriber updates" },
  { query: "content processing", surface: "content processing" },
];

function hasMatches(result: unknown): boolean {
  if (Array.isArray(result)) return result.length > 0;
  if (typeof result !== "object" || result === null) return false;
  const record = result as Record<string, unknown>;
  for (const key of ["items", "results", "logs"]) {
    if (Array.isArray(record[key]) && record[key].length > 0) return true;
  }
  return false;
}

export async function runLeakedKeyDrill(
  rawInput: unknown,
  infrai: InfraiApi,
): Promise<DrillResult> {
  const input = drillInputSchema.parse(rawInput);
  await infrai.reportSuspectedCompromise(input.compromisedKeyId);

  const logResults = await Promise.all(
    searches.map(async ({ query, surface }) => ({
      query,
      surface,
      result: await infrai.searchLogs(query, input.suspectedSince),
    })),
  );
  const affectedSurfaces = logResults
    .filter(({ result }) => hasMatches(result))
    .map(({ surface }) => surface);

  const temporary = await infrai.createTemporaryKey(`${input.incidentId}-create`);
  if (!temporary.key_id) throw new Error("Key creation response did not include a key_id");
  await infrai.rotateTemporaryKey(temporary.key_id, `${input.incidentId}-rotate`);
  await infrai.revokeTemporaryKey(temporary.key_id);

  return {
    status: "confirmed",
    affectedSurfaces,
    searchedQueries: searches.map(({ query }) => query),
    temporaryKeyId: temporary.key_id,
  };
}
