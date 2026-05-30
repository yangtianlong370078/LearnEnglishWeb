/**
 * 数据格式化工具
 */

/**
 * 格式化日期为本地字符串
 * @param date ISO字符串或Date对象
 * @param format 格式，默认 'YYYY-MM-DD'
 */
export function formatDate(
  date: string | Date | null | undefined,
  format: "YYYY-MM-DD" | "YYYY-MM-DD HH:mm" | "YYYY年MM月DD日" = "YYYY-MM-DD",
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  switch (format) {
    case "YYYY-MM-DD HH:mm":
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case "YYYY年MM月DD日":
      return `${year}年${month}月${day}日`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * 格式化百分比
 * @param value 0-1 之间的小数，或 0-100 的整数
 * @param isDecimal 是否为小数形式（默认 true）
 */
export function formatPercent(
  value: number | null | undefined,
  isDecimal = true,
): string {
  if (value == null) return "-";
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/**
 * 格式化数字，超过阈值显示 + 后缀
 * @example formatCount(1050) → "1k+"
 */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M+`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k+`;
  return String(value);
}
