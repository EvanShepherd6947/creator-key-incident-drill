import { InfraiClient, InfraiError } from "./infrai_client.ts";
import { runLeakedKeyDrill } from "./leaked_key_drill.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the drill");

const input = {
  compromisedKeyId: process.env.COMPROMISED_KEY_ID,
  suspectedSince: process.env.SUSPECTED_SINCE,
  incidentId: process.env.INCIDENT_ID,
};

try {
  const result = await runLeakedKeyDrill(input, new InfraiClient(apiKey));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error instanceof InfraiError) {
    console.error(JSON.stringify({ code: error.code, status: error.status, details: error.details }));
    process.exitCode = error.status >= 400 && error.status < 500 ? 2 : 1;
  } else {
    throw error;
  }
}
