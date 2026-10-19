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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryBuilder, queueTables } from "../helpers/supabase-mock";

const user = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { exchangeCodeForSession: vi.fn(), signOut: vi.fn() },
}));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/utils/create-user-wallet", () => ({ createUserWallet: vi.fn() }));

import { GET } from "@/app/auth/callback/route";

const call = (query: string) => GET(new Request(`https://app.example.com/auth/callback?${query}`));
const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  user.from.mockReset();
  admin.from.mockReset();
  user.auth.exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: "auth-1", email: "a@example.com" } },
    error: null,
  });
  queueTables(admin, { profiles: [queryBuilder({ data: { id: "p-1" } })] });
  queueTables(user, { wallets: [queryBuilder({ data: { id: "w-1" } })] });
});

describe("GET /auth/callback", () => {
  it("sends the user to the requested path on this site", async () => {
    expect(location(await call("code=abc&next=/dashboard/reset-password"))).toBe(
      "https://app.example.com/dashboard/reset-password"
    );
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["an absolute URL", "https://evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a path not starting with a slash", "evil.example"],
    ["nothing", ""],
  ])("does not redirect off-site for %s", async (_name, next) => {
    const res = await call(`code=abc&next=${encodeURIComponent(next)}`);
    expect(new URL(location(res)!).origin).toBe("https://app.example.com");
    expect(new URL(location(res)!).pathname).toBe("/");
  });

  it("syncs the profile email with the secret key, since users cannot write it", async () => {
    const profile = queryBuilder({ data: { id: "p-1" } });
    queueTables(admin, { profiles: [profile] });
    await call("code=abc");
    expect(profile.update).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(user.from).not.toHaveBeenCalledWith("profiles");
  });

  it("goes to the error page when the code is invalid", async () => {
    user.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: "bad" } });
    expect(location(await call("code=bad"))).toBe("https://app.example.com/auth/auth-error");
    expect(location(await call(""))).toBe("https://app.example.com/auth/auth-error");
  });
});
