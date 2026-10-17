import { validateConfig } from "@/core/registry";
import { readJson, respond } from "@/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  return respond(async () => {
    const result = validateConfig(body.config);
    return result.ok ? { ok: true } : { ok: false, issues: result.issues };
  });
}
