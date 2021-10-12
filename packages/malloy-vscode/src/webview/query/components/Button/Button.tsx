import React from "react";
import styled from "styled-components";

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  inverted?: boolean;
  color?: "success" | "primary";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  disabled,
  inverted,
  color,
  onClick,
}) => {
  return (
    <StyledButton
      disabled={disabled}
      onClick={onClick}
      className={inverted ? "inverted" : ""}
      color={color || "primary"}
    >
      {children}
    </StyledButton>
  );
};

const COLORS = {
  success: { main: "green", hover: "darkgreen" },
  primary: { main: "#007ad2", hover: "rgb(0, 98, 168" },
};

const mainColor = ({ color }: { color: "success" | "primary" }) =>
  COLORS[color].main;

const hoverColor = ({ color }: { color: "success" | "primary" }) =>
  COLORS[color].main;

const StyledButton = styled.button<{ color: "success" | "primary" }>`
  border: 1px solid ${mainColor};
  background-color: ${mainColor};
  color: white;
  border-radius: 0;
  padding: 4px 17px;
  cursor: pointer;

  &:hover {
    background-color: ${hoverColor};
  }

  &[disabled] {
    background-color: rgb(25, 25, 25);
  }

  &.inverted {
    background-color: rgb(204, 204, 204);
    color: #5f5f5f;
    border-color: rgb(204, 204, 204);

    &[disabled] {
      background-color: ${mainColor};
      color: white;
      border-color: ${mainColor};
    }
  }
`;
