import React from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'responsive';
  interactive?: boolean;
  className?: string;
};

export function Logo({ 
  size = 'responsive', 
  interactive = false,
  className 
}: LogoProps) {
  // Determine font size based on size prop
  const getFontSize = () => {
    switch (size) {
      case 'sm': return '1.25rem';
      case 'md': return '1.5rem';
      case 'lg': return '2rem';
      case 'responsive': return '2rem'; // Default for responsive
      default: return '2rem';
    }
  };

  // Apply hover effects if interactive
  const getHoverStyles = () => {
    if (interactive) {
      return {
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      };
    }
    return {};
  };

  return (
    <div 
      className={cn(className)}
      style={{
        display: 'inline-block',
        ...getHoverStyles()
      }}
      onMouseOver={(e) => {
        if (interactive) {
          e.currentTarget.style.opacity = '0.8';
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.textShadow = '0 0 15px rgba(255, 0, 214, 0.5)';
        }
      }}
      onMouseOut={(e) => {
        if (interactive) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.textShadow = 'none';
        }
      }}
    >
      <span style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        fontSize: getFontSize(),
        background: "linear-gradient(to right, #8A00C2, #FF00D6)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        display: "inline-block"
      }}>
        RisqAi
      </span>
    </div>
  );
}