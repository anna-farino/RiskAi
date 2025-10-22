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

    const checkProgress = async () => {
      try {
        const response = await fetchWithAuth(`/api/threat-tracker/tech-stack/upload/${uploadId}/progress`);

        if (!response.ok) {
          if (response.status === 404) {
            // Upload not found - stop polling
            setIsPolling(false);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
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

    // Check immediately
    checkProgress();

    // Set up polling interval
    intervalRef.current = setInterval(checkProgress, pollInterval);

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