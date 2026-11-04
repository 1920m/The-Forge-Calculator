/**
 * The OpenAPI 3.1 description of the public API, built from the same zod schemas and error list the server uses,
 * so the documentation can't drift from what's checked at runtime.
 */
import * as z from "zod";
import { ERRORS } from "./errors";
import { CATALOGUE_TYPES, DpsRequest, ForgeRequest, GolemiteRequest, LoadoutRequest } from "./schema";
import { API_VERSION, MODEL_VERSION } from "./version";
import { SITE_URL } from "@/lib/site";

const schema = (s: z.ZodType) => {
  const out = z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete out.$schema;
  return out;
};

const envelope = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "object",
  required: ["success", "apiVersion", "catalogueRevision", "dataVersion", "requestId", "data"],
  properties: {
    success: { const: true }, apiVersion: { const: API_VERSION }, catalogueRevision: { type: "integer", description: "Game data release." },
    dataVersion: { type: "string", description: "Hash of the data shipped with the site (races, runes, molds, Golemites...)." },
    requestId: { type: "string" }, ...extra, data,
  },
});

const errorResponse = (codes: string[]) => ({
  description: codes.map((c) => `\`${c}\``).join(", "),
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

function errorsFor(statuses: number[]) {
  const out: Record<string, unknown> = {};
  for (const st of statuses) {
    const codes = Object.entries(ERRORS).filter(([, v]) => v.status === st).map(([k]) => k);
    if (codes.length) out[String(st)] = errorResponse(codes);
  }
  return out;
}

export function buildOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Forge Calculator API", version: API_VERSION,
      description: `Game data and calculations from ${SITE_URL}. Calculation model ${MODEL_VERSION}. DPS figures are estimates from the community damage model, not measurements from the game.`,
    },
    servers: [{ url: `${SITE_URL}/api/v1` }],
    security: [{ apiKey: [] }],
    paths: {
      "/catalogue": {
        get: {
          summary: "Game data", operationId: "getCatalogue",
          description: "Needs the `catalogue:read` permission. Send the ETag back as If-None-Match to get 304 when nothing changed.",
          parameters: [
            { name: "type", in: "query", schema: { type: "string", enum: [...CATALOGUE_TYPES] }, description: "One section only. Without it, everything." },
            { name: "world", in: "query", schema: { type: "integer", enum: [1, 2, 3, 4] }, description: "Only what that world's forge or mines have (1 and 2 share a forge)." },
            { name: "ids", in: "query", schema: { type: "string" }, description: "Comma-separated catalogue IDs (up to 100)." },
            { name: "search", in: "query", schema: { type: "string", maxLength: 60 }, description: "Name contains this text (case doesn't matter)." },
            { name: "If-None-Match", in: "header", schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Game data", headers: { ETag: { schema: { type: "string" } } }, content: { "application/json": { schema: envelope({ type: "object", description: "One key per section: ores, weapons, armour, classes, races, runes, runeSideEffects, runeSlots, molds, golemites, pickaxes." }) } } },
            304: { description: "Not modified (same ETag)." },
            ...errorsFor([401, 403, 422, 429, 500, 503]),
          },
        },
      },
      "/calculate": {
        post: {
          summary: "Run a calculation", operationId: "calculate",
          description: "Needs the `calculator:execute` permission. One of four request types, chosen by `type`.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { oneOf: ["Forge", "Dps", "Loadout", "Golemite"].map((n) => ({ $ref: `#/components/schemas/${n}Request` })), discriminator: { propertyName: "type" } } } },
          },
          responses: {
            200: { description: "Result", content: { "application/json": { schema: envelope({ type: "object", description: "Depends on `type`; see the developer page for each." }, {
              calculationModelVersion: { type: "string" }, warnings: { type: "array", items: { $ref: "#/components/schemas/Warning" } },
            }) } } },
            ...errorsFor([400, 401, 403, 413, 415, 422, 429, 500, 503]),
          },
        },
      },
    },
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "Authorization: Bearer fc_live_..." } },
      schemas: {
        ForgeRequest: schema(ForgeRequest), DpsRequest: schema(DpsRequest), LoadoutRequest: schema(LoadoutRequest), GolemiteRequest: schema(GolemiteRequest),
        Warning: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
        Error: {
          type: "object", required: ["success", "apiVersion", "error"],
          properties: {
            success: { const: false }, apiVersion: { const: API_VERSION },
            error: { type: "object", required: ["code", "message", "requestId"], properties: { code: { type: "string", enum: Object.keys(ERRORS) }, message: { type: "string" }, requestId: { type: "string" }, details: {} } },
          },
        },
      },
    },
  };
}
