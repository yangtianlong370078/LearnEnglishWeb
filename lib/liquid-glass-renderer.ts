import type { LiquidGlassItem, LiquidGlassTile } from "./liquid-glass-geometry";

import { packLiquidGlassAtlas } from "./liquid-glass-geometry";

export type { LiquidGlassItem, LiquidGlassTile };

export type LiquidGlassRendererOptions = {
  maxDpr: number;
  /** Pixel budget for each of the atlas and static background texture. */
  maxPixels: number;
  edgeWidthPx: number;
  /** Outer band without refraction, in nonnegative CSS pixels. */
  edgeInsetPx: number;
  refractionPx: number;
  fresnelStrength: number;
  dispersionPx: number;
  disableDispersion: boolean;
};

export type LiquidGlassViewport = {
  width: number;
  height: number;
  dpr: number;
};

export type LiquidGlassRenderer = {
  canvas: HTMLCanvasElement;
  setBackground: (image: HTMLImageElement) => void;
  /** Copy returned tiles synchronously with drawImage before yielding. */
  render: (
    items: readonly LiquidGlassItem[],
    viewport: LiquidGlassViewport,
  ) => LiquidGlassTile[];
  dispose: () => void;
};

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aAtlas;
layout(location = 1) in vec4 aCard;
layout(location = 2) in float aRadius;
uniform vec2 uAtlasSize;
out vec2 vLocal;
flat out vec4 vCard;
flat out float vRadius;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 pixel = aAtlas.xy + corner * aAtlas.zw;
  gl_Position = vec4(pixel / uAtlasSize * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
  vLocal = corner * aCard.zw;
  vCard = aCard;
  vRadius = aRadius;
}`;

function fragmentShader(dispersion: boolean) {
  return `#version 300 es
