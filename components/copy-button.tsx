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

import { type FunctionComponent, useState } from "react";
import { Copy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { sleep } from "@/lib/utils/sleep";

interface Props {
  text: string;
}

export const CopyButton: FunctionComponent<Props> = (props) => {
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false);

  const simulateTooltipOpening = async () => {
    setShouldShowTooltip(true);
    await sleep(700);
    setShouldShowTooltip(false);
  };

  return (
    <TooltipProvider>
      <Tooltip open={shouldShowTooltip}>
        <TooltipTrigger asChild>
          <Button onClick={simulateTooltipOpening}>
            <Copy
              className="h-4 w-4"
              onClick={() => navigator.clipboard.writeText(props.text)}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copied</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
