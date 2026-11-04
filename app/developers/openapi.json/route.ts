import { buildOpenApi } from "@/lib/api/openapi";

/** The API description for tools (Postman, code generators). Public documentation, not an API endpoint. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildOpenApi(), { headers: { "Cache-Control": "public, max-age=3600" } });
}
