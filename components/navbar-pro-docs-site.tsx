"use client";

import {
  Display,
  Moon,
  Sun,
  Bell,
  Person,
  Gear,
  ShieldCheck,
  Comment,
  ArrowRightFromSquare,
} from "@gravity-ui/icons";
import { Button, Avatar, Dropdown, Label, Separator } from "@heroui/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink from "next/link";
import { Navbar, Segment } from "@heroui-pro/react";

import { useTheme } from "@/app/providers";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/icons";
import { MaterBasic } from "@/components/meter-base";
import InlineSelectCustomIndicatorDemo from "@/components/common/inline-select-custom-indicator-demo";
import GlassNavigation from "@/components/common/glass-navigation";

function subscribeMounted(onStoreChange: () => void) {
  onStoreChange();

  return () => {};
}

function isTheme(value: string): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

export default function NavbarProDocsSite() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [activeHref, setActiveHref] = useState(pathname);
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
  const navItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const navPillRef = useRef<HTMLSpanElement>(null);
  const navMeasuredRef = useRef(false);

  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const index = siteConfig.navItems.findIndex(
        (item) => item.href === activeHref,
      );
      const item = navItemRefs.current[index];
      const pill = navPillRef.current;

      if (!item || !pill) {
        if (pill) {
          pill.style.visibility = "hidden";
          pill.getAnimations().forEach((animation) => animation.cancel());
        }
        navMeasuredRef.current = false;

        return;
      }

      if (animate && navMeasuredRef.current) {
        const prev = pill.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        pill.getAnimations().forEach((animation) => animation.cancel());
        pill.style.left = `${item.offsetLeft}px`;
        pill.style.top = `${item.offsetTop}px`;
        pill.style.width = `${itemRect.width}px`;
        pill.style.height = `${itemRect.height}px`;

        const dx = prev.left - itemRect.left;
        const dy = prev.top - itemRect.top;
        const sx = itemRect.width ? prev.width / itemRect.width : 1;
        const sy = itemRect.height ? prev.height / itemRect.height : 1;

        if (dx || dy || Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
          pill.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
              },
              { transform: "none" },
            ],
            { duration: 300, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
          );
        }
      } else {
        pill.style.left = `${item.offsetLeft}px`;
        pill.style.top = `${item.offsetTop}px`;
        pill.style.width = `${item.offsetWidth}px`;
        pill.style.height = `${item.offsetHeight}px`;
        pill.getAnimations().forEach((animation) => animation.cancel());
      }
      pill.style.visibility = "visible";
      navMeasuredRef.current = true;
    };

    measure(true);
    const onResize = () => measure(false);

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [activeHref]);

  return (
    <div className="sticky top-0 z-50 navbar-root">
      <GlassNavigation />
      <div aria-hidden="true" className="glass-overlay" />
      <Navbar
        className="glass-content !bg-transparent "
        maxWidth="full"
        position="sticky"
        shouldBlockScroll={false}
      >
        <div aria-hidden="true" className="glass-overlay" />

        <Navbar.Header className="relative !bg-transparent">
          <div aria-hidden="true" className="glass-overlay" />

          <Navbar.MenuToggle className="md:hidden" />

          {/* <Navbar.Brand>
          <BrandLogo />
          <span className="sr-only">记忆助手</span>
        </Navbar.Brand> */}

          <NextLink className="flex items-center gap-1 " href="/">
            <Logo />
            <p className="font-bold text-inherit">{siteConfig.name}</p>
          </NextLink>

          <Navbar.Content className="relative hidden gap-1 md:flex">
            <span
              ref={navPillRef}
              aria-hidden="true"
              className="invisible pointer-events-none absolute left-0 top-0 origin-top-left rounded-full bg-white shadow-md shadow-black/[0.06] will-change-transform dark:bg-white/15 dark:shadow-black/20"
            />
            {siteConfig.navItems.map((item, index) => {
              const isCurrent = item.href === pathname;
              const isActive = item.href === activeHref;

              return (
                <Navbar.Item
                  key={item.href}
                  ref={(element) => {
                    navItemRefs.current[index] = element;
                  }}
                  className={`relative z-[1] rounded-full px-3 font-medium transition-colors duration-300 ${
                    isActive
                      ? "text-foreground"
                      : "text-muted hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
                  }`}
                  href={item.href}
                  isCurrent={isCurrent}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveHref(item.href);
                    router.push(item.href);
                  }}
                >
                  {item.label}
                </Navbar.Item>
              );
            })}
          </Navbar.Content>
          <div className="absolute inset-0 m-auto w-fit h-fit">
            {" "}
            <MaterBasic />
          </div>

          <Navbar.Spacer />

          <Navbar.Content className="hidden md:flex ">
            <Segment
              // @ts-expect-error suppressHydrationWarning 由 HeroUI V3 Segment 支持但类型尚未屘露
              suppressHydrationWarning
              className="gap-0  !bg-white/50 dark:!bg-black/30 "
              selectedKey={mounted ? (theme ?? "system") : "system"}
              size="sm"
              onSelectionChange={(key) => {
                const nextTheme = String(key);

                if (isTheme(nextTheme)) setTheme(nextTheme);
              }}
            >
              <Segment.Item
                aria-label="Light"
                className="size-[28px] px-0"
                id="light"
              >
                <Sun className="size-3.5" />
              </Segment.Item>
              <Segment.Item
                aria-label="Dark"
                className="size-[28px] px-0"
                id="dark"
              >
                <Moon className="size-3.5" />
              </Segment.Item>
              <Segment.Item
                aria-label="System"
                className="size-[28px] px-0"
                id="system"
              >
                <Display className="size-3.5" />
              </Segment.Item>
            </Segment>

            <Navbar.Item>
              <Bell data-slot="icon" />
            </Navbar.Item>
          </Navbar.Content>

          <InlineSelectCustomIndicatorDemo />

          <Dropdown>
            <Button isIconOnly aria-label="User menu" variant="ghost">
              <Avatar className="size-7">
                <Avatar.Image
                  alt="User avatar"
                  src="https://img.heroui.chat/image/avatar?w=200&h=200&u=1"
                />
                <Avatar.Fallback>AJ</Avatar.Fallback>
              </Avatar>
            </Button>
            <Dropdown.Popover className="min-w-[200px]" placement="bottom end">
               <div aria-hidden="true" className="glass-overlay" />
              <Dropdown.Menu>
                <Dropdown.Item id="account" textValue="Your account">
                  <Person className="text-muted size-4" />
                  <Label>Your account</Label>
                </Dropdown.Item>
                <Dropdown.Item id="preferences" textValue="Preferences">
                  <Gear className="text-muted size-4" />
                  <Label>Preferences</Label>
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item id="security" textValue="Security & privacy">
                  <ShieldCheck className="text-muted size-4" />
                  <Label>Security & privacy</Label>
                </Dropdown.Item>
                <Dropdown.Item id="feedback" textValue="Send feedback">
                  <Comment className="text-muted size-4" />
                  <Label>Send feedback</Label>
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item id="sign-out" textValue="Log out">
                  <ArrowRightFromSquare className="text-muted size-4" />
                  <Label>Log out</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </Navbar.Header>

        <Navbar.Menu>
          {siteConfig.navItems.map((item) => (
            <Navbar.MenuItem
              key={item.href}
              href={item.href}
              isCurrent={item.href === pathname}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
              }}
            >
              {item.label}
            </Navbar.MenuItem>
          ))}
        </Navbar.Menu>
      </Navbar>
    </div>
  );
}
