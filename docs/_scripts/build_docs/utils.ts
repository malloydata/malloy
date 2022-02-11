/*
 * Copyright 2022 Google LLC
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

import fs from "fs";
import path from "path";

export function isMarkdown(file: string): boolean {
  return file.endsWith(".md");
}

export function timeString(start: number, end: number): string {
  return `${((end - start) / 1000).toLocaleString()}s`;
}

/*
 * Get a list of files that appear in a directory or any of its subdirectories,
 * recursively.
 */
export function readDirRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const absolutePath = path.join(dir, file);
    if (fs.statSync(absolutePath).isDirectory()) {
      files.push(...readDirRecursive(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }
  return files;
}

/*
 * Get a list of directories contained in a directory or any of its
 * subdirectories, recursively.
 */
export function getDirsRecursive(dir: string): string[] {
  const directories: string[] = [dir];
  for (const file of fs.readdirSync(dir)) {
    const absolutePath = path.join(dir, file);
    if (fs.statSync(absolutePath).isDirectory()) {
      directories.push(...getDirsRecursive(absolutePath));
    }
  }
  return directories;
}

/*
 * Escape a string for HTML, including `&`, `<`, `>`, `"`, and `'`. Simple and not very
 * rigorous.
 */
export function escape(html: string): string {
  return html.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch] || "")
  );
}

export function watchDebounced(
  location: string,
  callback: (type: "rename" | "change", file: string) => void
): void {
  const cancelers = new Map<string, () => void>();
  const debouncedCallback = (type: "rename" | "change", file: string) => {
    const cancelPrevious = cancelers.get(file);
    if (cancelPrevious) cancelPrevious();
    let canceled = false;
    cancelers.set(file, () => {
      canceled = true;
    });
    setTimeout(() => {
      if (!canceled) {
        callback(type, file);
      }
    }, 100);
  };

  fs.watch(location, (type, file) => {
    debouncedCallback(type, file);
  });
}

export function watchDebouncedRecursive(
  dir: string,
  callback: (type: "rename" | "change", file: string) => void
): void {
  const allDirs = getDirsRecursive(dir);

  allDirs.forEach((subdir) => {
    watchDebounced(subdir, (type, file) => {
      callback(type, path.join(subdir, file).substring(dir.length));
    });
  });
}
