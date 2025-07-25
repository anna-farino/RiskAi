import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked = false, onCheckedChange, className, disabled = false, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          // Base styles - Material Design 18x18 checkbox
          "material-checkbox",
          "relative inline-flex items-center justify-center",
          "w-[18px] h-[18px] min-w-[18px] min-h-[18px]",
          "rounded-sm border-2 border-gray-600",
          "bg-transparent",
          "transition-all duration-150 ease-in-out",
          
          // Interactive states
          "hover:border-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-[#BF00FF] focus:ring-opacity-20 focus:ring-offset-2",
          "active:scale-95",
          
          // Checked state
          "data-[state=checked]:bg-[#BF00FF] data-[state=checked]:border-[#BF00FF]",
          
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-38 disabled:border-gray-400",
          "disabled:data-[state=checked]:bg-gray-400 disabled:data-[state=checked]:border-gray-400",
          
          className
        )}
        data-state={checked ? "checked" : "unchecked"}
        {...props}
      >
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "opacity-0 scale-0 transition-all duration-150",
            checked && "opacity-100 scale-100"
          )}
        >
          <svg
            width="12"
            height="9"
            viewBox="0 0 12 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            <path
              d="M1 4.5L4.5 8L11 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        
        {/* Ripple effect container */}
        <span 
          className="absolute inset-0 -m-3 w-12 h-12 rounded-full pointer-events-none"
          aria-hidden="true"
        >
          <span 
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-[#BF00FF] opacity-0",
              "transition-opacity duration-200",
              "group-hover:opacity-8 group-focus:opacity-12"
            )}
          />
        </span>
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
