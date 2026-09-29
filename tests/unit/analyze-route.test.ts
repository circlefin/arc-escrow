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
import { NextRequest } from "next/server";
import { signedOut } from "../helpers/scenario";

const user = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }));
const openai = vi.hoisted(() => ({ chat: { completions: { create: vi.fn() } } }));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/utils/openAIClient", () => ({ openai }));

import { POST } from "@/app/api/contracts/analyze/route";

function upload(file: File | null) {
  const form = new FormData();
  if (file) form.set("file", file);
  return POST(new NextRequest("http://localhost/api/contracts/analyze", { method: "POST", body: form }));
}

const signedIn = () =>
  user.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-alice" } } });

beforeEach(() => {
  user.auth.getUser.mockReset();
  openai.chat.completions.create.mockReset();
});

describe("POST /api/contracts/analyze", () => {
  it("does not spend OpenAI credit for a signed-out caller", async () => {
    signedOut(user);
    const res = await upload(new File(["x"], "c.pdf", { type: "application/pdf" }));
    expect(res.status).toBe(401);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    signedIn();
    expect((await upload(null)).status).toBe(400);
  });

  it("rejects an oversized file", async () => {
    signedIn();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    expect((await upload(big)).status).toBe(413);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it.each(["image/png", "text/plain", "constructor", "toString", "__proto__"])(
    "rejects unsupported type %j (including Object.prototype keys)",
    async (type) => {
      signedIn();
      const res = await upload(new File(["x"], "c.bin", { type }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Unsupported file type/);
      expect(openai.chat.completions.create).not.toHaveBeenCalled();
    }
  );
});
