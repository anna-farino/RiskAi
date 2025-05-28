import { useState, useEffect, useCallback, useRef } from "react";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";
import type { ScrapingProgress, ScrapingActivity, ScrapingError } from "../components/scraping-progress-dialog";

export function useScrapingProgress() {
  const [progress, setProgress] = useState<ScrapingProgress>({
    isRunning: false,
    progress: {
      sources: { total: 0, completed: 0, current: 0 },
      articles: { total: 0, processed: 0, saved: 0, skipped: 0 }
    },
    activities: [],
    errors: []
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityIdRef = useRef(0);
  const errorIdRef = useRef(0);

  // Generate unique IDs for activities and errors
  const generateActivityId = () => `activity_${++activityIdRef.current}_${Date.now()}`;
  const generateErrorId = () => `error_${++errorIdRef.current}_${Date.now()}`;

  // Add activity to the log
  const addActivity = useCallback((activity: Omit<ScrapingActivity, 'id' | 'timestamp'>) => {
    const newActivity: ScrapingActivity = {
      ...activity,
      id: generateActivityId(),
      timestamp: new Date()
    };

    setProgress(prev => ({
      ...prev,
      activities: [...prev.activities, newActivity]
    }));
  }, []);

  // Add error to the log
  const addError = useCallback((error: Omit<ScrapingError, 'id' | 'timestamp'>) => {
    const newError: ScrapingError = {
      ...error,
      id: generateErrorId(),
      timestamp: new Date()
    };

    setProgress(prev => ({
      ...prev,
      errors: [...prev.errors, newError]
    }));
  }, []);

  // Check job status and update progress
  const checkJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/news-radar/jobs/status`, {
        credentials: 'include',
        headers: csfrHeaderObject(),
      });

      if (!response.ok) {
        throw new Error(`Failed to check job status: ${response.statusText}`);
      }

      const status = await response.json();
      
      setProgress(prev => ({
        ...prev,
        isRunning: status.running
      }));

      // If job stopped running, stop polling
      if (!status.running && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        
        // Add completion activity
        addActivity({
          type: 'source_complete',
          message: 'Scraping job completed'
        });
      }

      return status.running;
    } catch (error) {
      console.error('Error checking job status:', error);
      addError({
        type: 'network_error',
        error: `Failed to check job status: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
  }, [addActivity, addError]);

  // Start scraping job
  const startScraping = useCallback(async () => {
    try {
      // Reset progress state
      setProgress({
        isRunning: true,
        progress: {
          sources: { total: 0, completed: 0, current: 0 },
          articles: { total: 0, processed: 0, saved: 0, skipped: 0 }
        },
        activities: [],
        errors: []
      });

      // Reset ID counters
      activityIdRef.current = 0;
      errorIdRef.current = 0;

      // Open dialog
      setIsDialogOpen(true);

      // Add initial activity
      addActivity({
        type: 'source_start',
        message: 'Starting global scraping job...'
      });

      const response = await fetch(`${serverUrl}/api/news-radar/jobs/scrape`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject(),
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to start scraping: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        addActivity({
          type: 'source_start',
          message: 'Scraping job started successfully'
        });

        // Start polling for status updates
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        
        pollIntervalRef.current = setInterval(checkJobStatus, 2000);
        checkJobStatus(); // Initial check
        
      } else {
        throw new Error(result.message || 'Failed to start scraping job');
      }

      return result;
    } catch (error) {
      console.error('Error starting scraping:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      addError({
        type: 'source_error',
        error: errorMessage
      });

      setProgress(prev => ({ ...prev, isRunning: false }));
      throw error;
    }
  }, [addActivity, addError, checkJobStatus]);

  // Stop scraping job
  const stopScraping = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/api/news-radar/jobs/stop`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...csfrHeaderObject(),
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to stop scraping: ${response.statusText}`);
      }

      const result = await response.json();
      
      addActivity({
        type: 'source_complete',
        message: 'Scraping job stopped by user'
      });

      setProgress(prev => ({ ...prev, isRunning: false }));

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      return result;
    } catch (error) {
      console.error('Error stopping scraping:', error);
      addError({
        type: 'source_error',
        error: `Failed to stop scraping: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }, [addActivity, addError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Check initial job status
  useEffect(() => {
    checkJobStatus();
  }, [checkJobStatus]);

  return {
    progress,
    isDialogOpen,
    setIsDialogOpen,
    startScraping,
    stopScraping,
    checkJobStatus
  };
}