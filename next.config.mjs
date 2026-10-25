/** @type {import('next').NextConfig} */
const nextConfig = {
  // مهم: Supabase Realtime لا يحب تركيب/إزالة القناة مرتين في وضع التطوير
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
