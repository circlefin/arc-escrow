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

import type { EscrowAgreementWithDetails } from "@/types/escrow";
import type { FunctionComponent, PropsWithChildren } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface Props extends PropsWithChildren {
  agreement: EscrowAgreementWithDetails
  profileId: string
  handleDeleteEscrow: (agreementId: string) => Promise<void>
}

export const AgreementDeleteDialog: FunctionComponent<Props> = props => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {props.children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Escrow Agreement with {props.profileId === props.agreement.depositor_wallet?.profile_id
            ? props.agreement.beneficiary_wallet?.profiles.name
            : props.agreement.depositor_wallet?.profiles.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this escrow agreement?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => props.handleDeleteEscrow(props.agreement.id)}>
            Yes
          </AlertDialogAction>
          <AlertDialogCancel>
            No
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}