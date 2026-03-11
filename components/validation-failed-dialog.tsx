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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  validationResult: string[]
  handleClose: () => void
}

export const ValidationFailedDialog: FunctionComponent<Props> = props => {
  return (
    <AlertDialog open={props.validationResult?.length > 0}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Work validation failed</AlertDialogTitle>
          <AlertDialogDescription>
            Consider addressing the issues listed below before trying again:
          </AlertDialogDescription>
          <ul className="my-6 ml-6 list-disc text-sm text-muted-foreground [&>li]:mt-2 [&>li:first-child]:mt-0">
            {props.validationResult?.map((issue, index) => (
              <li key={index}>
                {issue}
              </li>
            ))}
          </ul>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={props.handleClose}>
            Close
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}