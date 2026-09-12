import type { NextConfig } from "next";

/**
 * Car photography is uploaded to Supabase Storage, so next/image has to be
 * told the project's hostname. It is derived from the Supabase URL rather than
 * hardcoded, so a different project needs no config change.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /**
   * The occasion pages became service pages (§2). The four occasions still
   * exist as a pricing dimension, but they are no longer somewhere a reader
   * goes — and a link in a WhatsApp thread from last month has to keep working.
   */
  async redirects() {
    // Written out rather than imported: this file is compiled on its own, so a
    // `./lib` import here fails at build time with a module-not-found.
    return [
      { source: "/occasions", destination: "/services", permanent: true },
      { source: "/occasions/wedding", destination: "/services/wedding", permanent: true },
      { source: "/occasions/celebrity", destination: "/services/vip-transfers", permanent: true },
      { source: "/occasions/casual", destination: "/services/leisure", permanent: true },
      { source: "/occasions/tour", destination: "/services/outstation", permanent: true },
      { source: "/occasions/:slug", destination: "/services", permanent: false },
    ];
  },

  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
