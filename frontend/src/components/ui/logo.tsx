import React from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'responsive';
  variant?: 'standard' | 'gradient' | 'monochrome' | 'inverted';
  interactive?: boolean;
  animated?: boolean;
  className?: string;
};

export function Logo({ 
  size = 'responsive', 
  variant = 'gradient', // Changed default to gradient
  interactive = false,
  animated = false,
  className 
}: LogoProps) {
  // Determine font size based on size prop
  const getFontSize = () => {
    switch (size) {
      case 'sm': return '1.75rem';      // 28px - Small size for tight spaces
      case 'md': return '2rem';         // 32px - Medium size (our target size)
      case 'lg': return '2.5rem';       // 40px - Large size for tablets
      case 'xl': return '3rem';         // 48px - Extra large for desktop
      case 'responsive': return 'clamp(2rem, 5vw, 3rem)'; // Responsive size that grows with viewport
      default: return '2rem';           // Default to our 32px target
    }
  };
  
  // Get base style that applies to all variants
  const baseStyle = {
    fontFamily: "'Space Grotesk', 'Poppins', sans-serif",
    fontWeight: 700,
    fontSize: getFontSize(),
    display: "inline-block",
    letterSpacing: "0.02em",
  };
  
  // Get variant-specific styles - enhanced gradient effect
  const getVariantStyle = () => {
    switch (variant) {
      case 'gradient':
        return {
          background: "linear-gradient(to right, #BF00FF, #00FFFF)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: animated ? '0 0 12px rgba(191, 0, 255, 0.4)' : 'none',
          filter: "drop-shadow(0 0 2px rgba(0, 255, 255, 0.2))",
        };
      case 'standard':
        return {}; // Handled in JSX
      case 'monochrome':
        return {
          color: "#FFFFFF",
        };
      case 'inverted':
        return {
          color: "#121212",
        };
      default:
        return {};
    }
  };
  
  // Handle animation effect
  const animationStyle = animated && variant === 'gradient' ? {
    animation: 'gradient-shift 3s infinite alternate',
  } : {};
  
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
  
  const containerClasses = cn(
    'logo-container',
    {
      'logo-interactive': interactive,
      'logo-animated': animated
    },
    className
  );

  return (
    <div 
      className={containerClasses}
      style={{
        display: 'inline-block',
        ...getHoverStyles()
      }}
      onMouseOver={(e) => {
        if (interactive && variant === 'gradient') {
          e.currentTarget.style.filter = 'brightness(1.2)';
        }
      }}
      onMouseOut={(e) => {
        if (interactive && variant === 'gradient') {
          e.currentTarget.style.filter = 'brightness(1)';
        }
      }}
    >
      {variant === 'standard' ? (
        <span style={baseStyle}>
          <span style={{ color: "#FFFFFF" }}>Risq</span>
          <span style={{ 
            color: "#00FFFF",
            textShadow: animated ? '0 0 15px rgba(0, 255, 255, 0.7)' : 'none',
          }}>Ai</span>
          <span style={{ color: "#BF00FF" }}>.co</span>
        </span>
      ) : (
        <span 
          style={{
            ...baseStyle,
            ...getVariantStyle(),
            ...animationStyle
          }}
        >
          RisqAi.co
        </span>
      )}
    </div>
  );
}