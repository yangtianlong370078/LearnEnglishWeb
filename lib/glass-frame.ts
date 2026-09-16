type Measure = () => () => void;

const queues = new WeakMap<Window, { frame: number; jobs: Set<Measure> }>();

/** Measure all glass geometry before any controller changes paint styles. */
export function scheduleGlassFrame(view: Window, measure: Measure) {
  let queue = queues.get(view);

  if (!queue) {
    queue = { frame: 0, jobs: new Set() };
    queues.set(view, queue);
  }
  queue.jobs.add(measure);
  if (queue.frame) return;
  queue.frame = view.requestAnimationFrame(() => {
    queue.frame = 0;
    const jobs = Array.from(queue.jobs);

    queue.jobs.clear();
    const paints = jobs.map((job) => job());

    for (const paint of paints) paint();
  });
}

export function cancelGlassFrame(view: Window, measure: Measure) {
  const queue = queues.get(view);

  if (!queue) return;
  queue.jobs.delete(measure);
  if (!queue.jobs.size) {
    view.cancelAnimationFrame(queue.frame);
    queues.delete(view);
  }
}
