/**
 * 本地存储封装（带类型安全和序列化）
 */

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储已满或不可用，静默失败
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export const storage = {
  get: safeGet,
  set: safeSet,
  remove: safeRemove,

  /** 读取 token */
  getToken: (): string | null => {
    if (typeof window === "undefined") return null;

    return localStorage.getItem("token");
  },

  /** 存储 token（同步写 cookie 供 middleware 鉴权） */
  setToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem("token", token);
  },

  /** 清除 token */
  clearToken: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("token");
    void fetch("/api/logout", { method: "POST" });
  },
};
