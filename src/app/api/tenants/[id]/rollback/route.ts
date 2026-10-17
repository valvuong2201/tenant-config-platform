import { ValidationFailedError } from "@/core/service";
import { getService } from "@/server/container";
import { readJson, respond } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return respond(() => {
    if (typeof body.version !== "number" || !Number.isInteger(body.version)) {
      throw new ValidationFailedError([{ path: "version", message: "version must be an integer" }]);
    }
    return getService().rollback(id, body.version, typeof body.expectedVersion === "number" ? body.expectedVersion : undefined);
  });
}
