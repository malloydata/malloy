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

import { useState } from "react";
import { useMutation } from "react-query";

interface UseOpenDirectoryResult {
  openDirectory: string | undefined;
  beginOpenDirectory: () => void;
  isOpeningDirectory: boolean;
}

export function useOpenDirectory(): UseOpenDirectoryResult {
  const [openDirectory, setOpenDirectory] = useState<string>();
  const { mutateAsync, isLoading: isOpeningDirectory } = useMutation(
    () => window.malloy.openDirectory(),
    {}
  );

  const beginOpenDirectory = async () => {
    const res = await mutateAsync();
    if (res instanceof Error) {
      throw res;
    }
    const openDirectory = res;
    if (openDirectory != undefined) {
      setOpenDirectory(openDirectory);
    }
  };

  return {
    openDirectory,
    beginOpenDirectory,
    isOpeningDirectory,
  };
}
