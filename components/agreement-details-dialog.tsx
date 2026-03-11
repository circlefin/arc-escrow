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

import type { FunctionComponent, PropsWithChildren } from "react";
import type { EscrowAgreementWithDetails } from "@/types/escrow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";
import { ExternalLink, FileText } from "lucide-react";

interface Props extends PropsWithChildren {
  agreement: EscrowAgreementWithDetails;
}

interface Task {
  description: string;
  due_date: string;
  responsible_party: string;
  details: string[];
}

export const AgreementDetailsDialog: FunctionComponent<Props> = props => {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(props.agreement.transactions.amount);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {props.children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agreement details</DialogTitle>
        </DialogHeader>
        <div className="grid py-4">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Customer
          </h4>
          <p className="text-xl text-muted-foreground cursor-pointer mb-4">
            {props.agreement.depositor_wallet.profiles.name}
          </p>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Smart contract address
          </h4>
          <div className="flex w-full items-center mb-4">
            <Input disabled value={props.agreement.transactions.circle_contract_address} />
            <CopyButton text={props.agreement.transactions.circle_contract_address} />
          </div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-4">
            Original document
          </h4>
          <a
            href={props.agreement.terms.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/90 mb-4"
          >
            <FileText className="h-4 w-4" />
            {props.agreement.terms.originalFileName}
            <ExternalLink className="h-3 w-3" />
          </a>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Status
          </h4>
          <p className="text-xl text-muted-foreground cursor-pointer mb-4">
            {props.agreement.status}
          </p>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Amount
          </h4>
          <p className="text-xl text-muted-foreground cursor-pointer mb-4">
            ${formattedAmount}
          </p>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Deliverables
          </h4>
          <ul className="mt-1 space-y-1 mb-4">
            {props.agreement.terms.tasks?.map(
              (task: Task, index: number) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground"
                >
                  • {task.description}
                  {task.due_date && (
                    <span className="ml-1 text-xs">
                      (Due: {task.due_date})
                    </span>
                  )}
                </li>
              )
            )}
          </ul>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Date created
          </h4>
          <p className="text-xl text-muted-foreground cursor-pointer mb-4">
            {new Date(props.agreement.created_at).toLocaleString()}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}