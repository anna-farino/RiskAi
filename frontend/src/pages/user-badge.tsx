import { UserWithPerm } from "@/hooks/use-auth"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { Link } from "react-router-dom"
import { LogOut } from "lucide-react"
import { useLogout } from "@/hooks/use-logout"
import { cn } from "@/lib/utils"
import { useState } from "react"


type Props = {
  userData: UserWithPerm | undefined
}
export default function UserBadgeAndDropDown({ userData }: Props) {
  const [ open, setOpen ] = useState(false)
  const { logout } = useLogout()

  function handleLogout() {
    setOpen(false)
    logout()
  }

  return (
    <DropdownMenu open={open} onOpenChange={(b)=>setOpen(b)}>
      <DropdownMenuTrigger className="bg-transparent w-fit p-0 h-fit rounded-full">
        <Avatar>
          <AvatarFallback className="text-foreground">
            {userData?.email[0].toUpperCase() || ""}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="mr-4"
      >
        <DropdownMenuLabel>
          My Account
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userData?.role === 'admin' && 
            <Link to='/dashboard/admin'
              className={cn("flex flex-row cursor-pointer w-full h-full")}
            >
              <DropdownMenuItem className="flex flex-row w-full cursor-pointer">
                Admin
              </DropdownMenuItem>
            </Link>
          }
          <Link to='/dashboard/settings'
            className={cn("flex flex-row cursor-pointer w-full h-full")}
          >
            <DropdownMenuItem className="flex flex-row w-full cursor-pointer">
              Settings
            </DropdownMenuItem>
          </Link>
          <Link to='/dashboard/secrets'
            className={cn("flex flex-row cursor-pointer w-full h-full")}
          >
            <DropdownMenuItem className="flex flex-row w-full cursor-pointer">
              Secrets (test)
            </DropdownMenuItem>
          </Link>
        <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleLogout}
          >
            <div
              className={cn(
                "flex flex-row w-full justify-start items-center",
                "text-foreground bg-transparent",
                "cursor-pointer"
              )}
            >
              <LogOut className="h-4 w-4" />
              {<span className="ml-2">Logout</span>}
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
