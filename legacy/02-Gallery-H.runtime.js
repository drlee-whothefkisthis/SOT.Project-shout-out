window.ShoutGallery = window.ShoutGallery || {};
window.__SHOUT_CART_ICON_URL__ = "https://cdn.prod.website-files.com/691e5df3002228c301997066/695220517923951d43b98518_Interface-%2F-Shopping_Cart_02.svg";
window.ShoutGallery.buildCartLockIconEl = (() => {
  let cartLockSvgTemplate = null;

  return function buildCartLockIconEl() {
    const iconUrl = String((window.__SHOUT_CART_ICON_URL__ || "")).trim();
    const wrap = document.createElement("div");
    wrap.className = "cart-lock-icon";
    wrap.setAttribute("aria-hidden", "true");

    if (iconUrl) {
      const img = document.createElement("img");
      img.src = iconUrl;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      try { img.decoding = "async"; } catch (e) {}
      wrap.appendChild(img);
      return wrap;
    }

    if (!cartLockSvgTemplate) {
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "white");
      svg.setAttribute("stroke-width", "1.8");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");

      const c1 = document.createElementNS(svgNS, "circle");
      c1.setAttribute("cx", "9");
      c1.setAttribute("cy", "20");
      c1.setAttribute("r", "1");

      const c2 = document.createElementNS(svgNS, "circle");
      c2.setAttribute("cx", "18");
      c2.setAttribute("cy", "20");
      c2.setAttribute("r", "1");

      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", "M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.6L22 7H6");

      svg.appendChild(c1);
      svg.appendChild(c2);
      svg.appendChild(p);
      cartLockSvgTemplate = svg;
    }

    wrap.appendChild(cartLockSvgTemplate.cloneNode(true));
    return wrap;
  };
})();

function mountGalleryViewportBottomMask() {
  if (document.getElementById("galleryViewportBottomMask")) return;
  const mask = document.createElement("div");
  mask.id = "galleryViewportBottomMask";
  mask.className = "gallery-viewport-bottom-mask";
  mask.setAttribute("aria-hidden", "true");
  document.body.appendChild(mask);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountGalleryViewportBottomMask, { once: true });
} else {
  mountGalleryViewportBottomMask();
}

window.ShoutGallery.getGalleryGridCoveredBottom = function (gridEl) {
  const grid = gridEl.getBoundingClientRect();
  const match = String(gridEl.style.gridTemplateColumns).match(/repeat\((\d+)/);
  const cols = Number(match && match[1]) || 3;
  const cards = Array.from(gridEl.querySelectorAll(".gallery-card"), (card) => card.getBoundingClientRect());
  let shortestBottom = Infinity;

  for (let i = 0; i < cols; i += 1) {
    const x = grid.left + (grid.width * (i + .5) / cols);
    let columnBottom = -Infinity;

    cards.forEach((card) => {
      if (card.left <= x && card.right >= x) columnBottom = Math.max(columnBottom, card.bottom);
    });
    shortestBottom = Math.min(shortestBottom, columnBottom);
  }

  return Number.isFinite(shortestBottom) ? shortestBottom : grid.bottom;
};
