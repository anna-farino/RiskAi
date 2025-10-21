import { UserWithPerm } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UseQueryResult } from "@tanstack/react-query"
import { TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, User, Shield, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

type Item = { userEmail: string, userId: string, userRole: string, lastLogin?: string | null}
type Props = {
  item: Item
  showDropdown: string
  user: UseQueryResult<UserWithPerm | null, Error>
  setShowDropdown: React.Dispatch<React.SetStateAction<string>>
  changeRole: (item: Item) => void
  rolesData: any
  onEdit?: (item: Item) => void
  onDelete?: (item: Item) => void
  isSelected?: boolean
  onSelectChange?: (userId: string, checked: boolean) => void
}
export default function UserRoleRow({
  item,
  showDropdown,
  user,
  setShowDropdown,
  changeRole,
  rolesData,
  onEdit,
  onDelete,
  isSelected = false,
  onSelectChange
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

  const formatLastLogin = (lastLogin: string | null | undefined) => {
    if (!lastLogin) return <span className="text-slate-500 text-sm">Never</span>

    const date = new Date(lastLogin)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Show relative time for recent logins
    if (diffMins < 1) return <span className="text-green-400 text-sm">Just now</span>
    if (diffMins < 60) return <span className="text-green-400 text-sm">{diffMins} min{diffMins > 1 ? 's' : ''} ago</span>
    if (diffHours < 24) return <span className="text-cyan-400 text-sm">{diffHours} hour{diffHours > 1 ? 's' : ''} ago</span>
    if (diffDays < 7) return <span className="text-slate-300 text-sm">{diffDays} day{diffDays > 1 ? 's' : ''} ago</span>

    // Show formatted date for older logins
    return <span className="text-slate-400 text-sm">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
  };

  return (
    <TableRow key={item.userId} className="border-slate-600/50 hover:bg-slate-700/30 transition-colors">
      <TableCell className="py-4 w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange?.(item.userId, checked as boolean)}
          className="border-slate-500 data-[state=checked]:bg-[#00FFFF] data-[state=checked]:border-[#00FFFF]"
        />
      </TableCell>
      <TableCell className="py-4">
        <div className="flex flex-col">
          <span className="text-white font-medium">{item.userEmail}</span>
          {isCurrentUser && (
            <span className="text-xs text-[#00FFFF]">You</span>
          )}
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
      <TableCell className="py-4">
        {formatLastLogin(item.lastLogin)}
      </TableCell>
      <TableCell className="py-4">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onEdit?.(item)}
            className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border bg-slate-700/50 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600 hover:border-slate-500 transition-colors"
          >
            <Pencil className="h-4 w-4 shrink-0" />
          </button>
          <button
            onClick={() => onDelete?.(item)}
            className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border bg-slate-700/50 border-slate-600 text-slate-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}
