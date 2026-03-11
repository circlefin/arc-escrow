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

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const baseUrl = process.env.VERCEL_URL
  ? process.env.VERCEL_URL
  : "http://localhost:3000";

async function updateAgreementTransaction(transactionId: string, notification: Record<string, any>) {
  const supabase = createSupabaseServerClient();

  // Fetch the current status in the database to check if the update is needed
  const { data: transactionToUpdate, error: transactionError } = await supabase
    .from("transactions")
    .select()
    .eq("circle_transaction_id", transactionId)
    .single();

  // Exit if no update is needed
  if (transactionError || transactionToUpdate.status === notification.state) return;

  // Perform the update only if the status has changed
  await supabase
    .from("transactions")
    .update({
      status: notification.state,
      circle_contract_address: notification.contractAddress
    })
    .eq("circle_transaction_id", transactionId);

  const { data: agreement, error: agreementError } = await supabase
    .from("escrow_agreements")
    .select()
    .eq(
      transactionToUpdate.escrow_agreement_id ? "id" : "transaction_id",
      transactionToUpdate.escrow_agreement_id || transactionToUpdate.id
    )
    .single();

  if (agreementError) {
    console.error("Could not find an escrow agreement with the given transaction id", agreementError);
    return;
  }

  if (transactionToUpdate.transaction_type === "DEPLOY_CONTRACT") {
    if (notification.state === "COMPLETE") {
      await supabase
        .from("escrow_agreements")
        .update({ status: "OPEN" })
        .eq("id", agreement.id);

      return;
    }

    // Exit if no update is needed
    if (agreement.status === "PENDING") return;

    await supabase
      .from("escrow_agreements")
      .update({ status: "PENDING" })
      .eq("id", agreement.id);

    return
  }

  if (transactionToUpdate.transaction_type === "DEPOSIT_APPROVAL" && notification.state === "FAILED") {
    await supabase
      .from("escrow_agreements")
      .update({ status: "OPEN" })
      .eq("id", agreement.id);

    return;
  }

  if (transactionToUpdate.transaction_type === "DEPOSIT_REFUND") {
    if (notification.state === "FAILED") {
      await supabase
        .from("escrow_agreements")
        .update({ status: "OPEN" })
        .eq("id", agreement.id);
    }

    if (notification.state !== "COMPLETE") return;

    await supabase
      .from("escrow_agreements")
      .delete()
      .eq("id", agreement.id);
  }

  if (transactionToUpdate.transaction_type === "DEPOSIT_PAYMENT") {
    if (notification.state === "FAILED") {
      await supabase
        .from("escrow_agreements")
        .update({ status: "OPEN" })
        .eq("id", agreement.id);
    }

    if (notification.state !== "COMPLETE") return;

    await supabase
      .from("escrow_agreements")
      .update({ status: "LOCKED" })
      .eq("id", agreement.id);

    return;
  }

  if (transactionToUpdate.transaction_type === "RELEASE_PAYMENT") {
    if (notification.state === "FAILED") {
      await supabase
        .from("escrow_agreements")
        .update({ status: "LOCKED" })
        .eq("id", agreement.id);
    }

    if (notification.state !== "COMPLETE") return;

    await supabase
      .from("escrow_agreements")
      .update({ status: "CLOSED" })
      .eq("id", agreement.id);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const signature = req.headers.get("x-circle-signature");
    const keyId = req.headers.get("x-circle-key-id");

    if (!signature || !keyId) {
      return NextResponse.json(
        { error: "Missing signature or keyId in headers" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Convert to a string for signature verification
    const bodyString = JSON.stringify(body);

    const isVerified = await verifyCircleSignature(bodyString, signature, keyId);

    if (!isVerified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    console.log("Received notification:", body);

    const {
      id: transactionId,
      walletId,
      state: transactionState
    } = body.notification;

    if (walletId && transactionState === "COMPLETE") {
      const response = await fetch(`${baseUrl}/api/wallet/balance`, {
        method: "POST",
        body: JSON.stringify({ walletId }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const parsedResponse = await response.json()

      await supabase
        .from("wallets")
        .update({ balance: parsedResponse.balance })
        .eq("circle_wallet_id", walletId);
    }

    // Update or handle the contract deployment status in escrow_agreements
    await updateAgreementTransaction(transactionId, body.notification);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.log("Failed to process notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process notification: ${message}` },
      { status: 500 }
    );
  }
}

// Handle HEAD requests to verify endpoint availability
export async function HEAD() {
  return NextResponse.json({}, { status: 200 });
}

// Verify Circle's signature
async function verifyCircleSignature(
  bodyString: string,
  signature: string,
  keyId: string
): Promise<boolean> {
  const publicKey = await getCirclePublicKey(keyId);

  const verifier = crypto.createVerify("SHA256");
  verifier.update(bodyString);
  verifier.end();

  // Convert the Buffer to a Uint8Array for compatibility
  const signatureUint8Array = Uint8Array.from(Buffer.from(signature, "base64"));
  return verifier.verify(publicKey, signatureUint8Array);
}

// Function to get Circle’s public key using their API
async function getCirclePublicKey(keyId: string) {
  if (!process.env.CIRCLE_API_KEY) {
    throw new Error("Circle API key is not set");
  }

  try {
    const response = await fetch(`https://api.circle.com/v2/notifications/publicKey/${keyId}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch public key: ${response.statusText}`);
    }

    const data = await response.json();
    const rawPublicKey = data.data.publicKey;

    // Convert the base64-encoded key to PEM format
    const pemPublicKey = `-----BEGIN PUBLIC KEY-----\n${rawPublicKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;

    return pemPublicKey;
  } catch (error) {
    console.error("Error fetching Circle public key:", error);
    throw new Error("Failed to retrieve Circle public key");
  }
}
