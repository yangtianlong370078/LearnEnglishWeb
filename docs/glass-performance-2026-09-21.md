# Glass layer promotion performance assessment

An experiment that globally removed `will-change: opacity` fixed the returning
accordion's blank background, but had a measurable scrolling cost in this
environment. The production fix now limits that opt-out to the two
`/learnwords` course accordion containers.
The strongest regression appears on `/courselearn`, where twelve word cards
use the shared glass implementation. Lower renderer main-thread time does not
establish an overall improvement: considerably fewer animation frames are
produced on that page.

## Method

- Machine: Intel Core i7-1360P, Intel Iris Xe, driver 31.0.101.4502.
- Browser: Chrome 153.0.8010.48, headless; CDP reports GPU compositing and GPU
  rasterization enabled. This is desktop browser automation, not a phone test.
- Viewport: 1440 × 900, DPR 1, dark theme and photo wallpaper.
- Two isolated Next.js production builds (`next build --webpack`), served on
  ports 8091 and 8092. Both contain the same working-tree application code;
  the before version restores only `styles/glass.css` and
  `lib/glass-surface-source.ts` from HEAD `2707044`.
- Fictional API responses: 18 courses on `/learnwords`; 12 word cards on
  `/courselearn`. No real account data or backend writes.
- Separate browser contexts, decoded wallpaper cache, settled content and
  warm-up scrolls. Order alternates before/after and after/before.
- Scroll runs use four CDP mouse scroll gestures with fixed distance and speed:
  1400px at 700px/s for learnwords, 359px at 180px/s for courselearn. The
  distance differs between pages because the word-card page is shorter.
- Each learnwords accordion sample contains two expansion/collapse cycles,
  with 650ms settling time after each click. Six pairs were recorded for
  learnwords and three for courselearn. Main measurements have tracing disabled.
- Statistics below first compute each run's metric, then average those run
  metrics. Individual frames are not treated as independent experimental runs.

## Results without tracing

Frame intervals are measured with `requestAnimationFrame`; they are a cadence
indicator, not a direct measurement of GPU presentation FPS. Smaller is better.

| Scenario | Before mean interval | After mean interval | Change |
| --- | ---: | ---: | ---: |
| Learnwords, accordion animation | 17.88ms | 18.34ms | +2.6% |
| Learnwords, scrolling | 26.76ms | 28.76ms | +7.5% |
| Courselearn, scrolling | 25.20ms | 48.40ms | +92.1% |

| Scroll metric | Learnwords before → after | Courselearn before → after |
| --- | ---: | ---: |
| Mean of per-run p95 intervals | 41.40 → 44.42ms | 33.80 → 77.80ms |
| Frames over 25ms | 56.34% → 63.28% | 48.28% → 79.55% |
| Frames over 50ms | 1.82% → 4.14% | 0.77% → 46.95% |
| Renderer main-thread task time per run | 2193 → 1627ms | 1330 → 632ms |
| Renderer main-thread busy share | 24.99% → 18.43% | 15.38% → 6.96% |

Learnwords main-thread time decreases in all six pairs, by 22.3–30.8%.
Scrolling mean frame intervals worsen in four of six pairs; paired changes
range from -8.3% to +19.9%. This is a modest, noisy cadence regression, with
slow-frame proportions increasing in five of six pairs.

Courselearn frame intervals worsen in all three pairs, by 82.3–100.1%.
Before sample means range from 24.81–25.77ms; after sample means range from
46.99–49.63ms. Average rAF count falls from 343 to 188 per run. Part of the
lower main-thread time therefore accompanies fewer frame callbacks; it must
not be presented as a 52.5% saving for equivalent displayed output.

Accordion p50 remains 16.7ms in every sample. Main-thread time for two cycles
averages 991ms before and 1037ms after, with substantial run variation and one
166.7ms frame after the change. The old version can display a blank glass
surface on collapse, so these animation timings do not compare equally
correct rendering.

