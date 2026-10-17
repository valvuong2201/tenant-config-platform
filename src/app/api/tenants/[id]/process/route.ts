import { getService } from "@/server/container";
import { readJson, respond } from "@/server/http";

/** `processClaim(tenantId, claimData)` over HTTP: the body is the claim. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await readJson(request);
  return respond(() => getService().processClaim(id, claim));
}
