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

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletTransactionsResponse } from "@/app/api/wallet/transactions/route";
import type { Wallet } from "@/types/database.types";
import { useEffect, useMemo, useState, type FunctionComponent } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: string;
  status: string;
  created_at: string;
  circle_transaction_id: string;
  transaction_type: string;
  amount: string;
}

interface CircleTransaction {
  id: string;
  transactionType: string;
  amount: string[];
  status: string;
  description?: string;
  circle_contract_address?: string;
}

interface Props {
  wallet: Wallet;
  profile: {
    id: any;
  } | null;
}

const ITEMS_PER_PAGE = 5;

async function syncTransactions(
  supabase: SupabaseClient,
  walletId: string,
  profileId: string,
  circleWalletId: string
) {
  // 1. Fetch transactions from Circle API
  const transactionsResponse = await fetch(
    `${baseUrl}/api/wallet/transactions`,
    {
      method: "POST",
      body: JSON.stringify({
        walletId: circleWalletId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const parsedTransactions: WalletTransactionsResponse =
    await transactionsResponse.json();

  if (parsedTransactions.error || !parsedTransactions.transactions) {
    return [];
  }

  // 2. Get existing transactions from database
  const { data: existingTransactions } = await supabase
    .from("transactions")
    .select("circle_transaction_id")
    .eq("wallet_id", walletId);

  const existingTransactionIds = new Set(
    existingTransactions?.map((t: any) => t.circle_transaction_id) || []
  );

  // 3. Filter out transactions that already exist
  const newTransactions = parsedTransactions.transactions.filter(
    (transaction: any) => !existingTransactionIds.has(transaction.id)
  );

  // 4. Insert new transactions into the database
  if (newTransactions.length > 0) {
    const transactionsToInsert = newTransactions.map(
      (transaction: CircleTransaction) => {
        if (
          !transaction.id ||
          !transaction.transactionType ||
          !transaction.amount
        ) {
          throw new Error(
            `Invalid transaction structure: ${JSON.stringify(transaction)}`
          );
        }

        return {
          wallet_id: walletId,
          profile_id: profileId,
          circle_transaction_id: transaction.id,
          transaction_type: transaction.transactionType,
          amount: parseFloat(transaction.amount[0]?.replace(/[$,]/g, "")) || 0,
          currency: "USDC",
          status: transaction.status,
        };
      }
    );

    const { error } = await supabase
      .from("transactions")
      .insert(transactionsToInsert);

    if (error) {
      console.error("Error inserting transactions:", error);
    }
  }

  // 5. Return all transactions from database
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });

  // Filter out duplicates keeping only the latest transaction for each circle_transaction_id
  const uniqueTransactions =
    allTransactions?.reduce((acc, current) => {
      const existingTransaction = acc.find(
        (item: { circle_transaction_id: any }) =>
          item.circle_transaction_id === current.circle_transaction_id
      );
      if (!existingTransaction) {
        acc.push(current);
      }
      return acc;
    }, []) || [];

  return uniqueTransactions;
}

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

const supabase = createSupabaseBrowserClient();

export const Transactions: FunctionComponent<Props> = (props) => {
  const router = useRouter();
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const formattedData = useMemo(
    () =>
      data.map((transaction) => ({
        ...transaction,
        created_at: new Date(transaction.created_at).toLocaleString(),
        amount: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(transaction.amount)),
      })),
    [data]
  );

  // Calculate pagination
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = formattedData.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const updateTransactions = async () => {
    try {
      setLoading(true);

      // Sync and get transactions
      const transactions = await syncTransactions(
        supabase,
        props.wallet?.id,
        props.profile?.id,
        props.wallet?.circle_wallet_id
      );

      setData(transactions);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const transactionSubscription = supabase
      .channel("transactions")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `profile_id=eq.${props.profile?.id}`,
        },
        () => updateTransactions()
      )
      .subscribe();

    updateTransactions();

    return () => {
      supabase.removeChannel(transactionSubscription);
    };
  }, []);

  if (loading) {
    return <Skeleton className="w-[206px] h-[28px] rounded-full" />;
  }

  if (data && data.length < 1) {
    return (
      <p className="text-xl text-muted-foreground cursor-pointer">
        No transactions found
      </p>
    );
  }

  return (
    <>
      <Table className="mb-4">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.map((transaction) => (
            <TableRow
              onClick={() =>
                router.push(
                  `/dashboard/transaction/${transaction.circle_transaction_id}`
                )
              }
              className="cursor-pointer"
              key={transaction.id}
            >
              <TableCell>{transaction.created_at}</TableCell>
              {transaction.transaction_type === "INBOUND" && (
                <TableCell className="text-green-600">
                  +{transaction.amount}
                </TableCell>
              )}
              {transaction.transaction_type === "DEPOSIT_PAYMENT" && (
                <TableCell className="text-red-600">
                  -{transaction.amount}
                </TableCell>
              )}
              {transaction.transaction_type !== "DEPOSIT_PAYMENT" &&
                transaction.transaction_type !== "INBOUND" && (
                  <TableCell>{transaction.amount}</TableCell>
                )}
              <TableCell>{transaction.status}</TableCell>
              <TableCell>{transaction.transaction_type}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                }}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {/* First page */}
            {currentPage > 2 && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(1);
                  }}
                  isActive={currentPage === 1}
                >
                  1
                </PaginationLink>
              </PaginationItem>
            )}

            {/* Ellipsis for skipped pages */}
            {currentPage > 3 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}

            {/* Previous page (if applicable) */}
            {currentPage > 1 && currentPage <= totalPages && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(currentPage - 1);
                  }}
                  isActive={false}
                >
                  {currentPage - 1}
                </PaginationLink>
              </PaginationItem>
            )}

            {/* Current page */}
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(currentPage);
                }}
                isActive={true}
              >
                {currentPage}
              </PaginationLink>
            </PaginationItem>

            {/* Next page (if applicable) */}
            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(currentPage + 1);
                  }}
                  isActive={false}
                >
                  {currentPage + 1}
                </PaginationLink>
              </PaginationItem>
            )}

            {/* Ellipsis for skipped pages */}
            {currentPage < totalPages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}

            {/* Last page */}
            {currentPage < totalPages - 1 && (
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(totalPages);
                  }}
                  isActive={currentPage === totalPages}
                >
                  {totalPages}
                </PaginationLink>
              </PaginationItem>
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                }}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
};
