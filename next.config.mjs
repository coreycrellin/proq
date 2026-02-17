/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["node-pty", "ws", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
