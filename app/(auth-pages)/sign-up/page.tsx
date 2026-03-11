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

import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function Signup({ searchParams }: { searchParams: Message }) {
  if ("message" in searchParams) {
    return (
      <div className="flex items-center justify-center p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex-1 flex flex-col min-w-64">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-amber-600">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Already have an account?{" "}
          <Link
            className="text-blue-600 hover:text-blue-500 transition-colors font-medium"
            href="/sign-in"
          >
            Sign in
          </Link>
        </p>

        <div className="flex flex-col gap-4 mt-8">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input
              id="full-name"
              name="full-name"
              placeholder="Please enter your full name"
              minLength={3}
              maxLength={255}
              aria-label="Full Name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="Create a password"
              minLength={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name (optional)</Label>
            <Input
              id="company-name"
              name="company-name"
              placeholder="Enter your company name"
              minLength={3}
              maxLength={255}
              aria-label="Company Name"
            />
          </div>

          <FormMessage message={searchParams} />

          <SubmitButton
            className="w-full"
            formAction={signUpAction}
            pendingText="Creating account..."
          >
            Sign up
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
