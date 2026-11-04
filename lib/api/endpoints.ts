/** The two public endpoints, independent of Next.js so tests can call them with a fake key store. */
import type { Catalogue } from "@/lib/engine/forge";
import { ApiError } from "./errors";
import { handle, readJson, type Deps } from "./http";
import { CalculateRequest, CatalogueQuery, issues } from "./schema";
import { buildCatalogue } from "./catalogue";
import { calculate } from "./calculate";
import { sha256 } from "./auth";
import { API_VERSION, DATA_VERSION, MODEL_VERSION } from "./version";

export type Endpoint = Deps & { catalogue: () => Promise<Catalogue> };

const revisionOf = (cat: Catalogue) => Number((cat as { revision?: number }).revision) || 0;

/** GET /api/v1/catalogue?type=&world=&ids=&search= */
export function getCatalogueEndpoint(req: Request, deps: Endpoint): Promise<Response> {
  return handle(req, "catalogue:read", deps, async ({ requestId }) => {
    const url = new URL(req.url);
    const parsed = CatalogueQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ApiError("VALIDATION_ERROR", undefined, issues(parsed.error));
    const cat = await deps.catalogue();
    const revision = revisionOf(cat);
    // Same data, same filter → same ETag. Clients send it back as If-None-Match and get a bodiless 304.
    const etag = `"${revision}-${DATA_VERSION}-${sha256(JSON.stringify(parsed.data)).slice(0, 12)}"`;
    const headers = { ETag: etag, "Cache-Control": "private, no-cache", Vary: "Authorization" };
    const sent = req.headers.get("if-none-match");
    if (sent && sent.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag)) return { status: 304, headers };
    return { headers, body: { success: true, apiVersion: API_VERSION, catalogueRevision: revision, dataVersion: DATA_VERSION, requestId, data: buildCatalogue(cat, parsed.data) } };
  });
}

/** POST /api/v1/calculate with a JSON body. */
export function postCalculateEndpoint(req: Request, deps: Endpoint): Promise<Response> {
  return handle(req, "calculator:execute", deps, async ({ requestId }) => {
    const body = await readJson(req);
    const parsed = CalculateRequest.safeParse(body);
    if (!parsed.success) throw new ApiError("VALIDATION_ERROR", undefined, issues(parsed.error));
    const cat = await deps.catalogue();
    const out = calculate(cat, parsed.data);
    return {
      body: {
        success: true, apiVersion: API_VERSION, catalogueRevision: revisionOf(cat), dataVersion: DATA_VERSION, calculationModelVersion: MODEL_VERSION,
        requestId, data: out.data, warnings: out.warnings,
      },
    };
  });
}
