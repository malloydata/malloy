/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import React, { useState } from "react";
import styled from "styled-components";
import { QueryDownloadOptions } from "../../webview_message_manager";
import { Popover } from "../components/Popover";
import { DownloadForm } from "./DownloadForm";
import DownloadIcon from "../assets/download_hover.svg";

interface DownloadButtonProps {
  onDownload: (options: QueryDownloadOptions) => Promise<void>;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  onDownload,
}) => {
  const [open, setOpen] = useState(false);

  // console.log(Spinner);

  return (
    <>
      <StyledDownloadIcon
        onClick={() => setOpen(true)}
        width={26}
        height={26}
      />
      <Popover
        open={open}
        setOpen={setOpen}
        width={200}
        offsetSkidding={10}
        offsetDistance={0}
      >
        <PopoverContent>
          <DownloadForm
            onDownload={async (options) => {
              onDownload(options);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
};

const PopoverContent = styled.div`
  padding: 15px;
`;

const StyledDownloadIcon = styled(DownloadIcon)`
  cursor: pointer;
  .hoverfill {
    fill: transparent;
  }
  .primaryfill {
    fill: #d4d6d8;
  }
  &:hover {
    .hoverfill {
      fill: rgb(240, 246, 255);
    }
    .primaryfill {
      fill: #4285f4;
    }
  }
`;
