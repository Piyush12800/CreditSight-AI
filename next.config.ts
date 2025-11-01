// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   reactCompiler: true,
// };

// export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  reactCompiler: true,
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;