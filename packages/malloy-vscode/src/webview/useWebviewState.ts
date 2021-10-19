import { useContext, useEffect, useState } from "react";
import { VSCodeContext } from "./vscodeContext";

export function useWebviewState<T>(
  key: string,
  initial: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const vscode = useContext(VSCodeContext);

  const setValueOuter = (value: T) => {
    const state = vscode.getState() || {};
    vscode.setState({ ...state, [key]: value });
    setValue(value);
  };

  useEffect(() => {
    const state = vscode.getState() || {};
    setValue(state[key]);
  });

  return [value, setValueOuter];
}
