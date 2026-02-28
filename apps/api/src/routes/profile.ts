import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, users, ownerProfiles, hirerProfiles } from '@hireclaw/db';
import { UserRole } from '@hireclaw/shared';
import { updateProfileSchema } from '@hireclaw/validators';
import { authMiddleware, type JwtPayload, type AuthEnv } from '../middleware/auth.js';

const profile = new Hono<AuthEnv>();

profile.use('*', authMiddleware);

// GET /profile
profile.get('/', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
    role: users.role,
    status: users.status,
    emailVerified: users.emailVerified,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Fetch role-specific profiles
  let ownerProfile = null;
  let hirerProfile = null;

  if (user.role.includes(UserRole.Owner)) {
    const [op] = await db.select().from(ownerProfiles).where(eq(ownerProfiles.userId, userId)).limit(1);
    ownerProfile = op || null;
  }
  if (user.role.includes(UserRole.Hirer)) {
    const [hp] = await db.select().from(hirerProfiles).where(eq(hirerProfiles.userId, userId)).limit(1);
    hirerProfile = hp || null;
  }

  return c.json({ ...user, ownerProfile, hirerProfile });
});

// PUT /profile
profile.put('/', async (c) => {
  const { userId } = c.get('user');
  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
    role: users.role,
  });

  if (!updated) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Update bio in profile tables if provided
  if (parsed.data.bio !== undefined) {
    if (updated.role.includes(UserRole.Owner)) {
      await db.update(ownerProfiles).set({ bio: parsed.data.bio }).where(eq(ownerProfiles.userId, userId));
    }
    if (updated.role.includes(UserRole.Hirer)) {
      await db.update(hirerProfiles).set({ bio: parsed.data.bio }).where(eq(hirerProfiles.userId, userId));
    }
  }

  return c.json(updated);
});

export default profile;
