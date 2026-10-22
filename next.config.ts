import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Uploaded/meme images from The Humor Project's Supabase Storage only
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ysucsqkyvsishalfqeld.supabase.co",
        pathname: "/storage/v1/object/public/images/**",
      },
    ],
  },
};

export default nextConfig;
