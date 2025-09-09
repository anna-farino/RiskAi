import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked = false, onCheckedChange, className, disabled = false, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked)
      }
    }

    return (
      <div className={cn("mdc-checkbox", "relative inline-block w-[20px] h-[20px]", className)}>
        <input
          ref={ref}
          type="checkbox"
          className="mdc-checkbox__native-control absolute w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-checked={checked}
          {...props}
        />
        <div 
          className={cn(
            "mdc-checkbox__background",
            "absolute inset-0 flex items-center justify-center",
            "rounded-md border-2 border-gray-600",
            "transition-all duration-90 ease-out",
            checked ? "bg-[#BF00FF] border-[#BF00FF]" : "bg-transparent",
            disabled && "border-gray-400",
            disabled && checked && "bg-gray-400 border-gray-400"
          )}
        >
          <svg 
            className={cn(
              "mdc-checkbox__checkmark",
              "absolute inset-0 w-full h-full",
              "transition-opacity duration-180 ease-out",
              checked ? "opacity-100" : "opacity-0"
            )}
            viewBox="0 0 24 24"
          >
            <path
              className="mdc-checkbox__checkmark-path fill-none stroke-white"
              strokeWidth="3.12"
              d="M1.73,12.91 8.1,19.28 22.79,4.59"
            />
          </svg>
          <div 
            className={cn(
              "mdc-checkbox__mixedmark",
              "absolute w-2 h-0.5 bg-white",
              "opacity-0"
            )}
          />
        </div>
        {/* Touch ripple */}
        <div 
          className={cn(
            "mdc-checkbox__ripple",
            "absolute -inset-2 rounded-full",
            "before:absolute before:inset-0 before:rounded-full before:bg-[#BF00FF] before:opacity-0",
            "hover:before:opacity-[0.04]",
            "focus-within:before:opacity-[0.12]",
            "active:before:opacity-[0.12]",
            "before:transition-opacity before:duration-150"
          )}
        />
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
