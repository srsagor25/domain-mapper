import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Per-IP rate limiting on /api/search to protect the shared free-tier
// Gemini quota from being drained by a single abusive client.
//
// Caveat: Vercel runs middleware on the Edge runtime, and state in
// `buckets` is per-instance — limits are not strictly shared across
// regions. This is "good enough" for casual abuse; bulletproof
// rate limiting would need Vercel KV or Upstash.
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS = 20;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function middleware(request: NextRequest) {
  const ip = clientIp(request);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: `Too many searches. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) and try again.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  bucket.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/search",
};
