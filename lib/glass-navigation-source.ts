import { createGlassNavigationFilter } from "./glass-navigation-filter";
import { subscribeGlassSurfaceChanges } from "./glass-surface-source";
import { cancelGlassFrame, scheduleGlassFrame } from "./glass-frame";

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

  function measure() {
    if (!main) return () => {};
    const header = nav.getBoundingClientRect();
    const active = view.scrollY > 0;
    const modal = document.body.hasAttribute("data-glass-modal-open");
    const hosts =
      active && !modal
        ? Array.from(
            main.querySelectorAll<HTMLElement>(
              ".glass-warp, [data-glass-navigation-content]",
            ),
            (element) =>
              element.classList.contains("glass-warp")
                ? element.parentElement!
                : element,
          )
        : [];
    const candidates = Array.from(new Set(hosts))
      .filter(
        (host, index, all) =>
          !all.some((other, i) => i !== index && other.contains(host)),
      )
      .map((host) => ({ host, bounds: host.getBoundingClientRect() }))
      .filter(
        ({ bounds }) =>
          bounds.top < header.bottom + 32 && bounds.bottom > header.top - 32,
      );

    return () => {
      if (disposed) return;
      main.toggleAttribute("data-glass-navigation-source", active);
      nav.toggleAttribute("data-glass-navigation-active", active);
      wallpaper.style.top = `${header.top}px`;
      wallpaper.style.height = `${header.height}px`;
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
  const resize = new ResizeObserver(schedule);

  resize.observe(main);
  resize.observe(nav);
  const overlays = new MutationObserver(schedule);
  const unsubscribeSurfaces = subscribeGlassSurfaceChanges(document, schedule);

  overlays.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-glass-modal-open"],
  });
  view.addEventListener("scroll", schedule, { passive: true });
  view.addEventListener("resize", schedule);
  schedule();

  return () => {
    disposed = true;
    cancelGlassFrame(view, measure);
    resize.disconnect();
    overlays.disconnect();
    unsubscribeSurfaces();
    view.removeEventListener("scroll", schedule);
    view.removeEventListener("resize", schedule);
    main.removeAttribute("data-glass-navigation-source");
    nav.removeAttribute("data-glass-navigation-active");
    wallpaper.remove();
    for (const filter of Array.from(filters.values())) filter.dispose();
  };
}
