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
import { useQuery } from "@tanstack/react-query"
import { serverUrl } from "@/utils/server-url"


type Props = {
  userData: UserWithPerm | undefined
}
export default function UserBadgeAndDropDown({ userData }: Props) {
  const { logout } = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="bg-transparent w-fit p-0 h-fit rounded-full">
        <Avatar>
          <AvatarFallback>{userData?.email[0].toUpperCase() || ""}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="mr-4"
      >
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Link to='/dashboard/settings'>
              Settings
            </Link>
          </DropdownMenuItem>
        <DropdownMenuSeparator />
          <DropdownMenuItem>
            <div
              className={cn(
                "flex flex-row w-full justify-start items-center",
                "text-foreground bg-transparent",
                "cursor-pointer"
              )}
              onClick={logout}
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
