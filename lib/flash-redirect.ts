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

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FLASH_COOKIE, createFlashMessage, flashCookieOptions } from "@/lib/flash-message";

// Redirects and shows the message there as a toast. Server actions only.
export async function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string
): Promise<never> {
  (await cookies()).set(FLASH_COOKIE, createFlashMessage(type, message), flashCookieOptions);
  return redirect(path);
}
