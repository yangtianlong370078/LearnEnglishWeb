export type GlassWallpaperWorkerOptions = {
  width: number;
  height: number;
  scale: number;
  dark: boolean;
  blurPx: number;
  blurPadding: number;
  saturation: number;
  borderSaturation: number;
  borderBrightness: number;
  losslessWallpaper: boolean;
};

export type GlassWallpaperWorkerRequest = GlassWallpaperWorkerOptions & {
  id: number;
  image: ImageBitmap;
};

export type GlassWallpaperWorkerResult = { base: Blob; border: Blob };

export type GlassWallpaperWorkerResponse =
  | ({ id: number } & GlassWallpaperWorkerResult)
  | { id: number; error: string };

/** Optional, interruptible preparation of the inactive mode's photo textures. */
export function createGlassWallpaperWorker() {
  if (
    typeof Worker === "undefined" ||
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap !== "function"
  )
    return;

  let worker: Worker | undefined;
  let disposed = false;
  let nextId = 0;
  let active:
    | {
        id: number;
        resolve: (result: GlassWallpaperWorkerResult) => void;
        reject: (error: unknown) => void;
      }
    | undefined;

  function stop(error: unknown) {
    worker?.terminate();
    worker = undefined;
    const task = active;

    active = undefined;
    task?.reject(error);
  }

  function cancel() {
    stop(
      new DOMException("Glass wallpaper preparation canceled", "AbortError"),
    );
  }

  function render(
    image: HTMLImageElement,
    options: GlassWallpaperWorkerOptions,
  ): Promise<GlassWallpaperWorkerResult> {
    if (disposed)
      return Promise.reject(
        new DOMException("Glass wallpaper worker disposed", "AbortError"),
      );
    if (active) cancel();

    return new Promise((resolve, reject) => {
      const id = ++nextId;

      active = { id, resolve, reject };
      try {
        if (!worker) {
          const created = new Worker(
            new URL("./glass-wallpaper.worker.ts", import.meta.url),
          );

          worker = created;
          created.onmessage = (
            event: MessageEvent<GlassWallpaperWorkerResponse>,
          ) => {
            if (worker !== created || event.data.id !== active?.id) return;
            if ("error" in event.data) {
              stop(new Error(event.data.error));

              return;
            }
            const task = active;

            active = undefined;
            task.resolve({ base: event.data.base, border: event.data.border });
          };
          created.onerror = () => {
            if (worker === created)
              stop(new Error("Cannot render glass wallpaper in worker"));
          };
          created.onmessageerror = () => {
            if (worker === created)
              stop(new Error("Cannot read glass wallpaper worker response"));
          };
        }
        const currentWorker = worker;

        // Reuse the decoded source. Only its transferable bitmap crosses the
        // thread boundary; the worker never downloads the photo again.
        void createImageBitmap(image).then(
          (bitmap) => {
            if (active?.id !== id || currentWorker !== worker) {
              bitmap.close();

              return;
            }
            try {
              const request: GlassWallpaperWorkerRequest = {
                ...options,
                id,
                image: bitmap,
              };

              currentWorker.postMessage(request, [bitmap]);
            } catch (error) {
              bitmap.close();
              stop(error);
            }
          },
          (error) => {
            if (active?.id === id) stop(error);
          },
        );
      } catch (error) {
        stop(error);
      }
    });
  }

  return {
    render,
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
