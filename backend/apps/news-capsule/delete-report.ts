import { Request, Response } from 'express';
import { db } from '@backend/db/db';
import { eq } from 'drizzle-orm';
import { reports, capsuleArticlesInReports } from '@shared/db/schema/reports';

export async function deleteReport(req: Request, res: Response) {
  const reportId = req.params.reportId;

  if (!reportId) {
    return res.status(400).json({ error: 'Report ID is required' });
  }

  try {
    // First delete all relationships in the join table
    await db.delete(capsuleArticlesInReports)
      .where(eq(capsuleArticlesInReports.reportId, reportId))
      .execute();
      
    // Then delete the report itself
    await db.delete(reports)
      .where(eq(reports.id, reportId))
      .execute();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
}