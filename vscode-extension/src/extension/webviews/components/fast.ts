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

import { provideReactWrapper } from "@microsoft/fast-react-wrapper";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDivider,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeProgressRing,
  vsCodeRadio,
  vsCodeTag,
  vsCodeTextField,
} from "@vscode/webview-ui-toolkit";
import React from "react";

const { wrap } = provideReactWrapper(React, provideVSCodeDesignSystem());

export const VSCodeButton = wrap(vsCodeButton());
export const VSCodeDropdown = wrap(vsCodeDropdown(), {
  events: {
    onChange: "change",
  },
});
export const VSCodeOption = wrap(vsCodeOption());
export const VSCodeTextField = wrap(vsCodeTextField(), {
  events: {
    onChange: "change",
  },
});
export const VSCodeRadio = wrap(vsCodeRadio(), {
  events: {
    onChange: "change",
  },
});
export const VSCodeDivider = wrap(vsCodeDivider());
export const VSCodeTag = wrap(vsCodeTag());
export const VSCodeProgressRing = wrap(vsCodeProgressRing());
export const VSCodeCheckbox = wrap(vsCodeCheckbox(), {
  events: {
    onChange: "change",
  },
});
