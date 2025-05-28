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
      case 'sm': return '1.75rem';      // Increased from 1.5rem
      case 'md': return '2.25rem';      // Increased from 2rem
      case 'lg': return '2.75rem';      // Increased from 2.5rem
      case 'xl': return '3.25rem';      // Increased from 3rem
      case 'responsive': return '2.75rem'; // Increased default size
      default: return '2.75rem';
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