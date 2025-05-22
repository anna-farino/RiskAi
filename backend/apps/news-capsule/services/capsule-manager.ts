import { storage } from "../queries/capsule";
import { log } from "backend/utils/log";

type CapsuleOptions = {
  duration?: number; // in hours
  sourcesToMonitor?: string[];
};

/**
 * Creates a new news capsule
 */
export async function createCapsule(userId: string, title: string, options?: CapsuleOptions) {
  try {
    log(`Creating new capsule "${title}" for user ${userId}`, "news-capsule");
    
    // Default options
    const duration = options?.duration || 24; // 24 hours default
    const sourcesToMonitor = options?.sourcesToMonitor || [];
    
    // Create the capsule
    const capsule = await storage.createCapsule({
      userId,
      title,
      duration,
      sourcesToMonitor,
      startTime: new Date(),
      status: 'active'
    });
    
    // If there's already an active capsule, mark it as completed
    const currentCapsule = await storage.getCurrentCapsule(userId);
    if (currentCapsule && currentCapsule.id !== capsule.id) {
      await storage.updateCapsuleStatus(currentCapsule.id, 'completed');
    }
    
    return capsule;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error creating capsule: ${errorMessage}`, "news-capsule");
    throw error;
  }
}

/**
 * Gets the current active capsule for a user
 */
export async function getCurrentCapsule(userId: string) {
  try {
    const capsule = await storage.getCurrentCapsule(userId);
    
    if (!capsule) {
      return {
        exists: false,
        message: "No active capsule found"
      };
    }
    
    // Get articles collected in this capsule
    const articles = await storage.getCapsuleArticles(capsule.id);
    
    return {
      exists: true,
      capsule,
      articleCount: articles.length,
      sourcesMonitored: capsule.sourcesToMonitor?.length || 0
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error getting current capsule: ${errorMessage}`, "news-capsule");
    throw error;
  }
}

/**
 * Generates a summary for a specific capsule
 */
export async function generateCapsuleSummary(userId: string, capsuleId: string) {
  try {
    // Verify the capsule belongs to the user
    const capsule = await storage.getCapsuleById(capsuleId);
    
    if (!capsule) {
      throw new Error("Capsule not found");
    }
    
    if (capsule.userId !== userId) {
      throw new Error("Unauthorized access to capsule");
    }
    
    // Get articles in the capsule
    const articles = await storage.getCapsuleArticles(capsuleId);
    
    if (articles.length === 0) {
      return {
        capsuleId,
        title: capsule.title,
        summary: "No articles found in this capsule",
        keyTopics: [],
        articleCount: 0
      };
    }
    
    // In a real implementation, you might use OpenAI here to generate a summary
    // For now, we'll return a placeholder summary
    return {
      capsuleId,
      title: capsule.title,
      summary: `This capsule contains ${articles.length} articles collected over ${capsule.duration} hours.`,
      keyTopics: ["Security", "Vulnerabilities", "Threats"],
      articleCount: articles.length,
      startTime: capsule.startTime,
      endTime: capsule.endTime || new Date()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error generating capsule summary: ${errorMessage}`, "news-capsule");
    throw error;
  }
}