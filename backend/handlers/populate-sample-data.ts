import { Request, Response } from 'express';
import { populateSampleDataForNewUser, userHasExistingData } from '../services/sample-data-populator';
import { FullRequest } from '../middleware';

export async function handlePopulateSampleData(req: Request, res: Response) {
  try {
    const user = (req as FullRequest).user;
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has data
    const hasExistingData = await userHasExistingData(user.id);
    const { force } = req.body;
    
    if (hasExistingData && !force) {
      return res.status(400).json({ 
        error: 'User already has existing data. Use force=true to override.',
        hasExistingData: true
      });
    }

    // Populate sample data
    const result = await populateSampleDataForNewUser(user.id, user.email);
    
    if (result.success) {
      res.status(200).json({
        message: 'Sample data populated successfully',
        ...result
      });
    } else {
      res.status(500).json({
        error: 'Failed to populate sample data',
        ...result
      });
    }
    
  } catch (error: any) {
    console.error('Sample data population error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

export async function handleCheckSampleDataStatus(req: Request, res: Response) {
  try {
    const user = (req as FullRequest).user;
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasExistingData = await userHasExistingData(user.id);
    
    res.status(200).json({
      hasExistingData,
      userEmail: user.email,
      canPopulate: user.email.endsWith('@altairtek.com') && process.env.NODE_ENV !== 'production'
    });
    
  } catch (error: any) {
    console.error('Sample data status check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}