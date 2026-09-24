// 离线友好：不再依赖 next/font/google（构建/启动时需要联网拉取 Google Fonts，
// 断网环境会报 Module not found: @vercel/turbopack-next/internal/font/google/font）。
// 字体改为使用 globals.css 中 @theme 定义的系统字体栈（--font-sans / --font-mono），
// 不发起任何网络请求，build 与 dev 均可在离线环境正常启动。
export const fontSans = {
  variable: "",
};

export const fontMono = {
  variable: "",
};
