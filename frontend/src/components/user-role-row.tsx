import { UserWithPerm } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UseQueryResult } from "@tanstack/react-query"
import { TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, User, Shield } from "lucide-react"

type Item = { userEmail: string, userId: string, userRole: string}
type Props = {
  item: Item 
  showDropdown: string
  user: UseQueryResult<UserWithPerm | null, Error>
  setShowDropdown: React.Dispatch<React.SetStateAction<string>> 
  changeRole: (item: Item) => void
  rolesData: any
}
export default function UserRoleRow({
  item,
  showDropdown,
  user,
  setShowDropdown,
  changeRole,
  rolesData
}: Props) {


  const isCurrentUser = item.userId === user.data?.id;

  const getRoleIcon = (roleName: string) => {
    switch(roleName?.toLowerCase()) {
      case 'admin':
        return <Shield className="h-3.5 w-3.5 drop-shadow-sm" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleBadgeStyle = (roleName: string) => {
    switch(roleName?.toLowerCase()) {
      case 'admin':
        return "bg-[#FF69FF]/50 text-white border-[#FF69FF] shadow-lg shadow-[#FF69FF]/30";
      case 'manager':
        return "bg-[#00FFFF]/40 text-white border-[#00FFFF]/80";
      case 'user':
        return "bg-blue-500/40 text-white border-blue-500/70";
      default: // no role
        return "bg-slate-600/40 text-white border-slate-500/70";
    }
  };

  return (
    <TableRow key={item.userId} className="border-slate-600/50 hover:bg-slate-700/30 transition-colors">
      <TableCell className="py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-600/50 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-slate-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-medium">{item.userEmail}</span>
            {isCurrentUser && (
              <span className="text-xs text-[#00FFFF]">You</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <div className="relative">
          {isCurrentUser ? (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium border cursor-not-allowed opacity-60",
                getRoleBadgeStyle(item.userRole)
              )}
            >
              <div className="flex items-center gap-1.5">
                {getRoleIcon(item.userRole)}
                <span>{item.userRole || 'No Role'}</span>
              </div>
            </Badge>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-all duration-200 cursor-pointer",
                    getRoleBadgeStyle(item.userRole),
                    item.userRole?.toLowerCase() === 'admin'
                      ? "hover:shadow-[#FF69FF]/40 hover:shadow-md hover:bg-[#FF69FF]/60"
                      : "hover:opacity-80"
                  )}
                >
                  {getRoleIcon(item.userRole)}
                  <span>{item.userRole || 'No Role'}</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-[140px] bg-slate-700 text-white border-slate-600/50">
                {rolesData && rolesData.map((role: any) => (
                  <DropdownMenuItem
                    key={role.name}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm",
                      "cursor-pointer hover:bg-slate-600/50 focus:bg-slate-600/50 transition-colors",
                      item.userRole === role.name && "bg-slate-600/30"
                    )}
                    onClick={() => {
                      changeRole({
                        ...item,
                        userRole: role.name
                      });
                    }}
                  >
                    {getRoleIcon(role.name)}
                    <span>{role.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
