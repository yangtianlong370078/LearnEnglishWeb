/**
 * 本地存储封装（带类型安全和序列化）
 */

const TOKEN_COOKIE = "auth_token";

/** 写 cookie（仅浏览器） */
function setCookie(name: string, value: string, days = 7): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** 删除 cookie */
function removeCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

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
    setCookie(TOKEN_COOKIE, token);
  },

  /** 清除 token */
  clearToken: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("token");
    removeCookie(TOKEN_COOKIE);
  },
};
