import { postCalculateEndpoint } from "@/lib/api/endpoints";
import { liveDeps } from "@/lib/api/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export function POST(req: Request) {
  return postCalculateEndpoint(req, liveDeps);
}
