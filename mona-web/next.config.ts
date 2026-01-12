import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",  // Google profile pictures
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",  // Discord avatars
      },
    ],
  },
};

export default nextConfig;
