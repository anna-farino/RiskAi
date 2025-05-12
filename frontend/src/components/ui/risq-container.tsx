import React from 'react';
import { cn } from '@/lib/utils';

type ContainerWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
type ContainerVariant = 'default' | 'glass' | 'bordered' | 'shadowed';

interface RisqContainerProps {
  children: React.ReactNode;
  width?: ContainerWidth;
  variant?: ContainerVariant;
  className?: string;
  style?: React.CSSProperties;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function RisqContainer({
  children,
  width = 'lg',
  variant = 'default',
  className,
  style,
  padding = 'md',
}: RisqContainerProps) {
  // Base styles for all containers
  const baseStyles = 'mx-auto';
  
  // Width variations
  const widthStyles = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'w-full',
  };
  
  // Padding variations
  const paddingStyles = {
    none: '',
    sm: 'px-4 py-3',
    md: 'px-6 py-5',
    lg: 'px-8 py-7',
  };
  
  // Style variations based on variant
  const variantStyles = {
    default: '',
    glass: 'bg-background/75 backdrop-blur-md border border-purple-600/20 dark:border-purple-400/20 rounded-xl',
    bordered: 'border-2 border-purple-600 dark:border-purple-400 rounded-xl',
    shadowed: 'shadow-lg shadow-purple-600/10 dark:shadow-purple-400/10 rounded-xl',
  };
  
  return (
    <div 
      className={cn(
        baseStyles,
        widthStyles[width],
        paddingStyles[padding],
        variantStyles[variant],
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// Section container with background options
export function RisqSection({
  children,
  className,
  background = 'default',
  fullWidth = false,
  paddingY = 'md',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  background?: 'default' | 'gradient' | 'pattern' | 'muted';
  fullWidth?: boolean;
  paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  // Padding Y variations
  const paddingYStyles = {
    none: '',
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12',
    xl: 'py-16',
  };
  
  // Background variations
  const backgroundStyles = {
    default: 'bg-background',
    gradient: 'bg-gradient-to-br from-purple-900/10 via-background to-fuchsia-900/10',
    pattern: 'bg-background',
    muted: 'bg-muted',
  };
  
  // Content width
  const contentWidthStyles = fullWidth ? '' : 'container mx-auto px-4';
  
  return (
    <section
      className={cn(
        paddingYStyles[paddingY],
        backgroundStyles[background],
        className
      )}
      {...props}
    >
      <div className={contentWidthStyles}>
        {children}
      </div>
      
      {/* Pattern overlay for pattern background */}
      {background === 'pattern' && (
        <div 
          className="absolute inset-0 z-0 opacity-[0.03]" 
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
      )}
    </section>
  );
}