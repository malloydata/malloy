/*
 * Copyright 2021 Google LLC
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

import React, { RefObject, useRef, useState } from "react";
import styled from "styled-components";
import { useClickOutside } from "../hooks";
import { usePopper } from "react-popper";
import { Placement } from "@popperjs/core";

interface PopoverProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  width?: number;
  maxHeight?: number;
  placement?: Placement;
  referenceDiv?: RefObject<HTMLDivElement>;
  zIndex?: number;
  xOffset?: number;
  yOffset?: number;
  disabled?: boolean;
}

export const PopoverBox = styled.div<{
  width: number;
  zIndex: number;
}>`
  border: 1px solid #ececed;
  border-radius: 4px;
  position: fixed;
  box-shadow: 0px 1px 5px 1px #0000001a;
  background-color: white;
  font-size: 14px;
  ${({ width, zIndex }) => `
    width: ${width}px;
    z-index: ${zIndex};
  `}
`;

const Wrapper = styled.div`
  position: relative;
`;

export const Popover: React.FC<PopoverProps> = ({
  open,
  setOpen,
  children,
  width = 350,
  placement = "right-start",
  referenceDiv,
  zIndex = 10,
  xOffset = 0,
  yOffset = 10,
  disabled = false,
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [tooltipRef, setTooltipRef] = useState<HTMLElement | null>(null);

  const { styles, attributes } = usePopper(
    referenceDiv?.current || triggerRef.current,
    tooltipRef,
    {
      placement,
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [xOffset, yOffset],
          },
        },
        {
          name: "preventOverflow",
          options: {
            altAxis: true,
            padding: 20,
            boundary: document.getElementsByTagName("body")[0],
          },
        },
        {
          name: "flip",
          options: {
            flipVariations: false,
          },
        },
      ],
    }
  );

  useClickOutside(triggerRef, () => setOpen(false));

  return (
    <Wrapper ref={triggerRef}>
      {open && !disabled && (
        <PopoverBox
          width={width}
          ref={setTooltipRef}
          style={{ ...styles.popper, position: "fixed" }}
          {...attributes.popper}
          zIndex={zIndex}
        >
          {children}
        </PopoverBox>
      )}
    </Wrapper>
  );
};
