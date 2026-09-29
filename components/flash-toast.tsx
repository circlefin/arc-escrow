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

"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { FLASH_COOKIE, type FlashMessage } from "@/lib/flash-message";

// Guards against showing the same message twice, e.g. when effects run twice in development
const shownIds = new Set<string>();

export function FlashToast({ message }: { message: FlashMessage | null }) {
  useEffect(() => {
    if (!message || shownIds.has(message.id)) return;

    shownIds.add(message.id);
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;

    if (message.type === "error") {
      toast.error(message.text);
    } else {
      toast.success(message.text);
    }
  }, [message]);

  return null;
}
