import { getService } from "@/server/container";
import { readJson, respond } from "@/server/http";

export const GET = () => respond(() => getService().list());

export async function POST(request: Request) {
  const body = await readJson(request);
  return respond(
    () =>
      getService().create({
        id: typeof body.id === "string" ? body.id : undefined,
        config: body.config,
        note: typeof body.note === "string" ? body.note : undefined,
      }),
    201,
  );
}
