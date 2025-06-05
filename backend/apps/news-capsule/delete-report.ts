import { Request, Response } from 'express';
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
      return res.status(404).json({ error: 'Report not found or access denied' });
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
    
    res.json({ 
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
}