import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, users, ownerProfiles, hirerProfiles } from '@hireclaw/db';
import { UserRole } from '@hireclaw/shared';
import { registerSchema, loginSchema } from '@hireclaw/validators';
import { signToken, type JwtPayload } from '../middleware/auth.js';

const auth = new Hono();

// POST /auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password, name, role } = parsed.data;
  const db = getDb();

  // Check existing user
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Determine roles array
  const roles: string[] = role === 'dual'
    ? [UserRole.Owner, UserRole.Hirer]
    : [role as string];

  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    name: name || null,
    role: roles as any,
  }).returning({ id: users.id, email: users.email, role: users.role });

  // Create profile(s)
  if (role === 'owner' || role === 'dual') {
    await db.insert(ownerProfiles).values({ userId: user.id });
  }
  if (role === 'hirer' || role === 'dual') {
    await db.insert(hirerProfiles).values({ userId: user.id });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } }, 201);
});

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

export default auth;
