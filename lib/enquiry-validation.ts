import { addDays, businessDate, isISODate, isTime } from "./dates";
import { clientKey, createRateLimiter } from "./net/rate-limit";

const allowEnquiry = createRateLimiter(20, 60_000);
const MAX_BODY_BYTES = 16 * 1024;

export class EnquiryInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Limit bytes while streaming, including requests without Content-Length. */
export async function readEnquiryBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new EnquiryInputError("Submit this enquiry from our website.", 403);
  }
  if (!allowEnquiry(clientKey(request))) {
    throw new EnquiryInputError("Too many enquiries. Please wait a minute and try again.", 429);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new EnquiryInputError("Expected a JSON body.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new EnquiryInputError("Enquiry is too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new EnquiryInputError("Expected a JSON body.");
  let bytes = 0;
  let json = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new EnquiryInputError("Enquiry is too large.", 413);
      }
      json += decoder.decode(chunk.value, { stream: true });
    }
    json += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(json); } catch { throw new EnquiryInputError("Expected a JSON body."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new EnquiryInputError("Expected a JSON object.");
  }
  return body as Record<string, unknown>;
}

export function inputText(value: unknown, label: string, max = 120): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new EnquiryInputError(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new EnquiryInputError(`${label} must be ${max} characters or fewer.`);
  for (const character of trimmed) {
    const code = character.charCodeAt(0);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      throw new EnquiryInputError(`${label} contains invalid characters.`);
    }
  }
  return trimmed || null;
}

export function inputPhone(value: unknown, required = false): string | null {
  const phone = inputText(value, "Phone number", 32);
  if (!phone && !required) return null;
  const digits = phone?.replace(/[\s()+.-]/g, "") ?? "";
  if (!phone || !/^\+?[\d\s().-]+$/.test(phone) || !/^\d{7,15}$/.test(digits)) {
    throw new EnquiryInputError("Enter a valid phone number, including your country code when needed.");
  }
  return phone;
}

export function inputDate(value: string, label = "Date"): string {
  if (!isISODate(value) || value < businessDate() || value > addDays(businessDate(), 730)) {
    throw new EnquiryInputError(`${label} must be a valid date within the next two years.`);
  }
  return value;
}

export function inputTime(value: string): string {
  if (!isTime(value)) throw new EnquiryInputError("Choose a valid pickup time.");
  return value;
}

export function enquiryError(error: unknown): Response {
  const expected = error instanceof EnquiryInputError;
  if (!expected) console.error("[enquiries] Could not prepare enquiry:", error);
  return Response.json(
    { error: expected ? error.message : "We could not prepare this enquiry. Please try again." },
    { status: expected ? error.status : 503,
      headers: { "Cache-Control": "no-store", ...(expected && error.status === 429 ? { "Retry-After": "60" } : {}) } },
  );
}
