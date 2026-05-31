"use client";

import { usePathname } from "next/navigation";

import NavbarProDocsSite from "./navbar-pro-docs-site";

/** 不需要顶部导航栏的路径 */
const NO_NAVBAR_PATHS = ["/login"];

/**
 * 根据当前路径决定是否渲染导航栏及主内容容器。
 * 登录页等独立页面不显示导航栏，直接全屏渲染子内容。
 */
export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStandalone = NO_NAVBAR_PATHS.includes(pathname);

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <>
      <NavbarProDocsSite />
      <main className="container mx-auto max-w-7xl px-6 py-6 flex-grow">
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3">
        <a
          className="flex items-center gap-1 text-current no-underline"
          href="https://heroui.com?utm_source=next-app-template"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="text-muted">Powered by</span>
          <p className="text-accent">HeroUI</p>
        </a>
      </footer>
    </>
  );
}
