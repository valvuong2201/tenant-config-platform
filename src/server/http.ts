import { NextResponse } from "next/server";
import { ValidationFailedError } from "@/core/service";
import { AlreadyExistsError, ConflictError, NotFoundError } from "@/store/types";

/** Runs a handler and maps domain errors to HTTP responses. */
export async function respond(run: () => Promise<unknown>, successStatus = 200): Promise<NextResponse> {
  try {
    const body = await run();
    return body === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(body, { status: successStatus });
  } catch (error) {
    if (error instanceof ValidationFailedError) {
      return NextResponse.json({ error: error.message, issues: error.issues }, { status: 422 });
    }
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ConflictError || error instanceof AlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new SyntaxError("body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
