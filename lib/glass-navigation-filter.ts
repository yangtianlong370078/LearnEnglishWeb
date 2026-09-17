import { glassBlurPadding, glassConfig } from "@/config/glass";

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
      stdDeviation: String(glassConfig.blurPx),
      result: "blur",
    }),
    node("feColorMatrix", {
      in: "blur",
      type: "saturate",
      values: String(glassConfig.saturation / 100),
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
    element.setAttribute("x", String(x));
    element.setAttribute("y", String(y));
    element.setAttribute("width", String(width));
    element.setAttribute("height", String(height));
  }
  let previousWidth = NaN;
  let previousHeight = NaN;
  let previousHeaderHeight = NaN;
  let previousY = NaN;

  return {
    update(bounds: DOMRect, header: DOMRect) {
      const y = header.top - bounds.top;
      const pad = glassBlurPadding;

      if (
        bounds.width !== previousWidth ||
        bounds.height !== previousHeight ||
        header.height !== previousHeaderHeight
      ) {
        rect(
          filter,
          -pad,
          -pad,
          bounds.width + pad * 2,
          bounds.height + pad * 2,
        );
        rect(
          input,
          -pad,
          y - pad,
          bounds.width + pad * 2,
          header.height + pad * 2,
        );
        rect(output, -pad, y, bounds.width + pad * 2, header.height);
        rect(mask, -pad, y, bounds.width + pad * 2, header.height);
        previousWidth = bounds.width;
        previousHeight = bounds.height;
        previousHeaderHeight = header.height;
      } else if (y !== previousY) {
        // Ordinary scrolling changes only the strip's vertical coordinate.
        // Keep invariant dimensions in JS instead of reading SVG attributes.
        input.setAttribute("y", String(y - pad));
        output.setAttribute("y", String(y));
        mask.setAttribute("y", String(y));
      }
      previousY = y;
    },
    dispose() {
      host.removeAttribute("data-glass-navigation-card");
      host.style.removeProperty("--glass-navigation-filter");
      svg.remove();
    },
  };
}
