import { useState, useEffect, useRef } from 'react';
import { useFetch } from '@/hooks/use-fetch';

export interface UploadProgress {
  uploadId: string;
  status: 'validating' | 'parsing' | 'extracting' | 'importing' | 'completed' | 'failed';
  message: string;
  percentage: number;
  entityCount?: number;
  rowsProcessed?: number;
  totalRows?: number;
  importedCount?: number;
  error?: string;
  entities?: any[]; // Array of extracted entities returned when status is 'completed'
}

interface UseUploadProgressOptions {
  onComplete?: (progress: UploadProgress) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
}

export function useUploadProgress(
  uploadId: string | null,
  options: UseUploadProgressOptions = {}
) {
  const { onComplete, onError, pollInterval = 1000 } = options;
  const fetchWithAuth = useFetch();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!uploadId) {
      setProgress(null);
      setIsPolling(false);
      completedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset completed flag when uploadId changes
    completedRef.current = false;
    setIsPolling(true);
    
    // Store poll start time and reset error counter
    (window as any).__uploadPollStartTime = Date.now();
    (window as any).__uploadErrorCount = 0;

    const checkProgress = async () => {
      try {
        // Add suppressErrors flag for initial polls to avoid 404 console errors
        const pollStartTime = (window as any).__uploadPollStartTime || Date.now();
        if (!((window as any).__uploadPollStartTime)) {
          (window as any).__uploadPollStartTime = pollStartTime;
        }
        
        // For the first 2 seconds, expect potential 404s and suppress them
        const isInitialPoll = Date.now() - pollStartTime < 2000;
        
        const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/upload/${uploadId}/progress`, {
          ...(isInitialPoll && { cache: 'no-cache' }) // Ensure fresh data during initial polls
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Upload not found yet - this is expected in the first few polls
            // Keep polling for a bit before giving up (backend might still be creating it)
            
            // Give it 5 seconds for the upload to start being tracked
            if (Date.now() - pollStartTime > 5000) {
              // After 5 seconds, stop polling - upload probably failed to start
              setIsPolling(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              delete (window as any).__uploadPollStartTime;
            }
            // Otherwise, silently continue polling
            return;
          }
          throw new Error('Failed to fetch progress');
        }

        const data: UploadProgress = await response.json();
        setProgress(data);
        
        // Reset error counter on successful response
        (window as any).__uploadErrorCount = 0;

        // Handle completion or failure
        if ((data.status === 'completed' || data.status === 'failed') && !completedRef.current) {
          completedRef.current = true;
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          if (data.status === 'completed' && onComplete) {
            onComplete(data);
          } else if (data.status === 'failed' && onError) {
            onError(data.error || 'Upload failed');
          }
        }
      } catch (error) {
        console.error('Error checking upload progress:', error);
        // Don't stop polling on network errors - the upload might still be running
        // But increment error count to detect persistent failures
        if (!intervalRef.current) return; // Already stopped
        
        // If we've had multiple consecutive errors, notify the user
        const errorCount = (window as any).__uploadErrorCount || 0;
        (window as any).__uploadErrorCount = errorCount + 1;
        
        if (errorCount >= 3) {
          // After 3 consecutive failures, notify user and stop polling
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          (window as any).__uploadErrorCount = 0; // Reset counter
          if (onError) {
            onError('Unable to check upload progress. Please try again.');
          }
        }
      }
    };

    // Delay first poll slightly (200ms) to allow upload request to reach server first
    // This prevents 404 errors from the race condition where polling starts before 
    // the backend has created the progress tracking entry
    setTimeout(() => {
      checkProgress();
      
      // Set up polling interval
      intervalRef.current = setInterval(checkProgress, pollInterval);
    }, 200);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [uploadId, onComplete, onError, pollInterval]);

  return {
    progress,
    isPolling,
  };
}