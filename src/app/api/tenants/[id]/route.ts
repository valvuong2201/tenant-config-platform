import { getService } from "@/server/container";
import { readJson, respond } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(() => getService().get(id));
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(request);
  return respond(() =>
    getService().update(id, {
      config: body.config,
      note: typeof body.note === "string" ? body.note : undefined,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
    }),
  );
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return respond(async () => {
    await getService().remove(id);
  });
}
