/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only applies in development:
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://192.168.0.19:3000', // your LAN origin from the log
  ],

  // (Optional) If you show images from Blob/stock sites:
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.blob.core.windows.net' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'www.bunnings.com.au' },
      { protocol: 'https', hostname: 'bunnings.com.au' },
    ],
  },
};

module.exports = nextConfig;
