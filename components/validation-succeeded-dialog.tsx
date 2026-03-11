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

import { useEffect, useState, type FunctionComponent } from "react";
import Confetti from "react-confetti";
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
  workAccepted: boolean
  handleCongratulate: () => void
}

export const ValidationSucceededDialog: FunctionComponent<Props> = props => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(props.workAccepted);

    if (!props.workAccepted) return;

    setTimeout(() => setShowConfetti(false), 5000);
  }, [props.workAccepted]);

  return (
    <>
      {showConfetti && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 9999, pointerEvents: "none" }}>
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        </div>
      )}
      <AlertDialog open={props.workAccepted}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Work Approved! {String.fromCodePoint(0x1F60A)}</AlertDialogTitle>
            <AlertDialogDescription>
              Congratulations, your work was accepted!
            </AlertDialogDescription>
            <h3>Your payment is on the way. {String.fromCodePoint(0x1F911)}</h3>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => props.handleCongratulate()}>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}