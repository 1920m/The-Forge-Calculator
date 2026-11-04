import { getCatalogueEndpoint } from "@/lib/api/endpoints";
import { liveDeps } from "@/lib/api/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export function GET(req: Request) {
  return getCatalogueEndpoint(req, liveDeps);
}
