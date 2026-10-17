import { getService } from "@/server/container";
import { readJson, respond } from "@/server/http";

/** Processes a claim against an unsaved draft config, using the same code as the runtime. */
export async function POST(request: Request) {
  const body = await readJson(request);
  return respond(async () => getService().preview(body.config, body.claim, typeof body.tenantId === "string" ? body.tenantId : undefined));
}
