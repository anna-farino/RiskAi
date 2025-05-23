import { Request, Response } from 'express';
import { db } from '../../db/db';
import { eq } from 'drizzle-orm';
import { reports } from '@shared/db/schema/reports';

export async function deleteReport(req: Request, res: Response) {
  const reportId = req.params.reportId;

  if (!reportId) {
    return res.status(400).json({ error: 'Report ID is required' });
  }

  try {
    const userId = (req as any).user.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log(`[Delete Report] Deleting report ${reportId} for user ${userId}`);
    
    // Delete the report with the given ID
    await db.delete(reports)
      .where(eq(reports.id, reportId))
      .execute();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
}