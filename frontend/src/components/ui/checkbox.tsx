import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
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
          "relative box-border block w-4 h-4 p-0 m-0 border-2 border-gray-400 bg-transparent outline-none transition-all duration-200",
          "hover:border-gray-300 focus:ring-2 focus:ring-[#BF00FF] focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked && "bg-[#BF00FF] border-[#BF00FF]",
          className
        )}
        style={{
          width: '16px',
          height: '16px',
          minWidth: '16px',
          minHeight: '16px',
          borderRadius: '0px'
        }}
        {...props}
      >
        {checked && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 pointer-events-none"
            style={{ width: '16px', height: '16px' }}
          >
            <path
              d="M4 8L7 11L12 5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
