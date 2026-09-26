import { NextResponse } from 'next/server';

// We use cookie existence for basic middleware protection, 
// and verify the actual JWT inside the API route.

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  
  // Public paths in /tb-managers
  if (path === '/tb-managers/login.html' || path === '/tb-managers/admin.css' || path === '/tb-managers/login') {
    return NextResponse.next();
  }

  // Block legacy /admin route completely
  if (path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', request.url)); // Or to 404
  }

  // Check if it's an admin frontend route
  if (path.startsWith('/tb-managers')) {
    const token = request.cookies.get('admin_auth')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/tb-managers/login', request.url));
    }
    // We assume token is valid here, deeper check can be done in API.
    return NextResponse.next();
  }

  // API protection
  if (path.startsWith('/api/')) {
    const isPublicApi = 
      path === '/api/login' || 
      path === '/api/logout' ||
      path.startsWith('/api/analytics') ||
      (request.method === 'GET' && (
        path.startsWith('/api/past-works') ||
        path.startsWith('/api/ongoing-events') ||
        path.startsWith('/api/categories') ||
        path.startsWith('/api/site-content') ||
        path.startsWith('/api/statistics')
      ));

    if (!isPublicApi) {
      const token = request.cookies.get('admin_auth')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Token is present, we pass it down. 
      // The API routes that require 'master' role will need to decode the token.
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/tb-managers/:path*', '/admin/:path*', '/api/:path*'],
};
