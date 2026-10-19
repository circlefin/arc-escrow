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

import { vi } from "vitest";

export interface QueryResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "neq",
  "ilike",
  "in",
  "order",
  "limit",
] as const;

/**
 * A stand-in for a supabase-js query builder. Every chained method returns the
 * builder itself; awaiting it, or calling .single() / .maybeSingle(), resolves
 * to `result`. Chained calls are recorded (e.g. `builder.insert.mock.calls`).
 */
export function queryBuilder(result: QueryResult = {}) {
  const resolved = () => ({ data: null, error: null, ...result });
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(async () => resolved());
  builder.maybeSingle = vi.fn(async () => resolved());
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(resolved()).then(onFulfilled, onRejected);
  return builder as Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>> & {
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

export type QueryBuilder = ReturnType<typeof queryBuilder>;

/**
 * Wires `client.from(table)` to hand out queued builders, one per call, in order.
 * A call to a table with nothing queued fails loudly instead of returning junk.
 */
export function queueTables(
  client: { from: ReturnType<typeof vi.fn> },
  tables: Record<string, QueryBuilder[]>
) {
  const queues = Object.fromEntries(
    Object.entries(tables).map(([table, builders]) => [table, [...builders]])
  );
  client.from.mockImplementation((table: string) => {
    const next = queues[table]?.shift();
    if (!next) throw new Error(`Unexpected query on table "${table}"`);
    return next;
  });
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
