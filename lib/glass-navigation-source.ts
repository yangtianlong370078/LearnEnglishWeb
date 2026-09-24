import { createGlassNavigationFilter } from "./glass-navigation-filter";
import { subscribeGlassSurfaceChanges } from "./glass-surface-source";
import { cancelGlassFrame, scheduleGlassFrame } from "./glass-frame";

import { getGlassBlurPadding } from "@/config/glass";

/** Filter only content currently crossing the sticky header. */
export function registerGlassNavigation(nav: HTMLElement) {
  const document = nav.ownerDocument;
  const view = document.defaultView!;
  const main = nav.closest(".app-shell")?.querySelector<HTMLElement>("main");

  if (!main) return () => {};
  const filters = new Map<
    HTMLElement,
    ReturnType<typeof createGlassNavigationFilter>
  >();
  const wallpaper = document.createElement("span");

  wallpaper.className = "glass-navigation-wallpaper";
  wallpaper.setAttribute("aria-hidden", "true");
  main.prepend(wallpaper);
  let disposed = false;
  let hostsDirty = true;
  let hosts: HTMLElement[] = [];
  let previousActive: boolean | undefined;
  let previousHeaderTop: number | undefined;
  let previousHeaderHeight: number | undefined;
  const hostSelector = ".glass-warp, [data-glass-navigation-content]";

  function collectHosts() {
    const unique = new Set(
      Array.from(
        main!.querySelectorAll<HTMLElement>(hostSelector),
        (element) =>
          element.classList.contains("glass-warp")
            ? element.parentElement!
            : element,
      ),
    );

    // Walking each host's ancestors avoids comparing every pair of cards.
    // Rebuild only after content changes, never as part of ordinary scrolling.
    hosts = Array.from(unique).filter((host) => {
      for (
        let ancestor = host.parentElement;
        ancestor && ancestor !== main;
        ancestor = ancestor.parentElement
      ) {
        if (unique.has(ancestor)) return false;
      }

      return true;
    });
    hostsDirty = false;
  }

  function measure() {
    if (!main) return () => {};
    const header = nav.getBoundingClientRect();
    const active = view.scrollY > 0;
    const modal = document.body.hasAttribute("data-glass-modal-open");
    const blurPadding = getGlassBlurPadding(
      document.documentElement.dataset.glassMode,
    );
    const candidates: { host: HTMLElement; bounds: DOMRect }[] = [];

    if (active && !modal) {
      if (hostsDirty) collectHosts();
      // Read current geometry so layout shifts, transforms and fast scroll
      // jumps cannot leave the header using stale document coordinates.
      for (const host of hosts) {
        const bounds = host.getBoundingClientRect();

        if (
          bounds.top < header.bottom + blurPadding &&
          bounds.bottom > header.top - blurPadding
        )
          candidates.push({ host, bounds });
      }
    }

    return () => {
      if (disposed) return;
      if (previousActive !== active) {
        main.toggleAttribute("data-glass-navigation-source", active);
        nav.toggleAttribute("data-glass-navigation-active", active);
        previousActive = active;
      }
      if (previousHeaderTop !== header.top) {
        wallpaper.style.top = `${header.top}px`;
        previousHeaderTop = header.top;
      }
      if (previousHeaderHeight !== header.height) {
        wallpaper.style.height = `${header.height}px`;
        previousHeaderHeight = header.height;
      }
      const visible = new Set<HTMLElement>();

      for (const { host, bounds } of candidates) {
        visible.add(host);
        let filter = filters.get(host);

        if (!filter) {
          filter = createGlassNavigationFilter(host);
          filters.set(host, filter);
        }
        filter.update(bounds, header);
      }
      for (const [host, filter] of Array.from(filters)) {
        if (!visible.has(host)) {
          filter.dispose();
          filters.delete(host);
        }
      }
    };
  }

  function schedule() {
    scheduleGlassFrame(view, measure);
  }
  function contentChanged() {
    hostsDirty = true;
    schedule();
  }
  function containsHost(node: Node) {
    if (node.nodeType !== 1) return false;
    const element = node as Element;

    return (
      element.matches(hostSelector) || !!element.querySelector(hostSelector)
    );
  }
  function contentMutated(records: MutationRecord[]) {
    if (
      !hostsDirty &&
      records.some(
        (record) =>
          record.type === "attributes" ||
          Array.from(record.addedNodes).some(containsHost) ||
          Array.from(record.removedNodes).some(containsHost),
      )
    )
      hostsDirty = true;
    // Content without a glass host can still shift existing hosts. Always
    // measure their live geometry, but reuse the candidate list when possible.
    schedule();
  }
  const resize = new ResizeObserver(schedule);

  resize.observe(main);
  resize.observe(nav);
  const overlays = new MutationObserver(schedule);
  const content = new MutationObserver(contentMutated);
  const unsubscribeSurfaces = subscribeGlassSurfaceChanges(
    document,
    contentChanged,
  );

  // Plain content can be replaced without mounting a glass surface or changing
  // main's size (for example a same-height route/loading transition).
  content.observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-glass-navigation-content"],
  });
  overlays.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-glass-modal-open"],
  });
  overlays.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-glass-mode"],
  });
  view.addEventListener("scroll", schedule, { passive: true });
  view.addEventListener("resize", schedule);
  schedule();

  return () => {
    disposed = true;
    cancelGlassFrame(view, measure);
    resize.disconnect();
    overlays.disconnect();
    content.disconnect();
    unsubscribeSurfaces();
    view.removeEventListener("scroll", schedule);
    view.removeEventListener("resize", schedule);
    main.removeAttribute("data-glass-navigation-source");
    nav.removeAttribute("data-glass-navigation-active");
    wallpaper.remove();
    for (const filter of Array.from(filters.values())) filter.dispose();
  };
}
