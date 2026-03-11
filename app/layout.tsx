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

import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { hasEnvVars } from "@/lib/utils/supabase/check-env-vars";
import { Oxanium } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import "./globals.css";
import { ThemeSwitcher } from "@/components/theme-switcher";

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
});

const defaultUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Workflow Escrow",
  description: "Automated escrow agent that facilitates secure transactions",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={oxanium.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster expand />
          <div className="min-h-screen flex flex-col">
            {/* Fixed Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm border-b-foreground/10 h-16">
              <div className="w-full max-w-7xl mx-auto flex justify-between items-center h-full px-5 text-sm">
                <div className="flex gap-5 items-center font-semibold">
                  <ThemeSwitcher />
                  <Link
                    href={"/"}
                    className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-amber-600 font-bold text-lg hover:opacity-80 transition-opacity"
                  >
                    Workflow Escrow
                  </Link>
                  <div className="flex items-center gap-2"></div>
                </div>
                {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
              </div>
            </nav>

            {/* Main Content with padding-top to prevent header overlap */}
            <main className="flex-1 flex flex-col items-center pt-24 px-4">
              <div className="w-full max-w-7xl">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
