import { useEffect, useRef } from 'react';
import { useFetch } from './use-fetch';
import { useAuth0 } from '@auth0/auth0-react';

/**
 * Hook that triggers relevance score calculation when user enters the frontend
 * This should be called from the main threat tracker component
 */
export function useRelevanceTrigger() {
  const { fetchWithAuth } = useFetch();
  const { isAuthenticated, user } = useAuth0();
  const hasTriggered = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Only trigger if authenticated and we have a user
    if (!isAuthenticated || !user?.sub) {
      return;
    }

    // Check if we already triggered for this user in this session
    if (hasTriggered.current && lastUserId.current === user.sub) {
      return;
    }

    // Mark as triggered for this user
    hasTriggered.current = true;
    lastUserId.current = user.sub;

    // Trigger relevance calculation in the background
    const triggerRelevanceCalculation = async () => {
      try {
        await fetchWithAuth('/api/threat-tracker/tech-stack/trigger-relevance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('Relevance score calculation triggered for user');
      } catch (error) {
        console.error('Failed to trigger relevance calculation:', error);
        // Don't show error to user - this is a background process
      }
    };

    triggerRelevanceCalculation();
  }, [isAuthenticated, user, fetchWithAuth]);

  // Reset trigger when user changes
  useEffect(() => {
    if (user?.sub && user.sub !== lastUserId.current) {
      hasTriggered.current = false;
    }
  }, [user]);
}