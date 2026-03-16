/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['better-sqlite3', '@github/copilot-sdk', '@github/copilot', 'vscode-jsonrpc'],
};

module.exports = nextConfig;
