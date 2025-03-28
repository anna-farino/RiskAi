import { Request, Response } from 'express';
import { db } from '../db/db';
import { users } from '../db/schema/user';
import { hashString } from '../utils/auth';
import { eq, sql } from 'drizzle-orm';
import { roles, rolesUsers } from '../db/schema/rbac';
import { use } from 'passport';

export async function handleSignUp(req: Request, res: Response) {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log('Received signup request:', { email, name }); // Log request data (excluding password)

  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashString(password);

    if (!hashedPassword) {
      return res.status(500).json({ error: 'Failed to hash password' });
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        name,
        createdAt: new Date(),
      })
      .returning();

    const [userRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name,"user"))

    if (userRole) {
      await db
        .insert(rolesUsers)
        .values({
          roleId: userRole.id,
          userId: newUser.id
        })
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    console.log("Created user:", userWithoutPassword)
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
