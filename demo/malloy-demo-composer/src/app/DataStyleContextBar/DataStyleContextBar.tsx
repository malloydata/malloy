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

import styled from "styled-components";
import { RendererName } from "../../types";
import {
  ContextMenuContent,
  ContextMenuOuter,
  ScrollMain,
} from "../CommonElements";
import { FieldButton } from "../FieldButton";
import { VisIcon } from "../VisIcon";

interface DataStyleContextBarProps {
  setDataStyle: (rendererName: RendererName) => void;
  onComplete: () => void;
  allowedRenderers: RendererName[];
}

export const DataStyleContextBar: React.FC<DataStyleContextBarProps> = ({
  setDataStyle,
  onComplete,
  allowedRenderers,
}) => (
  <ContextMenuOuter>
    <ScrollMain>
      <ContextMenuContent>
        <ListDiv>
          {allowedRenderers.map((renderer) => {
            return (
              <FieldButton
                icon={<VisIcon renderer={renderer} />}
                key={renderer}
                onClick={() => {
                  setDataStyle(renderer);
                  onComplete();
                }}
                name={renderer}
                color="other"
              />
            );
          })}
        </ListDiv>
      </ContextMenuContent>
    </ScrollMain>
  </ContextMenuOuter>
);

const ListDiv = styled.div`
  overflow: hidden;
  display: flex;
  gap: 2px;
  flex-direction: column;
`;
