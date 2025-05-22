// Adapted from shadcn/ui toast component
import { useState, useEffect } from 'react';

// Define types for toast
export type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

// Simple toast hook implementation
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  
  const toast = (props: ToastProps) => {
    const id = Math.random().toString(36);
    
    // Add toast to state
    setToasts(prevToasts => [...prevToasts, props]);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(t => t !== props));
    }, 5000);
  };
  
  // Return the hook interface
  return {
    toast,
    toasts
  };
};