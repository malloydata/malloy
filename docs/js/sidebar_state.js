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

function toggleTab(tabElement) {
  const classList = tabElement.classList;
  const isCollapsed = classList.contains("collapsed");
  if (isCollapsed) {
    classList.remove("collapsed");
  } else {
    classList.add("collapsed");
  }
  setCollapsed(tabElement.id, !isCollapsed);
}

function getCollapseState() {
  try {
    return JSON.parse(localStorage.getItem("collapse_state")) || {};
  } catch (_error) {
    return {};
  }
}

function setCollapseState(collapseState) {
  localStorage.setItem("collapse_state", JSON.stringify(collapseState));
}

function setCollapsed(id, isCollapsed) {
  const collapseState = getCollapseState();
  collapseState[id] = isCollapsed;
  setCollapseState(collapseState);
}

function getCollapsed(id) {
  const collapseState = getCollapseState();
  const isCollapsed = collapseState[id];
  return isCollapsed === undefined ? true : isCollapsed;
}

Array.from(document.getElementsByClassName("sidebar-section-title")).forEach(
  (element) => {
    if (!getCollapsed(element.id)) {
      element.classList.remove("collapsed");
    }
    element.addEventListener("click", () => toggleTab(element));
  }
);

const sidebarElement = document.getElementById("sidebar");
sidebarElement.addEventListener("scroll", () => {
  localStorage.setItem("sidebar_scroll_position", sidebarElement.scrollTop);
});
sidebarElement.scrollTop = localStorage.getItem("sidebar_scroll_position") || 0;
