// cordely-owners/next.config.mjs
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // "@/..." -> "<repo>/cordely-owners/src/..."
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};

export default nextConfig;
