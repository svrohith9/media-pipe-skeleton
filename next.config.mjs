import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /\/tfjs\//,
      handler: "CacheFirst",
      options: {
        cacheName: "tfjs-cache",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
  ],
});

const isExport = process.env.NEXT_PUBLIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: isExport,
  },
  output: isExport ? "export" : undefined,
};

export default withPWA(nextConfig);
