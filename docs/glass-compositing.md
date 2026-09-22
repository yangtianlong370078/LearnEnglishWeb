# Glass compositing

All application glass now uses source rendering instead of `backdrop-filter`.
The base effect uses **blur(8px) saturate(140%)**. The rim adds
**saturate(155%) brightness(1.28)**, a directional specular gradient and inset shadow.

## Shared configuration

Edit `config/glass.ts` to change the defaults: `blurPx` is in CSS pixels,
`saturation` and `borderSaturation` are percentages, and `borderBrightness` is
a multiplier. Border saturation is additional to the base saturation.
`borderGlow` sets independent `top`, `right`, `bottom` and `left` opacities
between 0 and 1 (defaults: 0.42, 0.16, 0.22, 0.32). Each edge's strength
continues through both adjoining corners, blending into its neighbours along
the arcs. Setting all four to zero removes the inner glow while retaining the
thin rim. `borderGlowSizePx` controls the inward spread per edge (default 6px);
corners use the larger adjacent width. Equal widths give continuous falloff
at the straight-to-curved joins.
The inner glow fades immediately with a soft tail: its depth mask reaches 45%
strength at 25% of the configured width, 14% at 55%, and zero at the full width.
Straight edges and corner arcs share this falloff, multiplied by `borderGlow`.
`borderHighlight` independently controls the thin white specular reflection:
`angleDeg` is the CSS gradient angle (default 135, lit from the upper left;
add 180 to reverse it), and `intensity` scales its opacity from 0 to 1
(default 1 preserves the full original reflection; 0 disables it).
`losslessWallpaper` controls cached texture encoding: `true` uses PNG for all
backgrounds; `false` (default) uses JPEG quality 0.98 for photo backgrounds.
Gradient backgrounds always use PNG to avoid visible JPEG blocks.
`app/layout.tsx` emits the derived CSS variables on `<html>` during server
rendering, so the CSS fallback has the correct settings before hydration.
The wallpaper cache and both navigation/modal SVG filters import the same
configuration directly. Blur padding follows four times the configured radius
(minimum 1px), including the navigation's activation bounds.

Refresh the page after editing the configuration to regenerate existing
textures and filters; production deployments need a rebuild. There are no
additional scroll-time style reads or configuration observers. Per-component
CSS overrides do not reconfigure the shared cached textures.

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
debounce for resize only. Theme controls prepare and decode both target textures
before committing the root theme and texture URLs in the same task. The current
decoded textures remain displayed during preparation; a normal refresh never
removes the ready marker or temporarily enables per-card CSS blur. Concurrent
requests for the same texture share one render, and superseded theme requests
cannot commit. System-mode changes use the same path.

At most two theme/size entries are retained, with the displayed entry protected
from eviction. Evicted object URLs are revoked; drawing buffers and the final
controller's resources are released. Initial use or a failed theme render can
use the existing CSS source-filter fallback. A cached theme switch is immediate;
an uncached switch retains the complete previous theme until preparation finishes.
There is no background prewarming. Login uses its own existing gradient source
and tint.

By default, opaque photo textures use JPEG quality 0.98 to reduce encoding time
and blob size; gradients use PNG. `glassConfig.losslessWallpaper` can select PNG
for all cached textures.
This changes encoding, not the filter strength or rendering resolution. The dark
wallpaper was a 13,377,204-byte PNG with a `.jpeg` extension; it is now a real
JPEG at quality 98 and 4:4:4 chroma, retaining its 4368 x 2448 dimensions, at
5,168,984 bytes. These encodings are visually close rather than pixel-lossless.

The cached textures and the uncached CSS fallback use native
`background-attachment: fixed`. Their viewport alignment no longer depends on
JavaScript scroll callbacks. The previous version measured each visible card
and updated its negative background offset in requestAnimationFrame; compositor
scrolling could move the card before that correction, producing the reported
brief drift and snap-back. Sharing the bitmap was not the cause; synchronizing
its coordinates through JavaScript was.

The decorative spans no longer use `translateZ(0)`: any transform ancestor
(including identity transforms and `will-change: transform`) makes a fixed
background scroll with that ancestor in Chromium. Masks, paint containment,
isolation and the navigation's SVG filter preserve fixed background alignment.
The brief wrong-answer shake now uses equivalent relative `left` offsets, so
the whole card still shakes without re-anchoring the wallpaper. Its decorative
layers temporarily use `will-change: auto` for the duration of that animation.

