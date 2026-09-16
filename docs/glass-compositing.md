# Glass compositing

All application glass now uses source rendering instead of `backdrop-filter`.
The base effect remains **blur(8px) saturate(150%)**. The rim retains its
additional **saturate(180%) brightness(1.5)**, specular gradient and inset shadow.

## Why source rendering

Moving backdrop filters onto pseudo-elements reduced the reported translucent
rectangles but did not eliminate them. The user confirmed that filtering the
page source solved the fullscreen modal artifact. The remaining card/navigation
surfaces now use the same principle: filter a known source, without sampling
lower compositor surfaces on pointer-driven repaint.

The exact browser/driver defect has not been established. This removes the
backdrop-readback path implicated by the report, rather than relying on a
particular browser's layer promotion heuristics.

## Cards, search and login

`GlassWarp` and `GlassBorder` register decorative layers with one controller per
document (`lib/glass-surface-source.ts`). Their clipped pseudo-elements paint
the wallpaper at its viewport coordinates. Tint and highlights remain separate;
text, charts, menus and answer feedback are not blurred.

`lib/glass-wallpaper-cache.ts` renders the existing theme wallpaper into two
shared viewport-sized textures. It draws only the application's known image or
radial-gradient background; it does not capture, clone or rasterize page DOM.
The blur repeats edge pixels across a 32px perimeter before convolution.
Rendering uses the current device pixel ratio, theme colours and image cover
geometry. The second texture includes the bright rim's saturation/brightness.

The cache regenerates on theme/background or viewport changes, with a 100ms
resize debounce and stale-generation guards. At most two theme/size entries
are retained. Evicted object URLs are revoked; drawing buffers and the final
controller's resources are released. While a texture is unavailable, the same
wallpaper is painted with a normal CSS source filter. Login uses its own existing
gradient source and tint.

Scrolling updates only visible decorative layers' background coordinates in
one shared frame for surfaces and navigation (`lib/glass-frame.ts`), batching
all geometry reads before any controller writes styles. Intersection
observation limits layer promotion to visible decorations. There is no mouse
listener, per-mouse blur, React state update on scroll, or continuous animation
loop. This is a wallpaper renderer: a future glass component overlapping
arbitrary foreground content needs an explicit source arrangement, like the
navigation implementation below.

## Sticky navigation

`GlassNavigation` registers the navbar and its main content. A cached wallpaper
strip sits behind main content at the header's viewport position. Cards and
ordinary content marked `data-glass-navigation-content` crossing
the header receive a bounded SVG source filter (`lib/glass-navigation-filter.ts`):
only the strip behind the header is blurred at 8px/saturation 1.5; the remainder
of each card stays sharp. This preserves the blur of scrolling text and charts.
The controller releases filters after cards leave the header or the route
changes, and suspends them while the fullscreen modal source filter is active.
Surface registration notifies navigation when React replaces equal-sized cards,
so the old SVG is released even when no scroll or resize occurs.

## Fullscreen and nested modals

The user-confirmed modal implementation is retained:

- `lib/glass-source-filter.ts` filters `.app-shell` within the viewport plus a
  32px perimeter, independently of document length. Eight narrow patches repeat
  edge pixels; `edgeMode="duplicate"` alone was not sufficient in Chromium.
- The custom scrim supplies the existing light/dark tint. Wallpaper positioning
  accounts for scroll because a source filter establishes a containing block.
- Covered dialogs get one source blur each; the top dialog remains sharp. The
  page is blurred once regardless of the number of open dialogs. Separate
  uniform scrims prevent transparent filter edges.
- `lib/glass-backdrop-stack.ts` tracks actual mounted overlays, including exit
  animations. React Aria retains portals, focus, dismissal and scroll locking.
  Select popovers do not alter the modal stack. Temporary SVGs, listeners, styles
  and markers are cleaned up when the last modal unmounts.

## Validation (2026-09-16)

Browser checks use fictional API fixtures and isolated profiles. Visual A/B
comparisons cover image/gradient backgrounds, light/dark themes and scrolled
pages. At 1440 x 1000, the full-frame mean RGB-channel difference from the
previous backdrop rendering was approximately 0.18-0.58/255. The source and
backdrop raster paths are not pixel-identical, especially around translucent
edges, but blur strength, saturated rims and scrolling navigation are retained.

Independent Chrome 152 and installed 360 / Chromium 132 checks cover desktop
1440 x 650 and mobile 390 x 844/DPR 2 across both themes and wallpapers. All 72
functional checks passed: zero effective business backdrop filters, stable
scroll height, modal source setup/cleanup and navigation filter route cleanup.
The 360 desktop profile also emitted its previously observed injected-script
error (`Identifier 'N' has already been declared`); other combinations had no
page exceptions.

The final production Chrome suite passed 212 desktop assertions and 21 mobile
and answer-feedback assertions with no page exceptions. It covers focus
trapping/restoration, nested modals, selects, dismissal, mobile navigation and
correct/wrong answer tint changes. A targeted test confirms ordinary calendar
headings blur under navigation and old filter IDs disappear after SPA routing.
Cache lifecycle instrumentation confirms reuse across theme toggles, eviction
at two entries, and complete URL cleanup on disposal during a pending encode.
Shared-frame checks confirm read-before-write batching, coalescing and
cancellation.

Production build, TypeScript, focused ESLint and `git diff --check` pass.
React Doctor remains 52/100 (baseline 51), with 7 pre-existing errors. Its 46
warnings include two new static-analysis false positives for the cache's
`createObjectURL` calls: stale results, eviction and controller disposal all
revoke them, as checked by the lifecycle instrumentation. No diagnostic was
suppressed.

A further 72 production checks in 360 cover both default and disabled hardware
acceleration: pointer sweeps, scrolling content behind navigation, modal
setup/cleanup and desktop/mobile resizing. All passed. In the final run seven
of eight pointer-sweep image comparisons were identical; the remaining pair
differed by at most 1/255 in a channel (full-image mean 0.000007/255). An earlier
run showed small raster rounding differences (mean 0.009/255, maximum 3/255),
so exact encoded screenshot equality is not a reliable universal invariant.

The final production scroll stress comparison used 20 course cards, a
1440 x 1000 viewport and 90 animation frames, alternating new/previous CSS
rendering twice per mode. Both variants retained the current controllers:

| Rendering mode | Previous median / p95 frame interval | New median / p95 |
| --- | --- | --- |
| Chrome default | 16.7 / 33.3ms | 16.7 / 33.4-33.8ms |
| Chrome GPU disabled | 116.6-116.7 / 149.9-183.3ms | 16.8-33.3 / 49.9-50.0ms |

The default-rendering frame cadence was comparable and software rendering
improved in this sample. Source geometry/paint still adds main-thread work:
default-mode task time was about 1.01-1.10s versus 0.85-0.90s over the synthetic
scroll. These are rendering comparisons under a shared controller, not an
end-to-end benchmark of an old checkout or evidence that every performance
metric improves. Cache generation is outside this steady-scroll measurement;
its work occurs on initial use and theme/viewport changes.

The original intermittent browser-window artifact is not reliably reproduced
by automation. Pointer screenshot comparisons must distinguish sub-channel
raster rounding from an actual translucent rectangle; they cannot establish
correctness for every browser/driver. Real-device verification is still useful.