## Interpretation and limits

The shared pre-blurred wallpaper textures are unchanged, as is cached-state
`filter: none`. Removing the observer does not enable per-card live blur or
force every offscreen card to paint. The material change is browser layer
allocation and how fixed backgrounds participate in scrolling and compositing.

Two additional traced pairs on courselearn reproduce the cadence regression.
Aggregate Paint and RasterTask time both decrease alongside frame production;
the traces do not justify claiming that total raster CPU time increased.
Tracing itself noticeably increases frame times, so those samples are excluded
from the primary table. Event categories can overlap and their durations must
not be added together as a total.

Chrome's own `FrameSequenceTrackerV3` WheelScroll statistics also show a
regression: dropped-frame shares are 64.21% → 80.25% and 48.74% → 73.93% in
the two traced pairs. Scroll presentation intervals worsen as well, supporting
that the change affects more than rAF callbacks. These absolute rates include
trace overhead; the specific GPU/driver bottleneck has not been isolated.

CDP LayerTree did not provide usable layer counts in these runs. Its zero
placeholders in the raw output mean unavailable data, not zero compositor
layers. Separately, trace `visible_layers` medians fall from 68 to 8 on
courselearn, consistent with combining content into fewer layers. This is not
a GPU memory measurement. Headless results on one machine cannot
establish exact impact across all browsers, drivers or mobile devices.

## Recommendation and follow-up

The global experiment was not performance-neutral. The production fix preserves
visibility-based layer promotion for ordinary glass components and persistently
opts out the two learnwords course accordion containers whose bounds/positions
change during expansion and collapse. Both containers are covered because one
resizes while the other is displaced.

The measurements above describe the global experiment, not the scoped
implementation. The latter's separate validation is recorded below.

Temporarily dropping and restoring promotion during layout animation introduces
extra animation/visibility timing and can reintroduce the stale-raster issue;
it should not be assumed safe without a dedicated reproduction check.

Local benchmark scripts, builds, screenshots, JSONL results and traces are in
`C:/Users/EDY/AppData/Local/Temp/glass-performance-RJf00u/`.

## Scoped implementation validation (2026-09-22)

The final application change adds a host attribute in
`renderCategoryAccordion` and a CSS rule for its direct warp/border children.
The visibility controller and ordinary promotion rule are identical to the
original implementation. Production computed-style checks confirm four opted-out
layers on learnwords, ordinary visible layers at `will-change: opacity`, and
no opted-out containers on courselearn. All 24 learnwords expansion/collapse
cycles across desktop/mobile, light/dark and photo/gradient configurations
match the initial glass crop pixel for pixel.

Two new isolated production builds share all source files except
`app/learnwords/page.tsx` and `styles/glass.css`. Each batch below alternates
three before/after pairs on the twelve-card courselearn page, using the same
gesture/viewport setup as the original assessment.

| Courselearn metric | Batch 1 before → scoped | Repeat before → scoped |
| --- | ---: | ---: |
| Mean frame interval | 24.46 → 29.08ms | 21.54 → 22.76ms |
| Mean per-run p95 | 33.50 → 39.23ms | 33.47 → 33.43ms |
| Renderer task time per run | 1354 → 1275ms | 1336 → 1309ms |

The first batch includes one scoped sample at 35.99ms; the three repeated
scoped samples are 23.67, 22.17 and 22.44ms. The sustained 47–50ms cadence of
the global removal is no longer reproduced. These short headless measurements
still vary, and both batches have a higher scoped mean, so they do not prove
zero performance difference. The specific previous loss of promotion is
removed: every visible word-card glass layer retains the original computed
`will-change`, and both versions produce the same 32 layout/style-update counts
per sampled scroll run. The two course accordions retain their local repaint
trade-off; there is no claim of universal performance equivalence.

Builds, scripts, screenshots and JSONL results for this follow-up are in
`C:/Users/EDY/AppData/Local/Temp/glass-scoped-TpFrKZ/`.
