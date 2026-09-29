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

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against the LOCAL Supabase stack (`npm run db:start`).
// Connection settings come from .env.local, the same file the app uses.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Missing file: connection settings may already be in the environment (CI).
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    // Tests share one database; keep files sequential.
    fileParallelism: false,
  },
});
