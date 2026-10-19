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

// Server-side half of the onramp environment switch. Never import this from a client component.

import {
  CLIENT_ENVIRONMENT,
  PRODUCTION_API_BASE_URL,
  SANDBOX_API_BASE_URL,
  SANDBOX_WIDGET_BASE_URL,
  WIDGET_BASE_URL,
  readUrl,
  resolveEnvironment,
  type OnrampEnvironment,
} from "./onramp-environment";

export const API_BASE_URL = readUrl(process.env.ONRAMP_API_BASE_URL);

export const ENVIRONMENT: OnrampEnvironment = resolveEnvironment(
  API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  "ONRAMP_API_BASE_URL",
);

// A half-switched config fails invisibly, so refuse to start instead.
if (ENVIRONMENT !== CLIENT_ENVIRONMENT) {
  throw new Error(
    "Onramp environment mismatch: ONRAMP_API_BASE_URL resolves to " +
      `${ENVIRONMENT} (${API_BASE_URL ?? "unset, so the kit default"}) but ` +
      `NEXT_PUBLIC_ONRAMP_WIDGET_BASE_URL resolves to ${CLIENT_ENVIRONMENT} ` +
      `(${WIDGET_BASE_URL ?? "unset, so the kit default"}). Set both together: ` +
      `sandbox is ${SANDBOX_API_BASE_URL} + ${SANDBOX_WIDGET_BASE_URL}; ` +
      "production is both unset.",
  );
}
