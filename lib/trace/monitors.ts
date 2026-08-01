/**
 * Event-monitor registration for Trace.
 *
 * The escrow contract is deployed PER AGREEMENT, and Circle only sends
 * `contracts.eventLog` webhooks for events it was explicitly asked to watch —
 * so the monitors cannot be configured once. They are registered when a
 * deployment completes (the same webhook that carries the new contract's
 * address), covering the three RefundProtocol events Trace's escrow-arc
 * template witnesses money stages with.
 *
 * No `importContract` call: the contract is deployed through the Smart
 * Contract Platform itself, so the platform already knows it. (If a live run
 * proves otherwise, the import belongs right before the monitor loop.)
 *
 * Best-effort by design: a failed registration must never break the webhook
 * response to Circle — it only means Trace sees the wallet layer without the
 * contract layer for this agreement, which the receipt then honestly shows as
 * unclosed stages.
 */

import { randomUUID } from "node:crypto";

/** The RefundProtocol events Trace watches (signatures carry no spaces). */
const ESCROW_EVENT_SIGNATURES = [
  "PaymentCreated(uint256,address,uint256,uint256,address)",
  "Withdrawal(address,uint256)",
  "Refund(uint256,address,uint256)",
];

/** Contracts whose monitors this process already registered — avoids
 *  re-registering on Circle's redelivery of the same deployment webhook. */
const registered = new Set<string>();

/**
 * Create one event monitor via the REST API. The app's pinned SDK major
 * predates the event-monitor methods, and upgrading it for three calls would
 * risk the rest of the app — the REST endpoint is stable and needs only the
 * API key. Reference: https://developers.circle.com/contracts/scp-event-monitoring
 */
async function createEventMonitor(
  contractAddress: string,
  eventSignature: string,
): Promise<{ ok: boolean; detail: string }> {
  const response = await fetch("https://api.circle.com/v1/w3s/contracts/monitors", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
    },
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      blockchain: process.env.CIRCLE_BLOCKCHAIN,
      contractAddress,
      eventSignature,
    }),
  });
  const detail = await response.text();
  // 409 means the monitor already exists — success for our purposes (e.g. a
  // retry after a partial registration).
  return { ok: response.ok || response.status === 409, detail };
}

export async function ensureEscrowMonitors(
  contractAddress: string,
): Promise<void> {
  const address = contractAddress.toLowerCase();
  if (registered.has(address)) return;

  let allCreated = true;
  for (const eventSignature of ESCROW_EVENT_SIGNATURES) {
    try {
      const { ok, detail } = await createEventMonitor(
        contractAddress,
        eventSignature,
      );
      if (!ok) {
        allCreated = false;
        console.error(
          `[trace] event monitor for ${eventSignature} on ${contractAddress} was not created: ${detail}`,
        );
      }
    } catch (error) {
      allCreated = false;
      console.error(
        `[trace] event monitor request failed for ${eventSignature} on ${contractAddress}:`,
        error,
      );
    }
  }

  if (allCreated) registered.add(address);
}
