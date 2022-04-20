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

import { RefObject, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { ColorKey, COLORS } from "../colors";
import { ReactComponent as CloseIcon } from "../assets/img/query_clear_hover.svg";
import { useClickOutside } from "../hooks";

interface PillInputProps {
  // TODO it should be required that if value is set, setValue is also set...
  value?: string;
  setValue?: (value: string) => void;
  values: string[];
  setValues: (values: string[]) => void;
  autoFocus?: boolean;
  placeholder?: string;
  type?: string;
  focusElement?: RefObject<HTMLDivElement>;
}

export const PillInput: React.FC<PillInputProps> = ({
  values,
  setValues,
  autoFocus,
  placeholder,
  type = "text",
  value: controlledValue,
  setValue: setControlledValue,
  focusElement,
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [selectedPill, setSelectedPill] = useState<number | undefined>(
    undefined
  );

  const value = controlledValue || uncontrolledValue;
  const setValue = setControlledValue || setUncontrolledValue;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Backspace") {
        if (selectedPill !== undefined) {
          const newValues = [...values];
          newValues.splice(selectedPill, 1);
          setValues(newValues);
          if (selectedPill === 0) {
            if (values.length === 1) {
              setSelectedPill(undefined);
              inp.current?.focus();
            } else {
              setSelectedPill(0);
            }
          } else {
            setSelectedPill(selectedPill - 1);
          }
        }
      } else if (event.key === "ArrowRight") {
        if (selectedPill === values.length - 1) {
          setSelectedPill(undefined);
          inp.current?.focus();
        } else if (selectedPill !== undefined) {
          setSelectedPill(selectedPill + 1);
        }
      } else if (event.key === "ArrowLeft") {
        if (selectedPill !== undefined && selectedPill > 0) {
          setSelectedPill(selectedPill - 1);
        }
      } else {
        inp.current?.focus();
      }
    };
    window.addEventListener("keyup", handler);
    return () => window.removeEventListener("keyup", handler);
  });

  const commitValue = () => {
    if (value.length > 0) {
      setValues([...values, value]);
      setValue("");
    }
  };

  useClickOutside(focusElement ? [ref, focusElement] : ref, () => {
    setFocused(false);
    commitValue();
  });

  return (
    <OuterInput
      onClick={() => inp.current?.focus()}
      isFocused={focused || selectedPill !== undefined}
      ref={ref}
    >
      {values.map((value, index) => (
        <Pill
          key={index}
          isSelected={selectedPill === index}
          onClick={(event) => {
            setSelectedPill(index);
            event.stopPropagation();
          }}
        >
          {value}
        </Pill>
      ))}
      <StyledInput
        ref={inp}
        type={type}
        placeholder={values.length === 0 ? placeholder : ""}
        value={value}
        size={1}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            if (value !== "") {
              commitValue();
              event.stopPropagation();
              event.preventDefault();
            }
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Backspace") {
            if (value === "" && values.length > 0) {
              commitValue();
              inp.current?.blur();
              setSelectedPill(values.length - 1);
            }
          } else if (event.key === "ArrowLeft") {
            if (
              inp.current?.selectionStart === 0 ||
              inp.current?.selectionStart === null
            ) {
              commitValue();
              inp.current?.blur();
              setSelectedPill(values.length - 1);
              event.preventDefault();
              event.stopPropagation();
            }
          }
        }}
        onFocus={() => {
          setFocused(true);
          setSelectedPill(undefined);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        autoFocus={autoFocus}
      />
    </OuterInput>
  );
};

const OuterInput = styled.div<{
  isFocused: boolean;
}>`
  font-family: Roboto;
  font-size: 14px;
  font-weight: normal;
  border-radius: 5px;
  border: 1px solid #efefef;
  padding: 2px 3px;
  outline: none;
  display: flex;
  overflow: hidden;
  gap: 3px;
  flex-wrap: wrap;

  ${({ isFocused }) => (isFocused ? `border-color: #4285F4;` : "")}
`;

const Pill = styled.div<{
  isSelected: boolean;
}>`
  ${({ isSelected }) => `
    border: 1px solid ${
      isSelected ? COLORS.dimension.fillStrong : COLORS.dimension.fillMedium
    };
    background-color: ${
      isSelected ? COLORS.dimension.fillMedium : COLORS.dimension.fillLight
    };
  `}

  border-radius: 5px;
  color: ${COLORS.dimension.fillStrong};
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 5px;
  text-transform: none;
  cursor: pointer;
  height: 20px;
`;

const StyledInput = styled.input`
  border: none;
  outline: none;
  font-family: Roboto;
  font-size: 14px;
  min-width: 95px;
  padding: 3.75px 7px;
  flex-grow: 1;
`;

export const CloseIconStyled = styled(CloseIcon)<{
  color: ColorKey;
}>`
  cursor: pointer;
  ${({ color }) => {
    return `
      .cross {
        fill: ${COLORS[color].fillStrong};
      }
    `;
  }}
`;
