/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
