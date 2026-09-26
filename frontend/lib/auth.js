import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export function getUserFromToken() {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_auth')?.value;
  
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded; // { username, role }
  } catch (err) {
    return null;
  }
}
