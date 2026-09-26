/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
    return [
      { source: '/', destination: '/index.html' },
      { source: '/about', destination: '/about.html' },
      { source: '/project', destination: '/project.html' },
      { source: '/projects', destination: '/project.html' },
      { source: '/ongoing-events', destination: '/ongoing-events.html' },
      { source: '/admin', destination: '/admin/index.html' },
      { source: '/admin/login', destination: '/admin/login.html' },
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` }
    ];
  },
};

module.exports = nextConfig;
