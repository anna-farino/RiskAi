import { useState, useEffect } from 'react';

interface UseLoadingStateOptions {
  minimumLoadingTime?: number;
  onLoadingComplete?: () => void;
}

export function useLoadingState(
  isLoading: boolean,
  options: UseLoadingStateOptions = {}
) {
  const { minimumLoadingTime = 800, onLoadingComplete } = options;
  const [showLoading, setShowLoading] = useState(isLoading);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading && !startTime) {
      setStartTime(Date.now());
      setShowLoading(true);
    } else if (!isLoading && startTime) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minimumLoadingTime - elapsed);

      setTimeout(() => {
        setShowLoading(false);
        setStartTime(null);
        onLoadingComplete?.();
      }, remaining);
    }
  }, [isLoading, startTime, minimumLoadingTime, onLoadingComplete]);

  return showLoading;
}

export function useProgressiveMessage(messages: string[], interval: number = 2000) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(messages[0] || '');

  useEffect(() => {
    if (messages.length <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % messages.length;
        setCurrentMessage(messages[next]);
        return next;
      });
    }, interval);

    return () => clearInterval(intervalId);
  }, [messages, interval]);

  return currentMessage;
}