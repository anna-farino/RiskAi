import { useState, useEffect, useRef } from 'react';

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
        const response = await fetch(`/api/tech-stack/upload/${uploadId}/progress`, {
          credentials: 'include',
        });

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