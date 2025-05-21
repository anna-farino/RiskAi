import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type WidgetVariant = 'standard' | 'interactive' | 'metric' | 'expandable';

export interface RisqWidgetProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  variant?: WidgetVariant;
  delay?: number;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function RisqWidget({
  title,
  description,
  icon,
  variant = 'standard',
  delay = 0,
  children,
  footer,
  className = '',
  onClick
}: RisqWidgetProps) {
  // Determine the classes based on the variant
  const getWidgetClasses = () => {
    const baseClasses = "bg-gradient-to-b from-[#300A45]/80 to-black/80 backdrop-blur-sm " +
      "border border-[#BF00FF]/20 rounded-xl p-6 flex flex-col " + 
      "shadow-lg shadow-[#BF00FF]/5 h-full";
    
    const variantClasses = {
      standard: "",
      interactive: "cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-[#BF00FF]/20 hover:border-[#BF00FF]/40",
      metric: "text-center",
      expandable: "transition-all duration-300"
    };
    
    return `${baseClasses} ${variantClasses[variant]} ${className}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className={getWidgetClasses()}
      onClick={variant === 'interactive' ? onClick : undefined}
      whileHover={variant === 'interactive' ? { scale: 1.02 } : undefined}
    >
      {/* Header */}
      <div className="mb-4">
        {icon && (
          <div className="mb-4 text-[#00FFFF]">
            {icon}
          </div>
        )}
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1">
        {children}
      </div>
      
      {/* Footer/Actions */}
      {footer && (
        <div className="mt-auto pt-4">
          {footer}
        </div>
      )}
    </motion.div>
  );
}

// Widget Actions component for consistent button layout
export function WidgetActions({ 
  children,
  explanation
}: { 
  children: ReactNode,
  explanation?: string 
}) {
  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {children}
      </div>
      {explanation && (
        <span className="text-xs text-muted-foreground text-center mt-2">
          {explanation}
        </span>
      )}
    </div>
  );
}

// Widget Button component for consistent action styling
export function WidgetButton({
  children,
  onClick,
  variant = 'primary',
  className = ''
}: {
  children: ReactNode,
  onClick?: () => void,
  variant?: 'primary' | 'secondary' | 'ghost',
  className?: string
}) {
  const getButtonClasses = () => {
    const baseClasses = "flex items-center justify-center rounded-lg py-2 px-3 text-sm font-medium transition-all duration-200";
    
    const variantClasses = {
      primary: "btn-risqai-primary",
      secondary: "btn-risqai-secondary",
      ghost: "btn-risqai-ghost"
    };
    
    return `${baseClasses} ${variantClasses[variant]} ${className}`;
  };
  
  return (
    <button 
      className={getButtonClasses()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Widget Grid Container for responsive layout
export function WidgetGrid({ 
  children,
  className = ''
}: { 
  children: ReactNode,
  className?: string 
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {children}
    </div>
  );
}