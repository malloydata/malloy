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

import { ReactElement, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Popover } from "../Popover";

interface HoverToPopoverProps {
  popoverContent: (props: {
    setOpen: (open: boolean) => void;
    closeMenu: () => void;
  }) => ReactElement | null;
  content: (props: { isOpen: boolean; closeMenu: () => void }) => ReactElement;
}

export const HoverToPopover: React.FC<HoverToPopoverProps> = ({
  popoverContent,
  content,
}) => {
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    closing.current = true;
    setOpen(false);
  };

  useEffect(() => {
    closing.current = false;
  }, [open]);

  return (
    <>
      <HoverToPopoverDiv
        onMouseEnter={() => !closing.current && setOpen(true)}
        onMouseLeave={closeMenu}
      >
        <div ref={ref}>{content({ isOpen: open, closeMenu })}</div>
        {(() => {
          const content = popoverContent({ setOpen, closeMenu });
          return (
            <Popover
              open={open && content !== null}
              setOpen={setOpen}
              referenceDiv={ref}
              zIndex={11}
            >
              {content}
            </Popover>
          );
        })()}
      </HoverToPopoverDiv>
    </>
  );
};

const HoverToPopoverDiv = styled.div`
  position: relative;
`;
