import type {
  ListeningLrcDocument,
  ListeningLrcLine,
  ListeningLrcMetadata,
} from "@/types/listening";

const LINE_RE = /^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$/;
const META_RE = /^\[([a-z]+):(.*)\]$/i;

function timeTagToSeconds(tag: string): number {
  const match = /\[(\d+):(\d+(?:\.\d+)?)\]/.exec(tag);

  if (!match) return 0;

  return Number.parseInt(match[1], 10) * 60 + Number.parseFloat(match[2]);
}

function hasCJK(value: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(value);
}

function createMetadata(raw: Record<string, string>): ListeningLrcMetadata {
  return {
    title: raw.ti,
    artist: raw.ar,
    album: raw.al,
    by: raw.by,
    offset: raw.offset,
    raw,
  };
}

/**
 * 解析 Music 前端使用的 LRC 格式：英文|中文、相同时间戳的中英双行及元数据。
 * 不做时间排序，字幕和 end 均保持原文件顺序。
 */
export function parseLrc(text: string): ListeningLrcDocument {
  const rows = text.replace(/\r/g, "").split("\n");
  const metadata: Record<string, string> = {};
  const items: Array<Omit<ListeningLrcLine, "index" | "end">> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i].trim();

    if (!raw) continue;

    const metaMatch = raw.match(META_RE);

    if (metaMatch && !LINE_RE.test(raw)) {
      metadata[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    const match = raw.match(LINE_RE);

    if (!match) continue;

    const tags = match[1];
    const body = match[2].trim();
    let en = body;
    let cn = "";

    if (body.includes("|")) {
      const parts = body.split("|");

      en = parts[0].trim();
      cn = (parts[1] ?? "").trim();
    } else if (i + 1 < rows.length) {
      const nextMatch = rows[i + 1].trim().match(LINE_RE);

      if (nextMatch && nextMatch[1] === tags) {
        const nextText = nextMatch[2].trim();

        if (hasCJK(nextText)) {
          cn = nextText;
          i += 1;
        }
      }
    }

    // 与 Music 一致，多时间标签行使用首个时间标签。
    items.push({ start: timeTagToSeconds(tags), en, cn, raw });
  }

  const lines = items.map((item, index) => ({
    ...item,
    index,
    end: index + 1 < items.length ? items[index + 1].start : 0,
  }));

  return { metadata: createMetadata(metadata), lines, raw: text };
}

export function shouldSkipLine(item: ListeningLrcLine): boolean {
  const en = item.en.trim();
  const cn = item.cn.trim();

  if (!en) return true;
  if (/^Lesson\s+\d+$/i.test(en) && /^第\d+课$/.test(cn)) return true;
  if (/Listen to the tape/i.test(en)) return true;
  if (cn && en.length < 80 && cn.length < 80) {
    if (item.start < 7) return true;
    if (item.start < 10 && !en.endsWith("?")) return true;
  }

  return false;
}

export function findFirstContentIndex(items: ListeningLrcLine[]): number {
  const limit = Math.min(10, items.length);
  let skipped = 0;

  for (let i = 0; i < limit; i += 1) {
    if (shouldSkipLine(items[i])) skipped += 1;
    else return skipped > 0 ? i : 0;
  }

  return 0;
}

/** 按原文件顺序寻找当前句，兼容未按时间排序的 LRC。 */
export function findCurrentLineIndex(
  items: ListeningLrcLine[],
  time: number,
): number {
  if (items.length === 0) return -1;

  let current = 0;

  for (let i = 0; i < items.length; i += 1) {
    if (items[i].start <= time + 0.001) current = i;
  }

  return current;
}

export function getLineEnd(
  items: ListeningLrcLine[],
  index: number,
  duration: number,
): number {
  const line = items[index];

  if (!line) return duration;

  return line.end > line.start ? line.end : duration;
}

export function formatListeningTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
