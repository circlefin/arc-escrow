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

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Zap,
  CheckCircle,
  Wallet,
  FileText,
  FileSearch,
  Lock,
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="flex flex-col items-center w-full px-5">
      {/* Hero Section */}
      <section className="w-full max-w-6xl space-y-16 py-8">
        <div className="flex flex-col items-center gap-8">
          {/* Main headline */}
          <div className="relative">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Shield className="w-8 h-8 text-blue-500" />
              <Zap className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-amber-600 leading-tight">
              Effortless Escrow for Secure Deals
            </p>
            <p className="mt-4 text-xl md:text-2xl text-center text-muted-foreground">
              AI-Powered Escrow Service for Reliable Payments and Task Validation
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Bank-Grade Security</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>24/7 Automated</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Instant Settlement</span>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section className="w-full space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Why Choose Workflow Escrow?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FileText className="w-8 h-8 text-blue-500" />}
              title="AI-Powered Smart Contracts"
              description="Automatically transform agreements into blockchain-backed smart contracts."
            />
            <FeatureCard
              icon={<CheckCircle className="w-8 h-8 text-green-500" />}
              title="Secure and Trust-Free"
              description="Funds are protected in decentralized escrow until tasks are verified."
            />
            <FeatureCard
              icon={<Wallet className="w-8 h-8 text-amber-500" />}
              title="Instant Payments"
              description="Funds are released automatically upon AI task approval."
            />
          </div>
        </section>
      </section>

      {/* How It Works Section - Full width background */}
      <section className="w-full bg-gradient-to-b from-background to-muted/50 py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start px-5">
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900/50 rounded-full p-4 mb-4">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Your Agreement</h3>
              <p className="text-sm text-muted-foreground">
                Provide a paper contract or agreement document.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 dark:bg-green-900/50 rounded-full p-4 mb-4">
                <FileSearch className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Extraction</h3>
              <p className="text-sm text-muted-foreground">
                Our AI extracts task details and payment terms.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-yellow-100 dark:bg-yellow-900/50 rounded-full p-4 mb-4">
                <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Escrow Creation</h3>
              <p className="text-sm text-muted-foreground">
                A smart contract is deployed, holding funds securely.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-4 mb-4">
                <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Validation</h3>
              <p className="text-sm text-muted-foreground">
                AI reviews submitted work and triggers payment release.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="w-full max-w-5xl py-16 space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Simplify Your Transactions?
          </h2>
          <p className="text-lg text-muted-foreground">
            Join the future of secure and automated escrow services today.
          </p>
        </div>
        <div className="flex justify-center">
          <Link href="/sign-up">
            <Button size="lg">Get Started Now</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-5 text-center text-sm text-muted-foreground">
          © 2026 Circle Internet Group. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-center mb-2">{title}</h3>
      <p className="text-muted-foreground text-center">{description}</p>
    </div>
  );
};

export default LandingPage;