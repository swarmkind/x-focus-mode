export const CATEGORIES = [
  "ragebait",
  "doomering",
  "engagement_farming",
  "suspected_ai_slop",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const LABELS: Record<Category, string> = {
  ragebait: "Ragebait",
  doomering: "Doomering",
  engagement_farming: "Engagement farming",
  suspected_ai_slop: "Suspected AI slop",
};
export const DAY = 86_400_000;
export const RETENTION = 30 * DAY;
export const MAX_REPORT_BYTES = 2048;
export const BUCKETS = 64;
export interface Report {
  v: 1;
  tweetId: string;
  categories: Category[];
  source: "human" | "model";
  model: string;
  publisher: string;
  revision: number;
  issuedAt: number;
  expiresAt: number;
  withdrawn: boolean;
  signature: string;
}
const fields = [
  "v",
  "tweetId",
  "categories",
  "source",
  "model",
  "publisher",
  "revision",
  "issuedAt",
  "expiresAt",
  "withdrawn",
  "signature",
];
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function tweetId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value);
}
export function categoryList(value: unknown): value is Category[] {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    new Set(value).size === value.length &&
    value.every((x) => CATEGORIES.includes(x))
  );
}
export function validateReport(
  value: unknown,
  now = Date.now(),
): asserts value is Report {
  if (
    !record(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((k) => !(k in value)) ||
    JSON.stringify(value).length > MAX_REPORT_BYTES
  )
    throw new Error("Invalid report fields");
  const r = value as unknown as Report;
  if (
    r.v !== 1 ||
    !tweetId(r.tweetId) ||
    !categoryList(r.categories) ||
    !["human", "model"].includes(r.source) ||
    typeof r.withdrawn !== "boolean"
  )
    throw new Error("Invalid report");
  if (
    typeof r.model !== "string" ||
    r.model.length > 96 ||
    /[^\x20-\x7E]/.test(r.model) ||
    (r.source === "human" ? r.model !== "" : !r.model)
  )
    throw new Error("Invalid model");
  if (
    typeof r.publisher !== "string" ||
    !/^[A-Za-z0-9_-]{122}$/.test(r.publisher) ||
    typeof r.signature !== "string" ||
    !/^[A-Za-z0-9_-]{86}$/.test(r.signature)
  )
    throw new Error("Invalid signature encoding");
  if (
    ![r.revision, r.issuedAt, r.expiresAt].every(Number.isSafeInteger) ||
    r.revision < 1 ||
    r.issuedAt < 0 ||
    r.issuedAt > now + 300_000 ||
    r.expiresAt <= now ||
    r.expiresAt <= r.issuedAt ||
    r.expiresAt - r.issuedAt > RETENTION
  )
    throw new Error("Invalid revision or expiry");
  if (r.withdrawn ? r.categories.length !== 0 : r.categories.length === 0)
    throw new Error("Invalid categories for operation");
}
export function canonical(
  r: Omit<Report, "signature">,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    new TextEncoder().encode(
      JSON.stringify([
        r.v,
        r.tweetId,
        [...r.categories].sort(),
        r.source,
        r.model,
        r.publisher,
        r.revision,
        r.issuedAt,
        r.expiresAt,
        r.withdrawn,
      ]),
    ),
  );
}
export function base64url(data: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function unbase64url(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(s.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
}
export async function createIdentity(): Promise<{
  publicKey: string;
  privateKey: JsonWebKey;
}> {
  const keys = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  return {
    publicKey: base64url(
      (await crypto.subtle.exportKey("spki", keys.publicKey)) as ArrayBuffer,
    ),
    privateKey: (await crypto.subtle.exportKey(
      "jwk",
      keys.privateKey,
    )) as JsonWebKey,
  };
}
export async function signReport(
  r: Omit<Report, "signature">,
  privateKey: JsonWebKey,
): Promise<Report> {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = base64url(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      canonical(r),
    ),
  );
  const result = { ...r, signature };
  validateReport(result);
  return result;
}
export async function verifyReport(
  value: unknown,
  now = Date.now(),
): Promise<Report> {
  validateReport(value, now);
  const key = await crypto.subtle.importKey(
    "spki",
    unbase64url(value.publisher),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      unbase64url(value.signature),
      canonical(value),
    ))
  )
    throw new Error("Signature mismatch");
  return value;
}
export function reportKey(r: Pick<Report, "publisher" | "tweetId">): string {
  return r.publisher + ":" + r.tweetId;
}
export async function bucketFor(id: string): Promise<number> {
  return (
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)),
    )[0] % BUCKETS
  );
}
export function supersedes(next: Report, previous?: Report): boolean {
  // A withdrawal must outlive the original report, or a stale peer could resurrect it.
  return (
    !previous ||
    (next.revision > previous.revision &&
      next.issuedAt >= previous.issuedAt &&
      next.expiresAt >= previous.expiresAt)
  );
}
