/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 🚫 No bloqueará el build aunque haya errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 🚫 No bloqueará el build aunque haya errores de TypeScript
    ignoreBuildErrors: true,
  },
  experimental: {
    // Opcional: asegura compatibilidad con Turbopack en Next 15
    turbo: {},
  },
};

module.exports = nextConfig;
