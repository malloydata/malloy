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

import { useRef } from "react";
import styled from "styled-components";
import { useClickOutside } from "../hooks";
import { PopoverBox } from "../Popover/Popover";

interface ModalProps {
  dimBackground?: boolean;
  clickOutsideToClose?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const Modal: React.FC<ModalProps> = ({
  dimBackground = true,
  children,
  clickOutsideToClose = true,
  open,
  setOpen,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, () => {
    if (clickOutsideToClose) {
      setOpen(false);
    }
  });

  return open ? (
    <OuterDiv dimBackground={dimBackground}>
      <PopoverBox ref={modalRef} width={600} zIndex={10}>
        {children}
      </PopoverBox>
    </OuterDiv>
  ) : null;
};

const OuterDiv = styled.div<{
  dimBackground: boolean;
}>`
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;

  ${({ dimBackground }) => `
    background-color: ${
      dimBackground ? "rgba(50, 50, 50, 0.2)" : "transparent"
    };
  `}
`;
