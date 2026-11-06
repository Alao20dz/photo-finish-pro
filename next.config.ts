import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      // التطبيق الميداني (بناء ملف واحد) يعمل تحت /field/
      { source: "/field", destination: "/field/index.html" },
      { source: "/field/", destination: "/field/index.html" },
    ];
  },
};

export default nextConfig;
