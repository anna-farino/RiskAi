import React from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'glass' | 'bordered' | 'elevated' | 'flat';

interface RisqCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  hover?: boolean;
  maxWidth?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function RisqCard({
  children,
  variant = 'default',
  className,
  onClick,
  interactive = false,
  hover = true,
  maxWidth,
  padding = 'md',
}: RisqCardProps) {
  // Base styles for all cards
  const baseStyles = 'rounded-md';
  
  // Padding variations
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
  };
  
  // Style variations based on variant
  const variantStyles = {
    default: 'bg-background border border-border',
    glass: 'bg-background/75 backdrop-blur-md border border-purple-600/20 dark:border-purple-400/20',
    bordered: 'bg-background border-2 border-purple-600 dark:border-purple-400',
    elevated: 'bg-background shadow-lg shadow-purple-600/10 dark:shadow-purple-400/10 border border-border',
    flat: 'bg-background',
  };
  
  // Interactive cards get pointer cursor and optional hover transformation
  const interactiveStyles = interactive 
    ? 'cursor-pointer transition-all duration-300' 
    : '';
  
  // Hover effects (only applied if hover or interactive are true)
  const hoverStyles = (hover || interactive) 
    ? 'hover:shadow-md hover:shadow-purple-600/10 dark:hover:shadow-purple-400/10 hover:border-purple-600/40 dark:hover:border-purple-400/40 group/card' 
    : '';
  
  // Combine all styles
  const combinedStyles = cn(
    baseStyles,
    variantStyles[variant],
    paddingStyles[padding],
    interactiveStyles,
    hoverStyles,
    className
  );
  
  // Add max width if provided
  const styles = maxWidth 
    ? { maxWidth, ...( interactive && hover ? { transform: 'translateY(0)' } : {} ) } 
    : ( interactive && hover ? { transform: 'translateY(0)' } : {} );
  
  return (
    <div 
      className={combinedStyles}
      onClick={onClick}
      style={styles}
      onMouseOver={(e) => {
        if (interactive && hover) {
          e.currentTarget.style.transform = 'translateY(-4px)';
        }
      }}
      onMouseOut={(e) => {
        if (interactive && hover) {
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {children}
    </div>
  );
}

// Header component for consistent card headers
export function RisqCardHeader({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn('mb-4 flex flex-col space-y-1.5', className)} 
      {...props}
    >
      {children}
    </div>
  );
}

// Title component for consistent card titles
export function RisqCardTitle({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 
      className={cn('text-lg font-semibold leading-tight text-foreground group-hover/card:text-purple-600 dark:group-hover/card:text-purple-400 transition-colors', className)} 
      {...props}
    >
      {children}
    </h3>
  );
}

// Description component for consistent card descriptions
export function RisqCardDescription({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn('text-sm text-muted-foreground', className)} 
      {...props}
    >
      {children}
    </p>
  );
}

// Footer component for consistent card footers
export function RisqCardFooter({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn('flex items-center pt-4 mt-auto', className)} 
      {...props}
    >
      {children}
    </div>
  );
}

// Content component for consistent card content
export function RisqCardContent({ 
  children,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn('', className)} 
      {...props}
    >
      {children}
    </div>
  );
}