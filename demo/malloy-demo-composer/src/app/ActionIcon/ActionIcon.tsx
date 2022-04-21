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

import { ReactComponent as ActionIconGroupBy } from "../assets/img/insert_icons/insert_group_by.svg";
import { ReactComponent as ActionIconAggregate } from "../assets/img/insert_icons/insert_measure.svg";
import { ReactComponent as InsertFilter } from "../assets/img/insert_icons/insert_filter.svg";
import { ReactComponent as InsertLimit } from "../assets/img/insert_icons/insert_limit.svg";
import { ReactComponent as InsertNest } from "../assets/img/insert_icons/insert_nest.svg";
import { ReactComponent as ActionIconOrderBy } from "../assets/img/insert_icons/insert_order_by.svg";
import { ReactComponent as ActionItemRename } from "../assets/img/insert_icons/item_rename.svg";
import { ReactComponent as ActionIconEdit } from "../assets/img/insert_icons/item_edit.svg";
import { ReactComponent as ActionItemRemove } from "../assets/img/query_clear_hover.svg";
import { ReactComponent as ActionItemAdd } from "../assets/img/query_add_hover.svg";
import { ReactComponent as ActionItemSave } from "../assets/img/save_icon.svg";
import { ReactComponent as ActionItemContainerClosed } from "../assets/img/chevrons/chevron_right.svg";
import { ReactComponent as ActionItemContainerOpen } from "../assets/img/chevrons/chevron_down.svg";
import { ReactComponent as ActionItemDuplicate } from "../assets/img/insert_icons/item_duplicate.svg";
import { ReactComponent as VisIconScatterChart } from "../assets/img/vis_icons/viz_scatter.svg";
import { ReactComponent as ActionIconError } from "../assets/img/insert_icons/alert_outline.svg";
import { ReactComponent as ActionIconPipeline } from "../assets/img/insert_icons/pipeline.svg";
import { ReactComponent as ActionIconLoad } from "../assets/img/type_icons/type-icon-projection.svg";
import { ReactComponent as ActionIconMove } from "../assets/img/insert_icons/move_icon_outline.svg";
import { ReactComponent as ActionIconSearch } from "../assets/img/insert_icons/search.svg";
import { ReactComponent as AnalysisIcon } from "../assets/img/source.svg";
import { ColorKey, COLORS } from "../colors";
import styled from "styled-components";

export type ActionIconName =
  | "group_by"
  | "aggregate"
  | "filter"
  | "limit"
  | "nest"
  | "order_by"
  | "remove"
  | "rename"
  | "add"
  | "save"
  | "container-closed"
  | "container-open"
  | "duplicate"
  | "style"
  | "stage"
  | "error"
  | "load"
  | "move"
  | "edit"
  | "search"
  | "analysis";

interface ActionIconProps {
  action: ActionIconName;
  onClick?: () => void;
  color?: ColorKey;
}

export const ActionIcon: React.FC<ActionIconProps> = ({
  action,
  onClick,
  color,
}) => {
  const sizeProps = { width: "22px", height: "22px" };
  const otherProps = {
    onClick,
    style: { cursor: onClick ? "pointer" : "unset" },
  };
  const props = { ...sizeProps, ...otherProps };
  return (
    <IconWrapper color={color} doHover={onClick !== undefined}>
      {action === "group_by" ? (
        <ActionIconGroupBy {...props} />
      ) : action === "aggregate" ? (
        <ActionIconAggregate {...props} />
      ) : action === "filter" ? (
        <InsertFilter {...props} />
      ) : action === "limit" ? (
        <InsertLimit {...props} />
      ) : action === "nest" ? (
        <InsertNest {...props} />
      ) : action === "order_by" ? (
        <ActionIconOrderBy {...props} />
      ) : action === "remove" ? (
        <ActionItemRemove {...props} />
      ) : action === "rename" ? (
        <ActionItemRename {...props} />
      ) : action === "add" ? (
        <ActionItemAdd {...props} />
      ) : action === "save" ? (
        <ActionItemSave {...props} />
      ) : action === "container-open" ? (
        <ActionItemContainerOpen {...props} />
      ) : action === "container-closed" ? (
        <ActionItemContainerClosed {...props} />
      ) : action === "duplicate" ? (
        <ActionItemDuplicate {...props} />
      ) : action === "style" ? (
        <VisIconScatterChart {...props} />
      ) : action === "stage" ? (
        <ActionIconPipeline {...props} />
      ) : action === "error" ? (
        <ActionIconError {...props} />
      ) : action === "load" ? (
        <ActionIconLoad {...props} />
      ) : action === "move" ? (
        <ActionIconMove {...props} />
      ) : action === "edit" ? (
        <ActionIconEdit {...props} />
      ) : action === "search" ? (
        <ActionIconSearch {...props} />
      ) : action === "analysis" ? (
        <AnalysisIcon {...props} />
      ) : null}
    </IconWrapper>
  );
};

export const IconWrapper = styled.div<{
  color: ColorKey | undefined;
  doHover: boolean;
}>`
  display: flex;
  ${({ color, doHover }) => {
    if (color === undefined) return "";
    return `
      svg .hoverfill {
        fill: transparent;
      }
      ${
        color !== undefined &&
        `
        svg .primaryfill {
          fill: ${COLORS[color].fillStrong};
        }
        svg .primarystroke {
          stroke: ${COLORS[color].fillStrong};
        }
      `
      }
      ${
        color !== undefined &&
        doHover &&
        `
        svg:hover .hoverfill {
          fill: ${COLORS[color].fillLight};
        }
      `
      }
    `;
  }}
`;
