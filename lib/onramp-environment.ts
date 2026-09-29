/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// The one place that decides which Circle environment the onramp talks to. Client-safe: reads NEXT_PUBLIC_* only.

export type OnrampEnvironment = "production" | "sandbox";

export const PRODUCTION_API_BASE_URL = "https://api.circle.com";
export const PRODUCTION_WIDGET_BASE_URL = "https://onramp.arc.io";
export const SANDBOX_API_BASE_URL = "https://api-test.circle.com";
export const SANDBOX_WIDGET_BASE_URL = "https://onramp-sandbox.arc.io";

// Unset, empty and whitespace all mean "use the kit default", so collapse them to undefined.
export function readUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// Compare origins only: the widget URL appears both bare and with a launch path.
function originOf(url: string, name: string): string {
  try {
    return new URL(url).origin;
  } catch {
    throw new Error(`${name} is not a valid URL: ${JSON.stringify(url)}`);
  }
}

// Only an explicit production URL (or none at all) counts as production; everything else is treated as non-production.
export function resolveEnvironment(
  url: string | undefined,
  productionUrl: string,
  name: string,
): OnrampEnvironment {
  if (!url) return "production";
  return originOf(url, name) === productionUrl ? "production" : "sandbox";
}

// Written as a literal expression because Next inlines NEXT_PUBLIC_* at build time.
export const WIDGET_BASE_URL = readUrl(
  process.env.NEXT_PUBLIC_ONRAMP_WIDGET_BASE_URL,
);

export const CLIENT_ENVIRONMENT = resolveEnvironment(
  WIDGET_BASE_URL,
  PRODUCTION_WIDGET_BASE_URL,
  "NEXT_PUBLIC_ONRAMP_WIDGET_BASE_URL",
);
