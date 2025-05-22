import { db } from "backend/db/db";
import { log } from "backend/utils/log";
import { eq, and, desc } from "drizzle-orm";
import { capsules, capsuleArticles, capsulePreferences } from "@shared/db/schema/news-capsule";

type CreateCapsuleParams = {
  userId: string;
  title: string;
  duration: number;
  startTime: Date;
  sourcesToMonitor?: string[];
  status: 'active' | 'paused' | 'completed';
};

type CapsulePreferences = {
  autoGenerateCapsules?: boolean;
  frequencyHours?: number;
  receiveNotifications?: boolean;
  notifyOnKeywords?: boolean;
  includeAnalytics?: boolean;
  maxArticlesPerCapsule?: number;
};

export const storage = {
  /**
   * Creates a new capsule
   */
  async createCapsule(params: CreateCapsuleParams) {
    try {
      const [capsule] = await db.insert(capsules).values({
        userId: params.userId,
        title: params.title,
        duration: params.duration,
        startTime: params.startTime,
        sourcesToMonitor: params.sourcesToMonitor || [],
        status: params.status
      }).returning();
      
      return capsule;
    } catch (error) {
      log(`Error creating capsule: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Gets the current active capsule for a user
   */
  async getCurrentCapsule(userId: string) {
    try {
      const [activeCapsule] = await db
        .select()
        .from(capsules)
        .where(
          and(
            eq(capsules.userId, userId),
            eq(capsules.status, 'active')
          )
        )
        .orderBy(desc(capsules.startTime))
        .limit(1);
        
      return activeCapsule || null;
    } catch (error) {
      log(`Error getting current capsule: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Gets a specific capsule by ID
   */
  async getCapsuleById(capsuleId: string) {
    try {
      const [capsule] = await db
        .select()
        .from(capsules)
        .where(eq(capsules.id, capsuleId));
        
      return capsule || null;
    } catch (error) {
      log(`Error getting capsule by ID: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Gets all capsules for a user, ordered by start time
   */
  async getCapsulesByUser(userId: string) {
    try {
      const userCapsules = await db
        .select()
        .from(capsules)
        .where(eq(capsules.userId, userId))
        .orderBy(desc(capsules.startTime));
        
      return userCapsules;
    } catch (error) {
      log(`Error getting capsules by user: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Updates a capsule's status
   */
  async updateCapsuleStatus(capsuleId: string, status: 'active' | 'paused' | 'completed') {
    try {
      const [updatedCapsule] = await db
        .update(capsules)
        .set({ 
          status,
          ...(status === 'completed' ? { endTime: new Date() } : {})
        })
        .where(eq(capsules.id, capsuleId))
        .returning();
        
      return updatedCapsule;
    } catch (error) {
      log(`Error updating capsule status: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Gets all articles for a specific capsule
   */
  async getCapsuleArticles(capsuleId: string) {
    try {
      const articles = await db
        .select()
        .from(capsuleArticles)
        .where(eq(capsuleArticles.capsuleId, capsuleId));
        
      return articles;
    } catch (error) {
      log(`Error getting capsule articles: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Adds an article to a capsule
   */
  async addArticleToCapsule(capsuleId: string, articleData: any) {
    try {
      const [article] = await db
        .insert(capsuleArticles)
        .values({
          capsuleId,
          ...articleData
        })
        .returning();
        
      return article;
    } catch (error) {
      log(`Error adding article to capsule: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Gets user preferences for news capsules
   */
  async getUserPreferences(userId: string) {
    try {
      const [preferences] = await db
        .select()
        .from(capsulePreferences)
        .where(eq(capsulePreferences.userId, userId));
        
      if (preferences) {
        return preferences;
      }
      
      // If no preferences exist, create default preferences
      return this.updateUserPreferences(userId, {
        autoGenerateCapsules: true,
        frequencyHours: 24,
        receiveNotifications: true,
        notifyOnKeywords: true,
        includeAnalytics: true,
        maxArticlesPerCapsule: 50
      });
    } catch (error) {
      log(`Error getting user preferences: ${error}`, "news-capsule");
      throw error;
    }
  },
  
  /**
   * Updates user preferences for news capsules
   */
  async updateUserPreferences(userId: string, preferences: CapsulePreferences) {
    try {
      // Check if preferences already exist
      const existingPrefs = await db
        .select()
        .from(capsulePreferences)
        .where(eq(capsulePreferences.userId, userId));
      
      if (existingPrefs.length > 0) {
        // Update existing preferences
        const [updatedPrefs] = await db
          .update(capsulePreferences)
          .set(preferences)
          .where(eq(capsulePreferences.userId, userId))
          .returning();
          
        return updatedPrefs;
      } else {
        // Create new preferences
        const [newPrefs] = await db
          .insert(capsulePreferences)
          .values({
            userId,
            ...preferences
          })
          .returning();
          
        return newPrefs;
      }
    } catch (error) {
      log(`Error updating user preferences: ${error}`, "news-capsule");
      throw error;
    }
  }
};