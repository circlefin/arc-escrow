/**
 * The Haia Trace webhook endpoint — a SEPARATE path from the app's own
 * `/api/webhooks/circle`, because Circle requires a unique URL per
 * subscription: the app's subscription keeps feeding the app, and the Trace
 * subscription (created by `npm run trace:register`) feeds this route.
 *
 * The body is read as RAW TEXT, never `req.json()`: the signature covers the
 * bytes as sent, and re-serializing parsed JSON can change them.
 */

import type { NextRequest } from "next/server";
import { traceWebhookHandler } from "@/lib/trace/handler";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const result = await traceWebhookHandler.handle(rawBody, req.headers);
  if (result.status !== 200) {
    console.error("[trace] webhook not recorded:", result.outcome, result.reason);
  }
  // The decision is the whole response: 200 accepted (or duplicate),
  // 400 not-Circle (no retry can fix it), 500 our failure (Circle retries).
  return new Response(null, { status: result.status });
}

// Circle validates the endpoint with a HEAD request when the subscription is
// created.
export async function HEAD() {
  return new Response(null, { status: 200 });
}
