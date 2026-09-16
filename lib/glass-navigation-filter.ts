let sequence = 0;

export function createGlassNavigationFilter(host: HTMLElement) {
  const document = host.ownerDocument;

  function node(name: string, attributes: Record<string, string> = {}) {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      name,
    );

    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);

    return element;
  }
  const svg = node("svg", {
    "aria-hidden": "true",
    "data-glass-navigation-filter": "",
  });

  svg.setAttribute(
    "style",
    "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none",
  );
  const id = `glass-navigation-${++sequence}`;
  const filter = node("filter", {
    id,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const input = node("feOffset", {
    in: "SourceGraphic",
    result: "strip-input",
  });
  const output = node("feOffset", { in: "glass", result: "strip-output" });
  const mask = node("feFlood", {
    "flood-color": "white",
    result: "strip-mask",
  });
  const merge = node("feMerge");

  merge.append(
    node("feMergeNode", { in: "sharp" }),
    node("feMergeNode", { in: "strip-output" }),
  );
  filter.append(
    input,
    node("feGaussianBlur", {
      in: "strip-input",
      stdDeviation: "8",
      result: "blur",
    }),
    node("feColorMatrix", {
      in: "blur",
      type: "saturate",
      values: "1.5",
      result: "glass",
    }),
    output,
    mask,
    node("feComposite", {
      in: "SourceGraphic",
      in2: "strip-mask",
      operator: "out",
      result: "sharp",
    }),
    merge,
  );
  svg.append(filter);
  document.body.append(svg);
  host.style.setProperty("--glass-navigation-filter", `url("#${id}")`);
  host.setAttribute("data-glass-navigation-card", "");
  function rect(
    element: Element,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    for (const [key, value] of Object.entries({ x, y, width, height }))
      if (element.getAttribute(key) !== String(value))
        element.setAttribute(key, String(value));
  }

  return {
    update(bounds: DOMRect, header: DOMRect) {
      const y = header.top - bounds.top;

      rect(filter, -32, -32, bounds.width + 64, bounds.height + 64);
      rect(input, -32, y - 32, bounds.width + 64, header.height + 64);
      rect(output, -32, y, bounds.width + 64, header.height);
      rect(mask, -32, y, bounds.width + 64, header.height);
    },
    dispose() {
      host.removeAttribute("data-glass-navigation-card");
      host.style.removeProperty("--glass-navigation-filter");
      svg.remove();
    },
  };
}
