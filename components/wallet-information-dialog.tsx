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

import type { FunctionComponent } from "react";
import type { Wallet } from "@/types/database.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";
import { WalletBalance } from "@/components/wallet-balance";

interface Props {
  wallet: Wallet;
}

export const WalletInformationDialog: FunctionComponent<Props> = props => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="ml-auto" variant="ghost" size="icon">
        <Info className="h-4 w-4" />
      </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Wallet information</DialogTitle>
        </DialogHeader>
        <div className="grid py-4">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Balance
          </h4>
          <div className="text-xl text-muted-foreground cursor-pointer mb-4">
            <WalletBalance walletId={props.wallet.circle_wallet_id} />
          </div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            ID
          </h4>
          <div className="flex w-full items-center mb-4">
            <Input disabled value={props.wallet.circle_wallet_id} />
            <CopyButton text={props.wallet.circle_wallet_id} />
          </div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Address
          </h4>
          <div className="flex w-full items-center mb-4">
            <Input disabled value={props.wallet.wallet_address} />
            <CopyButton text={props.wallet.wallet_address} />
          </div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2">
            Blockchain
          </h4>
          <p className="text-xl text-muted-foreground cursor-pointer">
            {props.wallet.blockchain || "No wallet found"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}