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
      "border border-[#BF00FF]/20 rounded-md p-6 flex flex-col " + 
      "shadow-lg shadow-[#BF00FF]/5 min-h-[400px]";
    
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
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-[#00FFFF] flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-1 leading-tight">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        
        {/* Footer/Actions - Always at bottom */}
        {footer && (
          <div className="mt-auto pt-6 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
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
    <div className="flex flex-col gap-3 w-full">
      <div className="grid grid-cols-3 gap-2 w-full">
        {children}
      </div>
      {explanation && (
        <span className="text-xs text-muted-foreground text-center">
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
    const baseClasses = "flex items-center justify-center rounded-md py-2 px-3 text-sm font-medium transition-all duration-200";
    
    const variantClasses = {
      primary: "bg-[#9333EA]/20 text-[#A855F7] border-[#9333EA]/30 border hover:bg-[#9333EA]/30 hover:text-white",
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
    <div className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 items-start ${className}`}>
      {children}
    </div>
  );
}