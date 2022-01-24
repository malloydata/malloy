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
