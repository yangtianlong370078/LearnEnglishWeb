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
import { useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink from "next/link";
import { Navbar, Segment } from "@heroui-pro/react";

import { useTheme } from "@/app/providers";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/icons";
import { MaterBasic } from "@/components/meter-base";
import InlineSelectCustomIndicatorDemo from "@/components/common/inline-select-custom-indicator-demo";

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
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );

  return (
    <div className="backdrop-blur-xl backdrop-saturate-150">
      <Navbar
        className="bg-transparent"
        maxWidth="full"
        position="static"
        shouldBlockScroll={false}
      >
        <Navbar.Header className="relative ">
          <Navbar.MenuToggle className="md:hidden" />

          {/* <Navbar.Brand>
          <BrandLogo />
          <span className="sr-only">记忆助手</span>
        </Navbar.Brand> */}

          <NextLink className="flex items-center gap-1" href="/">
            <Logo />
            <p className="font-bold text-inherit">{siteConfig.name}</p>
          </NextLink>

          <Navbar.Content className="hidden gap-0 md:flex">
            {siteConfig.navItems.map((item) => (
              <Navbar.Item
                key={item.href}
                className="px-2"
                href={item.href}
                isCurrent={item.href === pathname}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                }}
              >
                {item.label}
              </Navbar.Item>
            ))}
          </Navbar.Content>
          <div className="absolute inset-0 m-auto w-fit h-fit">
            {" "}
            <MaterBasic />
          </div>

          <Navbar.Spacer />

          <Navbar.Content className="hidden md:flex">
            {/* <SearchField
            aria-label="Search documentation"
            className="w-[200px]"
            variant="secondary"
          >
            <SearchField.Group className="h-8">
              <SearchField.SearchIcon />
              <SearchField.Input className="w-16" placeholder="Search docs…" />
              <Kbd className="pointer-events-none mr-1.5 text-xs">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>K</Kbd.Content>
              </Kbd>
            </SearchField.Group>
          </SearchField> */}

            <Segment
              // @ts-expect-error suppressHydrationWarning 由 HeroUI V3 Segment 支持但类型尚未屘露
              suppressHydrationWarning
              className="gap-0  bg-white/50 dark:bg-black/30 "
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
