import { readdir } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * 列出 public/images/<mode> 下的可选背景图。
 * 比 /api/[...path] 兜底代理更具体，优先匹配，不会转发到 .NET 后端。
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode !== "light" && mode !== "dark") {
    return NextResponse.json(
      { success: false, msg: "mode 必须是 light 或 dark" },
      { status: 400 },
    );
  }

  try {
    const dir = path.join(process.cwd(), "public", "images", mode);
    const files = await readdir(dir);
    const images = files
      .filter((file) => IMAGE_EXTENSION.test(file))
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
