"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@heroui/react";

import { login } from "@/lib/api/modules/auth";
import { storage } from "@/utils/storage";

export default function LoginPage() {
  const router = useRouter();
  const [loginID, setLoginID] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 用 FormData 直接读取 DOM 值，避免浏览器自动填充未触发 onChange 导致 state 为空
    const data = new FormData(e.currentTarget);
    const loginIDValue = ((data.get("loginID") as string) ?? "").trim();
    const passwordValue = ((data.get("password") as string) ?? "").trim();

    if (!loginIDValue || !passwordValue) {
      setError("请输入账户和密码");

      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await login({
        loginID: loginIDValue,
        password: passwordValue,
      });

      storage.setToken(result.token);
      storage.set("user", result.user);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "登录失败，请检查账户和密码",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-indigo-950 dark:to-gray-900">
      {/* 背景装饰圆 */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 rounded-full bg-gradient-to-tl from-purple-400/20 to-pink-500/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm px-4 z-10">
        {/* Logo 区域 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            LearnEnglish
          </h1>
          <p className="text-sm text-muted mt-1">登录您的账户继续学习</p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-xl border border-separator/50 backdrop-blur-sm bg-background/90">
          <Card.Content className="p-8">
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* 账户输入 */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="loginID"
                >
                  账户
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    autoComplete="username"
                    className="w-full rounded-xl border border-separator bg-background/60 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    id="loginID"
                    name="loginID"
                    placeholder="请输入账户"
                    type="text"
                    value={loginID}
                    onChange={(e) => setLoginID(e.target.value)}
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="password"
                >
                  密码
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-separator bg-background/60 py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    id="password"
                    name="password"
                    placeholder="请输入密码"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* 登录按钮 */}
              <Button
                className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
                isDisabled={loading}
                size="lg"
                type="submit"
              >
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
