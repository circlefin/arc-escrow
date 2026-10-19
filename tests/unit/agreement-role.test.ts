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

import { describe, expect, it } from "vitest";
import { roleInAgreement } from "@/lib/auth/agreement-role";

const agreement = { depositor_wallet_id: "w-a", beneficiary_wallet_id: "w-b" };

describe("roleInAgreement", () => {
  it("identifies each party", () => {
    expect(roleInAgreement(agreement, "w-a")).toBe("depositor");
    expect(roleInAgreement(agreement, "w-b")).toBe("beneficiary");
  });

  it("returns null for anyone else, including an empty id", () => {
    expect(roleInAgreement(agreement, "w-c")).toBeNull();
    expect(roleInAgreement(agreement, "")).toBeNull();
  });

  it("treats someone on both sides as the depositor", () => {
    expect(
      roleInAgreement({ depositor_wallet_id: "w-a", beneficiary_wallet_id: "w-a" }, "w-a")
    ).toBe("depositor");
  });
});