Decorative spans use visibility-based `will-change: opacity` promotion for
ordinary glass surfaces. The two course accordion containers on `/learnwords`
opt out with `data-glass-no-promotion`: layout changes can move their fixed
wallpaper out of the viewport and back, and an explicitly promoted layer can
retain an empty or stale raster in that case. The shared pre-blurred wallpaper
textures are still cached and reused.

The inner glow uses a nested decorative span: a conic mask interpolates corner
intensity, while the source pseudo-element uses linear/radial masks for inward
falloff. The thin rim and its white specular reflection remain separate.

The surface controller manages registration, cache lifetime, viewport resize
and visibility. One shared ResizeObserver tracks border radii on registration
and resize, with batched reads/writes and no unchanged style writes. One shared
IntersectionObserver tracks registered hosts' visibility; CSS keeps promotion
disabled for the two opted-out containers. The controller has no scroll, mouse
or animation listener or scroll-time per-card geometry queries.
Navigation retains its content-filter geometry updates;
they do not position the cached wallpaper. This is a wallpaper renderer: a
future glass component overlapping arbitrary foreground content needs an
explicit source arrangement, like the navigation implementation below.

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
The controller caches its top-level candidate list until content changes instead
of querying and comparing every pair of cards on each scroll frame. Live bounds
are still read to handle layout shifts and fast jumps. Unchanged header styles
are not rewritten; ordinary scrolling updates only three SVG `y` attributes.
The filter's custom property is registered as non-inheriting, avoiding style
invalidation throughout each card's descendants when the filter is attached.
Older browsers without property registration retain the existing behavior.

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

Before the native fixed-background correction, the production scroll comparison
used 20 course cards, a
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

## Fixed-background follow-up

The viewport-alignment regression uses real wheel events while stopping the
page's scroll-event propagation, so JavaScript cannot compensate the source
coordinates. A fixed screen crop inside a card remains pixel-identical before
and after wheel scrolling in Chrome 152 and 360/Chromium 132, in default and
GPU-disabled modes, with both photo and gradient wallpapers. The surface spans
receive no inline-style writes during the sweep. The same test checks the
wrong-answer shake at rest and at its displaced keyframe: Chrome crops match
exactly; 360 differs by at most 1/255 per channel. All 48 assertions passed.

Twelve static visual comparisons at DPR 1.25 cover light/dark, photo/gradient,
and scroll offsets 0/300/800. Mean channel differences against the previous
coordinate-compensation implementation are below 0.0013/255, and no compared
channel differs by more than 5/255. The texture generation and filter strengths
are unchanged.

New sequential production measurements use 20 and 30 actual cards and two
90-frame samples per mode. Under default acceleration, median frame intervals
remain about 16.7ms (one 20-card sample: 17ms). Style-recalculation work falls
about 62-65%, while overall main-thread task time is approximately unchanged.
The GPU-disabled results are mixed: 20-card task time improves, while the
30-card median interval was 33.3ms versus 16.7ms in the preceding samples,
despite almost identical total task time. Other repeated 20-card samples varied
between 16.7 and 33.3ms. These short, sequential measurements establish reduced
coordinate/style work, but do not establish a universal end-to-end performance
improvement or a guarantee of zero frame-time regression.

The final build also passes the 212-assertion desktop modal/navigation suite,
21 mobile/answer-feedback checks, TypeScript, focused ESLint and diff whitespace
checks. React Doctor remains 52/100 with the same 7 errors and 46 warnings.

## Theme-switch and scroll-work follow-up

Frame sampling reproduced the old theme-switch flash: changing theme removed
`data-glass-wallpaper-ready`, enabled `blur(8px) saturate(1.5)` on every card,
and later restored a newly encoded cache image. Publishing before image decode
also allowed an empty image frame. The new coordinated commit eliminates these
intermediate states. Chrome 152 and 360/Chromium 132 checks cover first and
cached theme changes, both wallpapers, rapid combined requests and OS theme
changes in system mode. Every sampled transition retained ready, decoded
textures and `filter: none` on the cached wallpaper pseudo-element. The 360
profile still reports its unrelated injected-script `Identifier 'N'` error.

Two focused lifecycle suites pass 20 scenarios, including cancellation, combined
theme requests, viewport changes during preparation and disposal during encoding;
all 26 created URLs are released. A 158-frame, 30-card navigation check covers
same-height replacement, nested hosts, fast jumps, modal suspension and cleanup.
The final production build again passes 212 desktop assertions, 21 mobile/answer
assertions and 48 Chrome/360 fixed-background assertions. Wheel alignment remains
pixel-identical even with scroll callbacks blocked; displaced shake crops differ
by at most one channel level. TypeScript and focused ESLint pass.

