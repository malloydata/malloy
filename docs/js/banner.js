const banner = document.getElementById("banner");

function onBannerClick() {
  try {
    localStorage.setItem("cookie-clicked", true);
    banner.classList.add("hidden");
  } catch {
    /* ignore */
  }
}

try {
  if (localStorage.getItem("cookie-clicked") === "true") {
    banner.classList.add("hidden");
  }
} catch {
  /* ignore */
}

document
  .getElementById("banner_button")
  .addEventListener("click", onBannerClick);
