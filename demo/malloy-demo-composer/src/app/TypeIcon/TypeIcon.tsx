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

import { ReactComponent as TypeIconBoolean } from "../assets/img/type_icons/type-icon-on-off.svg";
import { ReactComponent as TypeIconDate } from "../assets/img/type_icons/type-icon-date.svg";
import { ReactComponent as TypeIconNumber } from "../assets/img/type_icons/type-icon-number.svg";
import { ReactComponent as TypeIconString } from "../assets/img/type_icons/type-icon-string.svg";
import { ReactComponent as TypeIconQuery } from "../assets/img/type_icons/type-icon-projection.svg";
import { ReactComponent as TypeIconSource } from "../assets/img/type_icons/type-icon-projection.svg";
import { ReactComponent as TypeIconMeasure } from "../assets/img/type_icons/type-icon-number-measure.svg";

interface TypeIconProps {
  type:
    | "string"
    | "boolean"
    | "number"
    | "date"
    | "timestamp"
    | "query"
    | "source";
  kind: "measure" | "dimension" | "query" | "source";
}

export const TypeIcon: React.FC<TypeIconProps> = ({ type, kind }) => {
  const sizeProps = { width: "22px", height: "22px" };
  if (kind === "measure") {
    return <TypeIconMeasure {...sizeProps} />;
  } else if (type === "string") {
    return <TypeIconString {...sizeProps} />;
  } else if (type === "boolean") {
    return <TypeIconBoolean {...sizeProps} />;
  } else if (type === "number") {
    return <TypeIconNumber {...sizeProps} />;
  } else if (type === "date") {
    return <TypeIconDate {...sizeProps} />;
  } else if (type === "timestamp") {
    return <TypeIconDate {...sizeProps} />;
  } else if (type === "query") {
    return <TypeIconQuery {...sizeProps} />;
  } else if (type === "source") {
    return <TypeIconSource {...sizeProps} />;
  }
  throw new Error("Invalid icon type");
};