Four 1440 x 1000 screenshots compare the final encoding with the previous PNG
cache and original wallpaper across light/dark and photo/gradient themes. Mean
channel differences are 0.19-0.40/255; no more than 0.008% of channels differ by
over 3/255. Blur, rim saturation/brightness, resolution and fixed positioning
are unchanged. JPEG is a small lossy encoding change, not pixel-identical output.
In one instrumented dark-photo sample using the same optimized source image,
the two PNG encodes took 1045/1079ms versus 89/69ms for JPEG, and their combined
blob size fell from 3.06MB to 0.50MB. These times include browser scheduling;
they are not isolated encoder-throughput measurements. Decoded texture memory
is still determined by viewport size and DPR rather than compressed blob size.

First uncached photo changes still require image loading, decoding and filter
preparation (about 1.5-1.7s in the final cold-browser samples). The old whole
theme remains visible during that interval. Cached toggles commit without
re-encoding. This is a deliberate preparation boundary to prevent mixed-theme
frames, not a claim of instantaneous cold switches.

Real mouse-wheel comparisons use 30 cards, a 1440 x 1000 viewport and three
down/up sweeps per mode on isolated production servers. A repeat batch ran the
previous and final versions consecutively after functional tests completed:

| Chrome mode | Previous mean style work / sweep | Final | Median frame interval |
| --- | --- | --- | --- |
| Default | 60.4ms | 19.7ms | Both 16.7ms |
| GPU disabled | 83.2ms | 19.4ms | Both 16.7ms |

Main-content queries fell from 56-73 per sweep to one initial collection and
zero thereafter. The repeat batch's mean total task time fell from 410 to 362ms
(default) and 684 to 593ms (GPU disabled). Earlier batches had the reverse task
time ordering despite the same reduction in style work, so the stable finding
is less DOM/style work, not a universal CPU or frame-rate improvement. Default
p95 was 16.8ms except for one final 33.3ms sample; software-mode p95 ranged from
16.8 to 33.4ms in both versions. Final 360 samples also retain software-rendering
tail latency (p95 50-66.6ms). These measurements do not establish that every
browser's perceived wheel latency is eliminated.

## Accordion layout follow-up (2026-09-21)

A minimal fixed-background case reproduces the blank returning surface with
`will-change: opacity` in Chrome 153, Chromium 145 and 360/Chromium 132,
without React or navigation filters. Removing that hint makes all seven
offscreen/onscreen cycles match the initial surface pixel for pixel.

The actual `/learnwords` page was checked with 18 fictional courses, desktop
and mobile viewports, light/dark themes and photo/gradient wallpapers in Chrome.
All 24 expand/collapse cycles restore the featured-course glass without scrolling,
including collapsing through the section heading. Screenshot differences are
zero except for one mobile gradient sample with mean channel difference below
0.00005/255; no channel differs by more than 3/255. No page exceptions occurred.
TypeScript and focused ESLint pass; React Doctor remains 52/100 with the same
7 existing errors and 46 warnings.

A real-wheel check with scroll callbacks blocked retains fixed wallpaper
alignment (maximum channel difference 1/255). Four short development/headless
scroll samples varied between 16.9 and 33.3ms median frame intervals; they do
not establish performance equivalence between automatic layer allocation and
the removed compositor hint.

A subsequent [production performance assessment](glass-performance-2026-09-21.md)
found that globally removing promotion lowered renderer main-thread work but
worsened scroll cadence, particularly on the twelve-card learning page. The
current implementation keeps promotion for other glass surfaces and limits the
opt-out to these two course accordion containers.

## Scoped accordion fix (2026-09-22)

`renderCategoryAccordion` marks just the My Courses and Featured Courses hosts
with `data-glass-no-promotion`. The override targets their direct warp/border
children, leaving summary cards, navigation, nested glass and other routes on
the original strategy. The surface controller is restored without changes.

Production Chrome checks cover eight desktop/mobile, light/dark, photo/gradient
combinations with three expansion/collapse cycles each. All 24 cropped images
match their pre-expansion baseline exactly, without scrolling to restore glass.
Computed-style assertions confirm that exactly four layers opt out and other
visible glass remains promoted. Both isolated production builds and TypeScript
pass. React Doctor remains 52/100 with the same diagnostics; focused ESLint
retains the page's existing static-element click-handler error and formatting
warnings, with no new error from this change.
