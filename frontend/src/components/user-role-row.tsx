import { UserWithPerm } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu"
import { UseQueryResult } from "@tanstack/react-query"

type Item = { userEmail: string, userId: string, userRole: string}
type Props = {
  item: Item 
  showDropdown: string
  user: UseQueryResult<UserWithPerm, Error>
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


  return (
    <tr key={item.userId} className="border-t">
      <td className=" py-2">{item.userEmail}</td>
      <td className=" py-2">
        <div className="relative">
          <div className="relative">
              <DropdownMenu
                open={showDropdown === item.userId}
                onOpenChange={()=>{
                  const currentState = showDropdown
                  setShowDropdown(showDropdown === item.userId ? '0' : item.userId);
                  return currentState !== "0" 
                }}
              >
                <DropdownMenuTrigger asChild className="z-10">
                  <button 
                    className={cn(
                      "font-light z-10",
                      {
                        "bg-transparent text-muted-foreground cursor-auto hover:border-transparent": item.userId === user.data?.id
                      }
                    )} 
                    onClick={() => {
                      if (item.userId === user.data?.id) return
                      setShowDropdown(
                        showDropdown === item.userId ? "0" : item.userId
                      )}
                    }
                  >
                    {item.userRole}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50">
                  <div
                    className={cn(
                      "flex flex-col",
                      "z-50 p-4 mt-2 rounded-md gap-2",
                      "bg-muted text-foreground border-muted-foreground border shadow-md"
                    )}
                  >
                    {rolesData && rolesData.map((role: any) => (
                      <div 
                        key={role.name}
                        className={cn(
                          "flex flex-row w-fit",
                          "px-1 text-center py-2",
                          "rounded-sm w-[120px]", 
                          "cursor-pointer hover:bg-background/50"
                        )}
                        onClick={() => {
                          changeRole({
                            ...item,
                            userRole: role.name
                          });
                          setShowDropdown("0");
                        }}
                      >
                        {role.name}
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>
      </td>
    </tr>
  )
}
