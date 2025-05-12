import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'purple' | 'magenta' | 'cyan' | 'green' | 'orange' | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

interface RisqBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  withDot?: boolean;
  dotColor?: string;
}

export function RisqBadge({
  children,
  variant = 'default',
  size = 'md',
  className,
  onClick,
  interactive = false,
  withDot = false,
  dotColor,
}: RisqBadgeProps) {
  // Base styles for all badges
  const baseStyles = 'inline-flex items-center justify-center rounded-full font-medium';
  
  // Size variations
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-md',
  };
  
  // Style variations based on variant
  const variantStyles = {
    default: 'bg-muted text-muted-foreground',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    magenta: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
    cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    outline: 'border border-purple-600 text-purple-800 dark:text-purple-300 bg-transparent',
  };
  
  // Interactive badges get pointer cursor and hover effects
  const interactiveStyles = interactive 
    ? 'cursor-pointer transition-all duration-200 hover:scale-105' 
    : '';
  
  // Combine all styles
  const combinedStyles = cn(
    baseStyles,
    sizeStyles[size],
    variantStyles[variant],
    interactiveStyles,
    className
  );
  
  return (
    <span 
      className={combinedStyles}
      onClick={onClick}
    >
      {withDot && (
        <span 
          className="mr-1 inline-block h-2 w-2 rounded-full" 
          style={{ backgroundColor: dotColor || (variant === 'default' ? '#64748b' : '') }}
        />
      )}
      {children}
    </span>
  );
}

// Gradient badge with RisqAi styling
export function RisqGradientBadge({
  children,
  className,
  gradient = 'purple-magenta',
  size = 'md',
  interactive = false,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: 'purple-magenta' | 'cyan-green' | 'orange-yellow';
  size?: BadgeSize;
  interactive?: boolean;
}) {
  // Base styles
  const baseStyles = 'inline-flex items-center justify-center rounded-full font-medium text-white';
  
  // Size variations
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-md',
  };
  
  // Gradient variations
  const gradientStyles = {
    'purple-magenta': 'bg-gradient-to-r from-purple-600 to-fuchsia-600',
    'cyan-green': 'bg-gradient-to-r from-cyan-500 to-emerald-500',
    'orange-yellow': 'bg-gradient-to-r from-orange-500 to-amber-500',
  };
  
  // Interactive badges get pointer cursor and hover effects
  const interactiveStyles = interactive 
    ? 'cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-600/20' 
    : '';
  
  return (
    <span 
      className={cn(
        baseStyles,
        sizeStyles[size],
        gradientStyles[gradient],
        interactiveStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}