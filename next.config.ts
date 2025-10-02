/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 🚫 No bloqueará el build aunque haya errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 🚫 No bloqueará el build aunque haya errores de tipos
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
