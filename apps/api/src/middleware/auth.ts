import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string[];
}

export type AuthEnv = {
  Variables: {
    user: JwtPayload;
  };
};

const JWT_SECRET = process.env.JWT_SECRET || 'hireclaw-dev-secret';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    c.set('user' as never, payload as never);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
