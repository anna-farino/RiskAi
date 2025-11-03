import { Router } from "express";

// Import all extracted handlers
import {
  validateEntity,
  autocomplete,
  getTechStack,
  addItem,
  deleteItem,
  toggleItem,
  triggerRelevance,
  bulkToggle,
  bulkDelete,
  upload,
  uploadConfig,
  getUploadProgress,
  importEntities
} from "./handlers";

const router = Router();

// POST /api/tech-stack/validate-entity - Validate entity type before adding
router.post("/validate-entity", validateEntity);

// GET /api/tech-stack/autocomplete - Search for entities to add to tech stack
router.get("/autocomplete", autocomplete);

// GET /api/tech-stack - Fetch user's tech stack with threat counts
router.get("/", getTechStack);

// POST /api/tech-stack/add - Add item to tech stack using AI extraction
router.post("/add", addItem);

// POST /api/tech-stack/trigger-relevance - Trigger relevance score calculation
router.post("/trigger-relevance", triggerRelevance);

// PUT /api/tech-stack/bulk-toggle - Enable/disable all items of a type or across all types
router.put("/bulk-toggle", bulkToggle);

// DELETE /api/tech-stack/bulk-delete - Delete all items of a type or across all types
router.delete("/bulk-delete", bulkDelete);

// DELETE /api/tech-stack/:itemId - Hard delete - completely removes item from tech stack
router.delete("/:itemId", deleteItem);

// PUT /api/tech-stack/:itemId/toggle - Enable/disable item in tech stack (soft delete)
router.put("/:itemId/toggle", toggleItem);

// POST /api/tech-stack/upload - Process spreadsheet file and extract entities
router.post("/upload", uploadConfig.single('file'), upload);

// GET /api/tech-stack/upload/:uploadId/progress - Get upload progress
router.get("/upload/:uploadId/progress", getUploadProgress);

// POST /api/tech-stack/import - Import selected entities to user's tech stack
router.post("/import", importEntities);

export default router;
