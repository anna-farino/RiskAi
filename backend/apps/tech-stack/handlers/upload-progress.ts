import { Response } from "express";
import { uploadProgress } from "../../../services/upload-progress";

// GET /api/tech-stack/upload/:uploadId/progress - Get upload progress
export async function getUploadProgress(req: any, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { uploadId } = req.params;
  // Use getForUser to ensure users can only see their own uploads (security)
  const progress = uploadProgress.getForUser(uploadId, userId);
  
  if (!progress) {
    return res.status(404).json({ error: "Upload not found" });
  }
  
  // Transform the internal progress format to match frontend expectations
  res.json({
    uploadId: progress.id,
    status: progress.status,
    message: progress.message,
    percentage: progress.progress, // Map 'progress' to 'percentage' for frontend
    entityCount: progress.entitiesFound,
    rowsProcessed: progress.processedRows,
    totalRows: progress.totalRows,
    importedCount: progress.entitiesFound,
    error: progress.errors?.join(', '),
    entities: progress.entities, // Include entities if available
  });
}
