export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "记忆助手",
  description: "Make beautiful websites regardless of your design experience.",
  navItems: [
    {
      label: "首页",
      href: "/",
    },
    {
      label: "学单词",
      href: "/learnwords",
    },
    {
      label: "练听力",
      href: "/listening",
    },

    {
      label: "试题",
      href: "/exam",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "Team",
      href: "/team",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
    {
      label: "Settings",
      href: "/settings",
    },
    {
      label: "Help & Feedback",
      href: "/help-feedback",
    },
    {
      label: "Logout",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
