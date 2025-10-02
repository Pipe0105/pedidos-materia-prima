/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ❌ No bloqueará el build por errores de lint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ❌ No bloqueará el build por errores de TS
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
