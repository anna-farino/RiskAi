import { Request, Response } from 'express';
import { db } from 'backend/db/db';
import { eq } from 'drizzle-orm';
import { users } from '@shared/db/schema/user';
import { FullRequest } from '../middleware';

export async function handleCompleteOnboarding(req: Request, res: Response) {
  console.log("[🎯 ONBOARDING] Marking user onboarding as complete...");

  try {
    const userId = (req as unknown as FullRequest).user.id;

    if (!userId) {
      console.log("[🎯 ONBOARDING] No user found in request");
      return res.status(400).json({ error: "No user found" });
    }

    // Update user's onboarded status
    await db
      .update(users)
      .set({ onBoarded: true })
      .where(eq(users.id, userId));

    console.log("[🎯 ONBOARDING] User onboarding marked complete:", userId);

    res.json({
      success: true,
      message: "Onboarding completed successfully"
    });

  } catch (error: unknown) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }
    console.error("[🎯 ONBOARDING] Error:", message);
    res.status(500).json({
      error: "Failed to complete onboarding",
      details: message
    });
  }
}
