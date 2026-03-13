import type { NextConfig } from "next";

// 临时禁用 PWA 以排查缓存问题
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true, // 完全禁用 PWA
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig: NextConfig = {
  // 禁用开发工具指示器（移除左下角 N 字悬浮按钮）
  devIndicators: false,
};

export default withPWA(nextConfig);
