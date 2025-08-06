import { Request, Response } from 'express';
import { withUserContext } from '../../db/with-user-context';
import { db } from '../../db/db';
import { reports } from '../../../shared/db/schema/reports';
import { and, eq } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

export async function deleteReport(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    const reportId = req.params.id;
    
    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    await withUserContext(
      userId,
      async (db) => {
        // Verify the report exists and belongs to the user before deleting
        const existingReport = await db
          .select()
          .from(reports)
          .where(
            and(
              eq(reports.id, reportId),
              eq(reports.userId, userId)
            )
          )
          .limit(1);
        
        if (existingReport.length === 0) {
          throw new Error('Report not found or access denied');
        }
        
        // Delete the report (cascade will handle removing from capsuleArticlesInReports)
        await db
          .delete(reports)
          .where(
            and(
              eq(reports.id, reportId),
              eq(reports.userId, userId)
            )
          );
      }
    );
    
    res.json({ 
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    if (error instanceof Error && error.message === 'Report not found or access denied') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete report' });
  }
}