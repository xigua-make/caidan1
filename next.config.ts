import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/],
  cacheId: "xiaogua-perler-v2", // 更新缓存ID，强制清除旧缓存
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "xiaogua-offline-v2", // 更新缓存名称
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        networkTimeoutSeconds: 10, // 添加网络超时时间
      },
    },
  ],
});

const nextConfig: NextConfig = {
  // 禁用开发工具指示器（移除左下角 N 字悬浮按钮）
  devIndicators: false,
};

export default withPWA(nextConfig);
