import UserRoleRow from "@/components/user-role-row"
import { useAuth } from "@/hooks/use-auth"
import { useFetch } from "@/hooks/use-fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"


export default function Admin() {
  const [ isUserAdmin, setIsUserAdmin ] = useState(false) 
  const [ showDropdown, setShowDropdown ] = useState("0")
  const user = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fetchWithAuth = useFetch()


  useEffect(()=>{
    if (user.data) {
      const isAdmin = user.data?.role == 'admin'
      if (isAdmin) {
        setIsUserAdmin(true)
      } else if (user.data === null) {
        navigate('/dashboard/home')
      }
    }
  },[user.data])


  const userRolesQuery = useQuery({
    queryKey: ['users-roles'],
    retry: true,
    enabled: !!isUserAdmin,
    queryFn: async () => {
      if (!isUserAdmin) {
        //console.error("User doesn't have the permission to fetch users-roles")
        return []
      };
      try {
        const response = await fetchWithAuth('/api/users/roles');
        if (!response.ok) throw new Error('Failed to fetch permissions');
        return response.json();
      } catch(error) {
        console.error(error)
      }
    }
  })


  const rolesData = useQuery({
    queryKey: ['roles'],
    enabled: isUserAdmin,
    retry: true,
    queryFn: async () => {
      if (!isUserAdmin) {
        //console.error("User doesn't have the permission to fetch roles")
        return []
      };
      try {
        const response = await fetchWithAuth('/api/roles')
        if (!response.ok) throw new Error('Failed to fetch roles')
        return response.json()
      } catch(error) {
        return []
        //console.error(error)
      }
    },
  })

  const editUserRole = useMutation({
    mutationFn: async (item: { userId: string, userRole: string, userEmail: string }) => {
      if (item.userId === user.data?.id) {
        console.error("Admins cannot change their own role")
        return userRolesQuery.data;
      }
      return fetchWithAuth(`/api/users/${item.userId}/roles/${item.userRole}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        }
      })
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['users-roles'] })

      const previousUserRoles = queryClient.getQueryData(['users-roles'])

      queryClient.setQueryData(
        ['users-roles'], 
        (old: (typeof variables)[]) => old
          .map(item => {
            if (item.userId !== variables.userId) return item
            else return {
              ...item,
              userRole: variables.userRole
            }
          })
      )

      return { previousUserRoles }
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(['users-roles'], context?.previousUserRoles)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users-roles']})
  })

  function changeRole(item: {userId: string, userRole: string, userEmail: string}) {
    editUserRole.mutate(item)
  }

  console.log("User data", user.data)
  console.log("User is pending", user.isPending)
  if (!isUserAdmin) <></>
  if (!user.isPending && !user.data?.role) navigate('/dashboard/home')
  if (userRolesQuery.isPending) return <h1> Fetching the data...</h1>

  return (
    <div className="flex flex-col gap-y-4">
      <h1 className="font-semibold text-2xl mb-4">
        Admin dashboard
      </h1>
      <table className="table-auto w-full">
        <thead>
          <tr className="ml-10">
            <th className="text-left">User Email</th>
            <th className="text-left">User Role</th>
          </tr>
        </thead>
        <tbody>
        {Array.isArray(userRolesQuery.data) && userRolesQuery.data
          .map((item: any) => (
            <UserRoleRow 
              key={item.userEmail}
              item={item}
              showDropdown={showDropdown}
              setShowDropdown={setShowDropdown}
              user={user}
              rolesData={rolesData.data}
              changeRole={changeRole}
            />
          ))
        }
        </tbody>
      </table>
    </div>
  )
}
