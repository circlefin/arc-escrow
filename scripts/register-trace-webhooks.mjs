/**
 * Register the Circle webhook subscription that feeds Haia Trace.
 *
 * Usage:
 *   npm run trace:register -- https://<your-tunnel>.ngrok.app
 *   node --env-file=.env scripts/register-trace-webhooks.mjs https://… [--token-id <usdc-token-id>]
 *
 * What it does:
 * 1. Creates a v2 notification subscription pointing at
 *    `<url>/api/webhooks/trace` for `transactions.*` and `contracts.eventLog`.
 *    The list is deliberately explicit — passing `*` (or nothing) would flip
 *    the subscription to unrestricted and deliver every notification type.
 * 2. Sets the monitored-tokens scope to SELECTED, so inbound transfers of
 *    random airdropped tokens do not flood the event log. With SELECTED and
 *    an empty list nothing is monitored yet — pass `--token-id` (the entity's
 *    USDC token id, visible on any USDC transaction in the Console) to add
 *    USDC, or add it in the Console UI.
 *
 * Requires CIRCLE_API_KEY in the environment. Safe to re-run: an existing
 * identical subscription shows up as an "already exists" error, which is
 * reported and not fatal.
 */

const API = "https://api.circle.com";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("CIRCLE_API_KEY is not set (run via: node --env-file=.env …)");
  process.exit(1);
}

const args = process.argv.slice(2);
const baseUrl = args.find((a) => a.startsWith("http"));
if (!baseUrl) {
  console.error("Usage: register-trace-webhooks.mjs <public-base-url> [--token-id <id>]");
  process.exit(1);
}
const tokenIdFlag = args.indexOf("--token-id");
const tokenId = tokenIdFlag === -1 ? undefined : args[tokenIdFlag + 1];

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/webhooks/trace`;

async function circle(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

console.log(`Subscribing ${endpoint} to transactions.* + contracts.eventLog …`);
const subscription = await circle("POST", "/v2/notifications/subscriptions", {
  endpoint,
  notificationTypes: ["transactions.*", "contracts.eventLog"],
});
console.log(`  → ${subscription.status} ${subscription.body}`);

console.log("Setting monitored-tokens scope to SELECTED …");
const scope = await circle(
  "PUT",
  "/v1/w3s/config/entity/monitoredTokens/scope",
  { scope: "SELECTED" },
);
console.log(`  → ${scope.status} ${scope.body}`);

if (tokenId) {
  console.log(`Adding token ${tokenId} to the monitored list …`);
  const add = await circle("POST", "/v1/w3s/config/entity/monitoredTokens", {
    tokenIds: [tokenId],
  });
  console.log(`  → ${add.status} ${add.body}`);
} else {
  console.log(
    "No --token-id given: add your USDC token id here or in the Console, " +
      "or inbound USDC will not produce notifications under SELECTED scope.",
  );
}
