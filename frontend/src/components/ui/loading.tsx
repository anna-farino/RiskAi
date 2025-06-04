import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './logo';

interface RisqLoaderProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

export function RisqLoader({ 
  message = "Loading...", 
  progress = 0,
  showProgress = false 
}: RisqLoaderProps) {
  const messages = [
    "Authenticating your session...",
    "Loading security dashboard...",
    "Establishing secure connection...",
    "Preparing threat intelligence..."
  ];

  const [currentMessage, setCurrentMessage] = React.useState(message);

  React.useEffect(() => {
    if (message === "Loading...") {
      let messageIndex = 0;
      const interval = setInterval(() => {
        setCurrentMessage(messages[messageIndex]);
        messageIndex = (messageIndex + 1) % messages.length;
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setCurrentMessage(message);
    }
  }, [message]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-[#BF00FF]/10 via-black to-black" />
      
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#00FFFF]/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0
            }}
            animate={{
              y: [null, -20, -40],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Main loading content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Animated logo container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Rotating gradient border */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full bg-gradient-conic from-[#BF00FF] via-[#00FFFF] to-[#BF00FF] p-1 -m-4"
          >
            <div className="w-full h-full rounded-full bg-black" />
          </motion.div>
          
          {/* Logo with pulsing effect */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative z-10"
          >
            <Logo size="xl" variant="gradient" animated />
          </motion.div>
        </motion.div>

        {/* Loading message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center space-y-4"
        >
          <motion.h2
            key={currentMessage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="text-xl font-medium text-white"
          >
            {currentMessage}
          </motion.h2>
          
          {/* Progress bar */}
          {showProgress && (
            <div className="w-64 h-2 bg-black/50 rounded-full overflow-hidden border border-[#BF00FF]/20">
              <motion.div
                className="h-full bg-gradient-to-r from-[#BF00FF] to-[#00FFFF]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
          
          {/* Animated loading dots */}
          <div className="flex space-x-1 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-[#00FFFF] rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Radar scanning effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 border border-[#00FFFF]/20 rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 w-80 h-80 -translate-x-1/2 -translate-y-1/2 border border-[#BF00FF]/20 rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          />
        </motion.div>
      </div>
    </div>
  );
}

interface RisqSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RisqSpinner({ size = 'md', className = '' }: RisqSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`${sizeClasses[size]} ${className}`}
    >
      <div className="w-full h-full rounded-full border-2 border-transparent border-t-[#BF00FF] border-r-[#00FFFF]" />
    </motion.div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className = '', lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {[...Array(lines)].map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-gradient-to-r from-[#BF00FF]/10 to-[#00FFFF]/10 rounded animate-pulse"
          style={{ width: `${Math.random() * 40 + 60}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2
          }}
        />
      ))}
    </div>
  );
}