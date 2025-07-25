import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <div className="mdc-checkbox-wrapper relative inline-flex items-center justify-center w-10 h-10">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // Material Design checkbox container
        "mdc-checkbox relative inline-flex items-center justify-center",
        "w-[18px] h-[18px]",
        "group",
        className
      )}
      {...props}
    >
      {/* Background layer */}
      <span 
        className={cn(
          "mdc-checkbox__background",
          "absolute inset-0",
          "inline-flex items-center justify-center",
          "rounded-sm border-2 border-gray-600",
          "transition-all duration-90 ease-out",
          "bg-transparent",
          
          // Hover state
          "group-hover:border-gray-500",
          
          // Checked state
          "group-data-[state=checked]:bg-[#BF00FF]",
          "group-data-[state=checked]:border-[#BF00FF]",
          
          // Focus state
          "group-focus-visible:outline-none",
          
          // Disabled state
          "group-disabled:border-gray-400",
          "group-disabled:group-data-[state=checked]:bg-gray-400",
          "group-disabled:group-data-[state=checked]:border-gray-400",
          "group-disabled:cursor-not-allowed"
        )}
      >
        <CheckboxPrimitive.Indicator 
          className="mdc-checkbox__checkmark w-full h-full"
          asChild
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full"
          >
            <path
              className={cn(
                "mdc-checkbox__checkmark-path",
                "stroke-white stroke-[3.12]",
                "fill-none",
                "transition-all duration-180 ease-out",
                "origin-center",
                "[stroke-dasharray:29.7833]",
                "[stroke-dashoffset:29.7833]",
                "group-data-[state=checked]:[stroke-dashoffset:0]"
              )}
              d="M1.73,12.91 8.1,19.28 22.79,4.59"
            />
          </svg>
        </CheckboxPrimitive.Indicator>
        
        {/* Mixed state indicator */}
        <span
          className={cn(
            "mdc-checkbox__mixedmark",
            "absolute inset-[5px]",
            "bg-white",
            "opacity-0",
            "transition-opacity duration-90",
            "group-data-[state=indeterminate]:opacity-100"
          )}
        />
      </span>
      
      {/* Ripple effect */}
      <span
        className={cn(
          "mdc-checkbox__ripple",
          "absolute inset-[-11px]",
          "rounded-full",
          "pointer-events-none",
          "transition-all duration-150",
          "bg-[#BF00FF]",
          "opacity-0",
          "scale-0",
          "group-hover:opacity-[0.08]",
          "group-hover:scale-100",
          "group-focus-visible:opacity-[0.12]",
          "group-focus-visible:scale-100",
          "group-active:opacity-[0.16]",
          "group-active:scale-100"
        )}
      />
    </CheckboxPrimitive.Root>
  </div>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