${dispersion ? "#define DISPERSION" : ""}
precision highp float;
uniform sampler2D uBackground;
uniform vec2 uViewport;
uniform float uEdgeWidth;
uniform float uEdgeInset;
uniform float uRefraction;
uniform float uFresnel;
${dispersion ? "uniform float uDispersion;" : ""}
in vec2 vLocal;
flat in vec4 vCard;
flat in float vRadius;
out vec4 outColor;
void main() {
  vec2 halfSize = vCard.zw * 0.5;
  float radius = clamp(vRadius, 0.0, min(halfSize.x, halfSize.y));
  vec2 point = vLocal - halfSize;
  vec2 rounded = abs(point) - halfSize + radius;
  vec2 arc = max(rounded, 0.0);
  float inside = radius - length(arc) - min(max(rounded.x, rounded.y), 0.0);
  float edgeWidth = min(uEdgeWidth, max(1.0, min(halfSize.x, halfSize.y) - uEdgeInset - 1.0));
  float lens = 1.0 - smoothstep(uEdgeInset, uEdgeInset + edgeWidth, inside);
  // Preserve the configured outer band, with a 1 CSS px transition into the lens.
  float alpha = smoothstep(uEdgeInset, uEdgeInset + 1.0, inside) * lens;
  vec2 sideNormal = mix(vec2(0.0, sign(point.y)), vec2(sign(point.x), 0.0), step(rounded.y, rounded.x));
  vec2 arcNormal = normalize(arc + vec2(0.0001)) * sign(point);
  vec2 normal = mix(sideNormal, arcNormal, step(0.0, max(rounded.x, rounded.y)));
  vec2 uv = (vCard.xy + vLocal - normal * uRefraction * lens * lens) / uViewport;
  vec3 color;
#ifdef DISPERSION
  vec2 separation = normal * uDispersion * lens / uViewport;
  color = vec3(texture(uBackground, uv + separation).r,
               texture(uBackground, uv).g,
               texture(uBackground, uv - separation).b);
#else
  color = texture(uBackground, uv).rgb;
#endif
  float light = 0.25 + 0.75 * max(0.0, dot(normal, vec2(-0.6, -0.8)));
  float fresnel = clamp(uFresnel * lens * lens * lens * light, 0.0, 1.0);
  color = mix(color, vec3(1.0), fresnel);
  // The WebGL canvas uses premultiplied alpha when copied to card canvases.
  outColor = vec4(color * alpha, alpha);
}`;
}

/** One detached WebGL2 context, one static wallpaper upload and one instanced
 * draw per update. Atlas tiles are copied into the existing card paint stacks,
 * so overlapping cards, text, menus and dialogs retain normal DOM ordering.
 */
export function createLiquidGlassRenderer(
  document: Document,
  options: LiquidGlassRendererOptions,
  onContextLost: () => void,
): LiquidGlassRenderer {
  const numericOptions = Object.values(options).filter(
    (value): value is number => typeof value === "number",
  );

  if (
    !numericOptions.every((value) => Number.isFinite(value) && value >= 0) ||
    options.maxDpr <= 0 ||
    options.maxPixels < 9 ||
    options.edgeWidthPx <= 0
  ) {
    throw new Error("Invalid liquid glass renderer options");
  }

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });

  if (!gl) throw new Error("WebGL2 is unavailable for liquid glass");

  let disposed = false;
  let lost = false;
  let background: HTMLImageElement | null = null;
  let program: WebGLProgram | null = null;
  let instanceBuffer: WebGLBuffer | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let texture: WebGLTexture | null = null;
  let vertices: WebGLShader | null = null;
  let fragments: WebGLShader | null = null;
  let instanceCapacity = 0;
  let instanceData = new Float32Array(0);
  let checkDraw = true;
  let cachedAtlas: ReturnType<typeof packLiquidGlassAtlas> | null = null;
  let cachedItems: Pick<LiquidGlassItem, "id" | "width" | "height">[] = [];
  let cachedScale = 0;
  let cachedMaxPixels = 0;

  function contextLost(event: Event) {
    event.preventDefault();
    if (disposed || lost) return;
    lost = true;
    onContextLost();
  }

  canvas.addEventListener("webglcontextlost", contextLost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("webglcontextlost", contextLost);
    gl!.deleteBuffer(instanceBuffer);
    gl!.deleteVertexArray(vertexArray);
    gl!.deleteTexture(texture);
    gl!.deleteProgram(program);
    gl!.deleteShader(vertices);
    gl!.deleteShader(fragments);
    background = null;
    instanceData = new Float32Array(0);
    cachedAtlas = null;
    cachedItems = [];
    // Release the driver's context quota immediately across mode toggles.
    gl!.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.width = 1;
    canvas.height = 1;
  }

  function assertReady() {
    if (disposed || lost || gl!.isContextLost()) {
      throw new Error("Liquid glass context is unavailable");
    }
  }

  function assertNoError(stage: string) {
    const error = gl!.getError();

    if (error !== gl!.NO_ERROR) {
      throw new Error(`Liquid glass ${stage} failed (${error})`);
    }
  }

  function compile(kind: number, source: string) {
    const shader = gl!.createShader(kind);

    if (!shader) throw new Error("Cannot allocate liquid glass shader");
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      const message = gl!.getShaderInfoLog(shader);

      gl!.deleteShader(shader);
      throw new Error(`Cannot compile liquid glass shader: ${message}`);
    }

    return shader;
  }

  try {
    const dispersion = !options.disableDispersion && options.dispersionPx > 0;

    vertices = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    fragments = compile(gl.FRAGMENT_SHADER, fragmentShader(dispersion));
    program = gl.createProgram();
    if (!program) throw new Error("Cannot allocate liquid glass program");
    gl.attachShader(program, vertices);
    gl.attachShader(program, fragments);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `Cannot link liquid glass shader: ${gl.getProgramInfoLog(program)}`,
      );
    }
    gl.detachShader(program, vertices);
    gl.detachShader(program, fragments);
    gl.deleteShader(vertices);
    gl.deleteShader(fragments);
    vertices = null;
    fragments = null;

    instanceBuffer = gl.createBuffer();
    vertexArray = gl.createVertexArray();
    texture = gl.createTexture();
    if (!instanceBuffer || !vertexArray || !texture) {
      throw new Error("Cannot allocate liquid glass GPU resources");
    }

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    for (const [location, size, offset] of [
      [0, 4, 0],
      [1, 4, 4],
      [2, 1, 8],
    ]) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset * 4);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Texture coordinates, DOM bounds and image rows all use a top-left origin.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program!, name);
    const atlasSize = uniform("uAtlasSize");
    const viewportSize = uniform("uViewport");

    gl.uniform1i(uniform("uBackground"), 0);
    gl.uniform1f(uniform("uEdgeWidth"), options.edgeWidthPx);
    gl.uniform1f(uniform("uEdgeInset"), options.edgeInsetPx);
    gl.uniform1f(uniform("uRefraction"), options.refractionPx);
    gl.uniform1f(uniform("uFresnel"), options.fresnelStrength);
    if (dispersion) gl.uniform1f(uniform("uDispersion"), options.dispersionPx);

    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const maxDimension = Math.min(
      maxTexture,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
      viewportLimit[0],
      viewportLimit[1],
    );

    assertNoError("initialization");

    const setBackground = (image: HTMLImageElement) => {
      assertReady();
      if (image === background) return;
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error("Liquid glass wallpaper has not been decoded");
      }

      const scale = Math.min(
        1,
        maxTexture / image.naturalWidth,
        maxTexture / image.naturalHeight,
        Math.sqrt(
          options.maxPixels / (image.naturalWidth * image.naturalHeight),
        ),
      );
      let upload: TexImageSource = image;
      let scratch: HTMLCanvasElement | null = null;

      if (scale < 1) {
        scratch = document.createElement("canvas");
        scratch.width = Math.max(1, Math.floor(image.naturalWidth * scale));
        scratch.height = Math.max(1, Math.floor(image.naturalHeight * scale));
        const context = scratch.getContext("2d");

        if (!context) throw new Error("Cannot resize liquid glass wallpaper");
        context.drawImage(image, 0, 0, scratch.width, scratch.height);
        upload = scratch;
      }
      try {
        gl!.texImage2D(
          gl!.TEXTURE_2D,
          0,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          upload,
        );
        assertNoError("wallpaper upload");
        background = image;
      } finally {
        if (scratch) {
          scratch.width = 1;
          scratch.height = 1;
        }
      }
    };

    const render = (
      items: readonly LiquidGlassItem[],
      viewport: LiquidGlassViewport,
    ) => {
      assertReady();
      if (!background) throw new Error("Liquid glass wallpaper is unavailable");
      if (
        !Object.values(viewport).every(
          (value) => Number.isFinite(value) && value > 0,
        )
      ) {
        throw new Error("Invalid liquid glass viewport");
      }
      if (!items.length) return [];

      const scale = Math.min(viewport.dpr, options.maxDpr);

      // Scrolling changes screen coordinates, not atlas packing. Keep the
      // layout until card membership, dimensions or the pixel budget changes.
      if (
        !cachedAtlas ||
        scale !== cachedScale ||
        options.maxPixels !== cachedMaxPixels ||
        items.length !== cachedItems.length ||
        items.some((item, index) => {
          const previous = cachedItems[index];

          return (
            item.id !== previous.id ||
            item.width !== previous.width ||
            item.height !== previous.height
          );
        })
      ) {
        cachedAtlas = packLiquidGlassAtlas(
          items,
          scale,
          options.maxPixels,
          maxDimension,
        );
        cachedItems = items.map(({ id, width, height }) => ({
          id,
          width,
          height,
        }));
        cachedScale = scale;
        cachedMaxPixels = options.maxPixels;
      }
      const atlas = cachedAtlas;

      if (canvas.width !== atlas.width || canvas.height !== atlas.height) {
        canvas.width = atlas.width;
        canvas.height = atlas.height;
        gl!.viewport(0, 0, atlas.width, atlas.height);
        checkDraw = true;
      }
      if (items.length > instanceCapacity) {
        instanceCapacity = items.length;
        instanceData = new Float32Array(instanceCapacity * 9);
        gl!.bufferData(
          gl!.ARRAY_BUFFER,
          instanceData.byteLength,
          gl!.DYNAMIC_DRAW,
        );
        checkDraw = true;
      }
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const tile = atlas.tiles[index];
        const offset = index * 9;

        if (
          !Number.isFinite(item.x) ||
          !Number.isFinite(item.y) ||
          !Number.isFinite(item.radius) ||
          item.radius < 0
        ) {
          throw new Error("Invalid liquid glass card bounds");
        }
        instanceData[offset] = tile.x;
        instanceData[offset + 1] = tile.y;
        instanceData[offset + 2] = tile.width;
        instanceData[offset + 3] = tile.height;
        instanceData[offset + 4] = item.x;
        instanceData[offset + 5] = item.y;
        instanceData[offset + 6] = item.width;
        instanceData[offset + 7] = item.height;
        instanceData[offset + 8] = item.radius;
      }
      gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, instanceData, 0, items.length * 9);
      gl!.uniform2f(atlasSize, atlas.width, atlas.height);
      gl!.uniform2f(viewportSize, viewport.width, viewport.height);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArraysInstanced(gl!.TRIANGLE_STRIP, 0, 4, items.length);
      // Check new allocations/draw state only, avoiding a driver query on
      // every scroll frame. Context loss is also handled by the canvas event.
      if (checkDraw) {
        assertNoError("draw");
        checkDraw = false;
      }

      return atlas.tiles;
    };

    return { canvas, setBackground, render, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
