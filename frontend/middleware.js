import { NextResponse } from 'next/server';

// We use cookie existence for basic middleware protection, 
// and verify the actual JWT inside the API route.

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  
  // Public paths in /admin
  if (path === '/admin/login.html' || path === '/admin/admin.css') {
    return NextResponse.next();
  }

  // Check if it's an admin frontend route
  if (path.startsWith('/admin')) {
    const token = request.cookies.get('admin_auth')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login.html', request.url));
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
  matcher: ['/admin/:path*', '/api/:path*'],
};
