/** 液态玻璃独立配置；修改后刷新页面，生产环境需重新构建。 */
export const liquidGlassConfig = {
  /** 边缘透镜宽度 / 最大 UV 偏移（CSS px）。不改变现有模糊和边框,扭曲的宽度。
   *   edgeWidthPx: 28
   */
  edgeWidthPx: 20,
  /** 最外侧不添加折射的保留宽度（CSS px，非负，可小数）；0 取消保留带。
   * edgeInsetPx: 1,
   * refractionPx: 14,  扭曲的强度
   */
  edgeInsetPx: 1,
  refractionPx: 38,
  /**
   * 边缘扭曲轮廓（复刻 iOS 液态玻璃）：最外缘位移为 0、与背景无缝衔接，
   * 进入边缘后迅速增强，在 bendPeak 处达到 refractionPx 的峰值后向内侧平滑归零。
   * bendPeak：峰值位置，占扭曲带宽度的比例（0–1），越小越贴近外缘。
   *   edgeBendPeak: 0.26
   * bendSharpness：轮廓锐度，越大扭曲越集中在峰值附近、衰减越快。
   *   edgeBendSharpness: 2.7
   */
  edgeBendPeak: 0.1,
  edgeBendSharpness: 2.7,
  /** 附加菲涅尔反光强度（0–1），仅作用于透镜内侧。 
   * fresnelStrength: 0.12, 反光度
   * dispersionPx: 1.25,
  */
  fresnelStrength: 0,
  dispersionPx: 1.25,
  /** 两个独立开关：true 关闭色散，并编译为单次纹理采样。 
   * disableDispersionDesktop: false,
   * disableDispersionMobile: true,
  */
  disableDispersionDesktop: false,
  disableDispersionMobile: true,
  /** 小屏或粗指针设备使用移动端预算。 */
  mobileBreakpointPx: 768,
  desktop: { maxCards: 20, maxDpr: 1, maxPixels: 1_500_000 },
  mobile: { maxCards: 15, maxDpr: 1, maxPixels: 500_000 },
  /** 静止时没有渲染循环；连续慢帧时在本次滚动期间退回普通玻璃。 */
  adaptive: {
    enabled: true,
    slowFrameMs: 34,
    workBudgetMs: 8,
    consecutiveSlowFrames: 8,
    scrollEndDelayMs: 160,
  },
} as const;
