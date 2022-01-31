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

import React, { useRef, useState } from "react";
import { VSCodeTextField } from "../components/fast";

export const App: React.FC = () => {
  const [searchText, setSearchText] = useState("");

  const queryURL = `https://looker-open-source.github.io/malloy/search?query=${new URLSearchParams(
    { query: searchText }
  ).toString()}`;

  return (
    <div>
      <VSCodeTextField
        value={searchText}
        onChange={(event) => {
          setSearchText((event.target as any).value);
        }}
        placeholder="Search"
        id="search-input"
        name="query"
      />
      <a href={queryURL}>Search</a>
    </div>
  );
};
