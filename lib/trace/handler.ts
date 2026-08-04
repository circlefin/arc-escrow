/**
 * The Haia Trace webhook receiver, wired for this app.
 *
 * One module-level handler = one capture session: every delivery this process
 * receives is verified, deduplicated, normalized into `circle.*` events, and
 * appended to `.trace/events/webhooks.ndjson` — the file
 * `haia-trace build --template escrow-arc` assembles receipts from.
 *
 * The write is deliberately fail-LOUD (the error handler throws): if the sink
 * cannot persist an event, the route answers 500 so Circle retries the
 * delivery, instead of acknowledging something that was never recorded.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createFileEventWriter } from "@usehaia/trace-core/file";
import { createVerifier, createWebhookHandler } from "@usehaia/trace-circle";

const EVENTS_PATH = ".trace/events/webhooks.ndjson";

// `createFileEventWriter` appends to a path it is given and does not create
// directories — that is `createRunEventWriter`'s job, and we want the stable
// file name rather than one run file per restart. So the directory is ours to
// ensure, once, before the first delivery: without it every append fails with
// ENOENT, the handler answers 500, and Circle cannot even verify the endpoint
// when the subscription is created.
mkdirSync(dirname(EVENTS_PATH), { recursive: true });

/**
 * Fetch Circle's notification-signing public key. Requires our API key, which
 * is why the resolver lives in the app and not in the adapter. `null` for an
 * unknown key id makes the delivery fail verification (a 400, not retried);
 * a thrown error means we could not resolve at all (a 500, retried).
 */
async function resolveKey(keyId: string): Promise<string | null> {
  if (!process.env.CIRCLE_API_KEY) {
    throw new Error("CIRCLE_API_KEY is not set");
  }
  const response = await fetch(
    `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`failed to fetch Circle public key: ${response.status}`);
  }
  const body = (await response.json()) as { data?: { publicKey?: string } };
  const publicKey = body.data?.publicKey;
  if (!publicKey) throw new Error("Circle public key response had no key");
  return publicKey;
}

export const traceWebhookHandler = createWebhookHandler({
  verifier: createVerifier({ resolveKey }),
  write: createFileEventWriter(EVENTS_PATH, (err: unknown) => {
    // Fail loud: a swallowed write would stop Circle's retries and lose the
    // event forever. The handler catches this and answers 500.
    throw err;
  }).write,
});
