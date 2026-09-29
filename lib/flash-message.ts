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

// One-time message carried across a redirect in a short-lived cookie.
export const FLASH_COOKIE = "flash";

export type FlashMessage = {
  id: string;
  type: "error" | "success";
  text: string;
};

export const flashCookieOptions = {
  path: "/",
  maxAge: 60,
  sameSite: "lax",
  // Read and cleared by the browser once the toast is shown
  httpOnly: false,
} as const;

export function createFlashMessage(type: FlashMessage["type"], text: string) {
  const message: FlashMessage = { id: crypto.randomUUID(), type, text };
  return JSON.stringify(message);
}

export function parseFlashMessage(value: string | undefined): FlashMessage | null {
  if (!value) return null;

  try {
    const message = JSON.parse(value);
    return typeof message?.id === "string" && typeof message?.text === "string"
      ? message
      : null;
  } catch {
    return null;
  }
}
