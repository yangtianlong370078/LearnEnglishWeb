import {
  getGlassBlurPadding,
  getGlassBlurPx,
  glassConfig,
} from "@/config/glass";

const svgNamespace = "http://www.w3.org/2000/svg";
let nextFilterId = 0;

/** Blur the page's own paint, without asking the compositor to read its backdrop. */
export function createGlassSourceFilter(document: Document) {
  const page = document.querySelector<HTMLElement>(".app-shell");
  const view = document.defaultView;

  if (!page || !view) return () => {};

  function node(name: string, attributes: Record<string, string> = {}) {
    const element = document.createElementNS(svgNamespace, name);

    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }

    return element;
  }

  const svg = node("svg", {
    "aria-hidden": "true",
    "data-glass-source-filter": "",
  });
  const id = `app-glass-source-${++nextFilterId}`;
  const filter = node("filter", {
    id,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const source = node("feOffset", { in: "SourceGraphic", result: "source" });
  const merge = node("feMerge");
  const edges = Array.from({ length: 8 }, (_, index) => {
    const crop = node("feOffset", {
      in: "SourceGraphic",
      result: `edge-${index}`,
    });
    const tile = node("feTile", {
      in: `edge-${index}`,
      result: `pad-${index}`,
    });

    filter.append(crop, tile);

    return { crop, tile };
  });

  merge.append(node("feMergeNode", { in: "source" }));
  for (let index = 0; index < edges.length; index++) {
    merge.append(node("feMergeNode", { in: `pad-${index}` }));
  }
  filter.prepend(source);
  const blur = node("feGaussianBlur");

  filter.append(
    merge,
    blur,
    node("feColorMatrix", {
      type: "saturate",
      values: String(glassConfig.saturation / 100),
    }),
  );
  svg.append(filter);
  // Keep SVG definitions outside the filtered source and the document flow.
  svg.setAttribute(
    "style",
    "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none",
  );
  document.body.append(svg);

  const properties = [
    "--glass-source-filter",
    "--glass-source-x",
    "--glass-source-y",
    "--glass-source-width",
    "--glass-source-height",
  ];
  const previous = properties.map((property) => [
    property,
    page.style.getPropertyValue(property),
    page.style.getPropertyPriority(property),
  ]);
  let frame = 0;
  let lastViewport = "";

  function rect(
    element: Element,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    for (const [key, value] of Object.entries({ x, y, width, height })) {
      element.setAttribute(key, String(value));
    }
  }

  function update() {
    frame = 0;
    if (!page || !view) return;

    const bounds = page.getBoundingClientRect();
    const x = -bounds.left;
    const y = -bounds.top;
    const width = view.innerWidth;
    const height = view.innerHeight;
    const pixel = 1 / view.devicePixelRatio;
    const mode = document.documentElement.dataset.glassMode;
    const blurPx = getGlassBlurPx(mode);
    const viewport = [x, y, width, height, pixel, blurPx].join(",");

    if (viewport === lastViewport) return;
    lastViewport = viewport;
    blur.setAttribute("stdDeviation", String(blurPx));

    // CSS SVG filters do not reliably implement edgeMode="duplicate". Repeat
    // the outermost device pixel explicitly, so blur never samples transparent
    // space outside the viewport. Padding follows the configured blur radius.
    const pad = getGlassBlurPadding(mode);
    const patches = [
      [x, y, width, pixel, x, y - pad, width, pad],
      [x, y + height - pixel, width, pixel, x, y + height, width, pad],
      [x, y, pixel, height, x - pad, y, pad, height],
      [x + width - pixel, y, pixel, height, x + width, y, pad, height],
      [x, y, pixel, pixel, x - pad, y - pad, pad, pad],
      [x + width - pixel, y, pixel, pixel, x + width, y - pad, pad, pad],
      [x, y + height - pixel, pixel, pixel, x - pad, y + height, pad, pad],
      [
        x + width - pixel,
        y + height - pixel,
        pixel,
        pixel,
        x + width,
        y + height,
        pad,
        pad,
      ],
    ];

    rect(filter, x - pad, y - pad, width + pad * 2, height + pad * 2);
    rect(source, x, y, width, height);
    edges.forEach(({ crop, tile }, index) => {
      const [sx, sy, sw, sh, tx, ty, tw, th] = patches[index];

      rect(crop, sx, sy, sw, sh);
      rect(tile, tx, ty, tw, th);
    });
    page.style.setProperty("--glass-source-x", `${x}px`);
    page.style.setProperty("--glass-source-y", `${y}px`);
    page.style.setProperty("--glass-source-width", `${width}px`);
    page.style.setProperty("--glass-source-height", `${height}px`);
  }

  function scheduleUpdate() {
    if (!frame) frame = view!.requestAnimationFrame(update);
  }

  update();
  page.style.setProperty("--glass-source-filter", `url("#${id}")`);
  document.body.setAttribute("data-glass-source-blur", "");
  // React Aria may reserve the scrollbar after the overlay ref attaches.
  scheduleUpdate();
  view.addEventListener("resize", scheduleUpdate);
  view.addEventListener("scroll", scheduleUpdate, { passive: true });
  view.visualViewport?.addEventListener("resize", scheduleUpdate);
  view.visualViewport?.addEventListener("scroll", scheduleUpdate);
  const modeObserver = new MutationObserver(scheduleUpdate);

  modeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-glass-mode"],
  });

  return () => {
    modeObserver.disconnect();
    view.cancelAnimationFrame(frame);
    view.removeEventListener("resize", scheduleUpdate);
    view.removeEventListener("scroll", scheduleUpdate);
    view.visualViewport?.removeEventListener("resize", scheduleUpdate);
    view.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    document.body.removeAttribute("data-glass-source-blur");
    for (const [property, value, priority] of previous) {
      if (value) page.style.setProperty(property, value, priority);
      else page.style.removeProperty(property);
    }
    svg.remove();
  };
}
