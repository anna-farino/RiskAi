import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild >
        <div className="relative w-10 h-10 focus:border-2 focus:border-foreground rounded-md cursor-pointer">
          <Sun className={cn(
            "absolute block h-[1.2rem] w-[1.2rem] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all",
            theme !== "light" && "hidden"
          )} />
          <Moon className={cn(
            "absolute block h-[1.2rem] w-[1.2rem] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all",
            theme !== "dark" && "hidden"
          )} />
          <Monitor className={cn(
            "absolute block h-[1.2rem] w-[1.2rem] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 transition-all",
            theme !== "system" && "hidden"
          )} />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className="cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className="cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}