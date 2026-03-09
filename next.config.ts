import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // pdf-parse ve mammoth için — Next.js bu paketleri sunucu tarafında bundle etmez
    serverExternalPackages: ["pdf-parse", "mammoth"],
    // Turbopack yapılandırması (Next.js 16 varsayılanı)
    turbopack: {},
};

export default nextConfig;
