import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { serverUrl } from "@/utils/server-url"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"


export default function Admin() {
  const [ isUserAdmin, setIsUserAdmin ] = useState(false) 
  const [ showDropdown, setShowDropdown ] = useState(0)
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(()=>{
    if (user) {
      const isAdmin = user.permissions.includes("roles:edit")
      if (!isAdmin) {
          navigate('/dashboard/home')
      } else {
          setIsUserAdmin(true)
      }

    }
  },[user])


  const { data, isPending: userRolesPending } = useQuery({
    queryKey: ['users-roles'],
    enabled: !!isUserAdmin,
    retry: false,
    queryFn: async () => {
      if (!isUserAdmin) {
        console.error("User doesn't have the permission to fetch users-roles")
        return
      };
      try {
        const response = await fetch(`${serverUrl}/api/users/roles`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch permissions');
        return response.json();
      } catch(error) {
        console.error(error)
      }
    }
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    enabled: !!data,
    queryFn: async () => {
      if (!isUserAdmin) {
        console.error("User doesn't have the permission to fetch roles")
        return
      };
      try {
        const response = await fetch(`${serverUrl}/api/roles`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        if (!response.ok) throw new Error('Failed to fetch roles')
        return response.json()
      } catch(error) {
        console.error(error)
      }
    },
  })

  const editUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: number, newRole: string }) => {
      if (userId === user?.id) {
        console.error("Admins cannot change their own role")
        return data;
      }
      const response = await fetch(`${serverUrl}/api/users/${userId}/roles/${newRole}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })
      if (!response.ok) throw new Error("Update role failed")
      return await response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users-roles'], data)
    }
  })

  function changeRole(userId: number, newRole: string) {
    editUserRole.mutate({
      userId,
      newRole
    })
  }

  if (!isUserAdmin) return
  if (userRolesPending) return <h1> Fetching the data...</h1>

  return (
    <div className="flex flex-col gap-y-4">
      <h1 className="font-semibold text-2xl mb-4">
        Admin dashboard
      </h1>
      <table className="table-auto w-full">
        <thead>
          <tr className="ml-10">
            <th className="text-left">User Name</th>
            <th className="text-left">User Email</th>
            <th className="text-left">User Role</th>
          </tr>
        </thead>
        <tbody>
        {Array.isArray(data) && data
          .sort((a,b) => a.id - b.id)
          .map((item: any) => (
          <tr key={item.userId} className="border-t">
            <td className=" py-2">{item.userName}</td>
            <td className=" py-2">{item.userEmail}</td>
            <td className=" py-2">
              <div className="relative">
                <div className="relative">
                  <button 
                    className="underline" 
                    onClick={() => setShowDropdown(
                        showDropdown === item.userId ? 0 : item.userId
                      )}
                  >
                    {item.userRole}
                  </button>
                  {showDropdown === item.userId && (
                    <div
                      className={cn(
                        "flex flex-col absolute",
                        "z-40 p-4 mt-2 rounded-lg gap-2",
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
                            changeRole(item.userId, role.name);
                            setShowDropdown(0);
                          }}
                        >
                          {role.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  )
}
