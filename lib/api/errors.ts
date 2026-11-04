/** Stable error codes for the public API. Clients branch on `code`; `message` is for people. */
export const ERRORS = {
  INVALID_JSON: { status: 400, message: "The request body isn't valid JSON." },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Send the body as application/json." },
  PAYLOAD_TOO_LARGE: { status: 413, message: "The request body is too large." },
  BAD_REQUEST: { status: 400, message: "The request couldn't be read." },
  MISSING_API_KEY: { status: 401, message: "Send your API key as: Authorization: Bearer <key>." },
  INVALID_API_KEY: { status: 401, message: "That API key isn't valid." },
  API_KEY_REVOKED: { status: 401, message: "That API key has been revoked." },
  API_KEY_EXPIRED: { status: 401, message: "That API key has expired." },
  INSUFFICIENT_SCOPE: { status: 403, message: "This API key isn't allowed to use this endpoint." },
  RATE_LIMITED: { status: 429, message: "Too many requests. Wait and try again." },
  TOO_MANY_INVALID_KEYS: { status: 429, message: "Too many requests with wrong API keys from this address. Try again later." },
  VALIDATION_ERROR: { status: 422, message: "Some of the request's values aren't allowed." },
  INVALID_ORE: { status: 422, message: "An ore ID isn't in the catalogue." },
  INVALID_ITEM: { status: 422, message: "The item ID isn't in the catalogue." },
  ITEM_KIND_MISMATCH: { status: 422, message: "That item isn't the kind (weapon or armour) or slot you asked for." },
  ITEM_NOT_IN_WORLD: { status: 422, message: "That item can't be forged in the world you chose." },
  WORLD_REQUIRED: { status: 422, message: "This item can be forged in more than one world with different odds. Send `world`." },
  INVALID_RACE: { status: 422, message: "The race ID isn't in the catalogue." },
  INVALID_RUNE: { status: 422, message: "A rune or rune side effect isn't valid for this item." },
  NOT_ENOUGH_ORES: { status: 422, message: "Not enough ores for this craft." },
  TOO_MANY_ORES: { status: 422, message: "Too many ores for this craft." },
  NOT_FOUND: { status: 404, message: "There's nothing at this address." },
  METHOD_NOT_ALLOWED: { status: 405, message: "This endpoint doesn't accept that method." },
  SERVICE_UNAVAILABLE: { status: 503, message: "The API is temporarily unavailable. Try again shortly." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong on our side." },
} as const;

export type ErrorCode = keyof typeof ERRORS;

export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message?: string, readonly details?: unknown, readonly retryAfter?: number) {
    super(message ?? ERRORS[code].message);
  }
  get status() { return ERRORS[this.code].status; }
}
