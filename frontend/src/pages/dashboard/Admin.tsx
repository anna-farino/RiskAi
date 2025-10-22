import UserRoleRow from "@/components/user-role-row"
import { useAuth } from "@/hooks/use-auth"
import { useFetch } from "@/hooks/use-fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Shield, Users, Loader2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Search, X, Pencil, Trash2, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"


export default function Admin() {
  const [ isUserAdmin, setIsUserAdmin ] = useState(false)
  const [ showDropdown, setShowDropdown ] = useState("0")
  const [ isCreateDialogOpen, setIsCreateDialogOpen ] = useState(false)
  const [ newUserEmail, setNewUserEmail ] = useState("")
  const [ newUserPassword, setNewUserPassword ] = useState("")
  const [ sortColumn, setSortColumn ] = useState<'email' | 'role' | 'lastLogin' | null>(null)
  const [ sortDirection, setSortDirection ] = useState<'asc' | 'desc'>('asc')
  const [ searchEmail, setSearchEmail ] = useState("")
  const [ deleteDialogOpen, setDeleteDialogOpen ] = useState(false)
  const [ userToDelete, setUserToDelete ] = useState<{email: string, id: string} | null>(null)
  const [ selectedUsers, setSelectedUsers ] = useState<Set<string>>(new Set())
  const [ bulkDeleteDialogOpen, setBulkDeleteDialogOpen ] = useState(false)
  const user = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fetchWithAuth = useFetch()


  useEffect(()=>{
    if (user.data) {
      console.log(user)
      const isAdmin = user.data?.role == 'admin'
      if (isAdmin) {
        setIsUserAdmin(true)
      } else {
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

  const usersInfoQuery = useQuery({
    queryKey: ['users-info', user.data?.organizationId],
    enabled: !!isUserAdmin && !!user.data?.organizationId,
    retry: true,
    queryFn: async () => {
      if (!isUserAdmin || !user.data?.organizationId) {
        return []
      }
      try {
        const response = await fetchWithAuth(`/api/users/info/${user.data.organizationId}`)
        if (!response.ok) throw new Error('Failed to fetch users info')
        return response.json()
      } catch(error) {
        console.error(error)
        return []
      }
    }
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

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string, password: string }) => {
      const response = await fetchWithAuth('/api/admin/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          organizationId: user.data?.organizationId
        })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create user')
      }
      return response.json()
    },
    onSuccess: () => {
      setIsCreateDialogOpen(false)
      setNewUserEmail("")
      setNewUserPassword("")
      queryClient.invalidateQueries({ queryKey: ['users-roles'] })
    },
    onError: (error: Error) => {
      console.error('Failed to create user:', error.message)
    }
  })

  function changeRole(item: {userId: string, userRole: string, userEmail: string}) {
    editUserRole.mutate(item)
  }

  function handleCreateUser() {
    if (!newUserEmail || !newUserPassword) {
      return
    }
    createUserMutation.mutate({
      email: newUserEmail,
      password: newUserPassword
    })
  }

  function handleEditUser(item: {userId: string, userEmail: string, userRole: string}) {
    // TODO: Add edit functionality
  }

  function handleDeleteUser(item: {userId: string, userEmail: string, userRole: string}) {
    setUserToDelete({ email: item.userEmail, id: item.userId })
    setDeleteDialogOpen(true)
  }

  function handleSelectUser(userId: string, checked: boolean) {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(userId)
      } else {
        newSet.delete(userId)
      }
      return newSet
    })
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const allUserIds = getSortedData()?.map((item: any) => item.userId) || []
      setSelectedUsers(new Set(allUserIds))
    } else {
      setSelectedUsers(new Set())
    }
  }

  function handleBulkDelete() {
    setBulkDeleteDialogOpen(true)
  }

  function handleBulkChangeRole(roleName: string) {
    // TODO: Add bulk role change functionality
    console.log('Bulk change role to:', roleName)
  }

  function handleSort(column: 'email' | 'role' | 'lastLogin') {
    if (sortColumn === column) {
      // Clicking the same column: toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        // Clear sorting
        setSortColumn(null)
      }
    } else {
      // Clicking a different column: set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortedData() {
    if (!Array.isArray(userRolesQuery.data)) {
      return userRolesQuery.data
    }

    // Merge user roles with last_login info
    const usersInfoData = Array.isArray(usersInfoQuery.data) ? usersInfoQuery.data : []
    const mergedData = userRolesQuery.data.map((item: any) => {
      const userInfo = usersInfoData.find((info: any) => info.email === item.userEmail)
      return {
        ...item,
        lastLogin: userInfo?.last_login || null
      }
    })

    // First, filter by search term
    let filtered = mergedData
    if (searchEmail.trim()) {
      filtered = mergedData.filter((item: any) =>
        item.userEmail?.toLowerCase().includes(searchEmail.toLowerCase())
      )
    }

    // Then, sort if a column is selected
    if (!sortColumn) {
      return filtered
    }

    const sorted = [...filtered].sort((a: any, b: any) => {
      let aValue: any = ''
      let bValue: any = ''

      if (sortColumn === 'email') {
        aValue = a.userEmail?.toLowerCase() || ''
        bValue = b.userEmail?.toLowerCase() || ''
      } else if (sortColumn === 'role') {
        aValue = a.userRole?.toLowerCase() || ''
        bValue = b.userRole?.toLowerCase() || ''
      } else if (sortColumn === 'lastLogin') {
        // Handle date sorting - null values go to the end
        aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0
        bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }

  function getSortIcon(column: 'email' | 'role' | 'lastLogin') {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />
    }
    return <ArrowDown className="h-4 w-4 ml-1" />
  }

  console.log("User data", user.data)
  console.log("User is pending", user.isPending)
  if (!isUserAdmin) return <></>
  if (!user.isPending && !user.data?.role) navigate('/dashboard/home')

  return (
    <div className="flex flex-col w-full h-full gap-y-2">
      {/* Header Section */}
      <div className="bg-slate-800/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-600/60 rounded-md p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#BF00FF]/30 to-[#00FFFF]/30 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-[#BF00FF]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[#00FFFF] mb-1">
                Organization Panel
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-wider text-white">
                {`${(user.data as any)?.organizationName ? (user.data as any).organizationName : "Admin"} Dashboard`}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table Section */}
      <div className="bg-slate-800/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-600/60 rounded-md p-6">
        {userRolesQuery.isPending ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-5 w-5 text-[#00FFFF]" />
              <span className="text-base font-medium text-white">Organization Users</span>
            </div>
            {/* Loading skeleton */}
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 bg-slate-800/50 rounded-md animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        ) : userRolesQuery.error ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Failed to load users</h3>
            <p className="text-slate-400">Please check your permissions and try again.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[#00FFFF]" />
                <span className="text-base font-medium text-white">Organization Users</span>
                <div className="text-sm text-slate-300">
                  {searchEmail.trim() ? (
                    <>({getSortedData()?.length || 0} of {Array.isArray(userRolesQuery.data) ? userRolesQuery.data.length : 0} users)</>
                  ) : (
                    <>({Array.isArray(userRolesQuery.data) ? userRolesQuery.data.length : 0} users)</>
                  )}
                </div>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 border-[#00FFFF]/30 text-white hover:from-[#BF00FF]/30 hover:to-[#00FFFF]/30 hover:border-[#00FFFF]/50"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-600/60 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white">Create New User</DialogTitle>
                    <DialogDescription className="text-slate-300">
                      Add a new user to your organization. They will receive an email with login instructions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-200">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-200">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateUser}
                      disabled={!newUserEmail || !newUserPassword || createUserMutation.isPending}
                      className="bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] text-white hover:from-[#BF00FF]/90 hover:to-[#00FFFF]/90"
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search Input and Bulk Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-1/2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-[#00FFFF]/50 focus:ring-[#00FFFF]/20"
                />
                {searchEmail && (
                  <button
                    onClick={() => setSearchEmail("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors bg-transparent hover:bg-slate-600 rounded-full p-1 m-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedUsers.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">
                    {selectedUsers.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="bg-slate-700/50 border-slate-600 text-slate-300 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-slate-700/50 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600 hover:border-slate-500"
                      >
                        <UserCog className="h-4 w-4 mr-2" />
                        Change Role
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-700 text-white border-slate-600/50">
                      {rolesData.data && rolesData.data.map((role: any) => (
                        <DropdownMenuItem
                          key={role.name}
                          className="cursor-pointer hover:bg-slate-600/50 focus:bg-slate-600/50"
                          onClick={() => handleBulkChangeRole(role.name)}
                        >
                          {role.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-slate-600/50 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.size > 0 && selectedUsers.size === getSortedData()?.length}
                      onCheckedChange={handleSelectAll}
                      className="border-slate-500 data-[state=checked]:bg-[#00FFFF] data-[state=checked]:border-[#00FFFF]"
                    />
                  </TableHead>
                  <TableHead
                    className="text-slate-200 font-medium cursor-pointer hover:text-[#00FFFF] transition-colors select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      User Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-slate-200 font-medium cursor-pointer hover:text-[#00FFFF] transition-colors select-none"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center">
                      Role
                      {getSortIcon('role')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-slate-200 font-medium cursor-pointer hover:text-[#00FFFF] transition-colors select-none"
                    onClick={() => handleSort('lastLogin')}
                  >
                    <div className="flex items-center">
                      Last Login
                      {getSortIcon('lastLogin')}
                    </div>
                  </TableHead>
                  <TableHead className="text-slate-200 font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(getSortedData()) && getSortedData().length > 0 ? (
                  getSortedData().map((item: any, j: number) => (
                    <UserRoleRow
                      key={item.userEmail + j}
                      item={item}
                      showDropdown={showDropdown}
                      setShowDropdown={setShowDropdown}
                      user={user}
                      rolesData={rolesData.data}
                      changeRole={changeRole}
                      onEdit={handleEditUser}
                      onDelete={handleDeleteUser}
                      isSelected={selectedUsers.has(item.userId)}
                      onSelectChange={handleSelectUser}
                    />
                  ))
                ) : (
                  <TableRow>
                    <td colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                          <Users className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-slate-400">No users found in your organization</p>
                      </div>
                    </td>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-600/60 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Delete User</DialogTitle>
            <DialogDescription className="text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-white">{userToDelete?.email}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-600/60 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Delete Multiple Users</DialogTitle>
            <DialogDescription className="text-slate-300">
              Are you sure you want to delete {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''}?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1 py-2">
            {Array.from(selectedUsers).map((userId) => {
              const userData = userRolesQuery.data?.find((u: any) => u.userId === userId)
              return userData ? (
                <div key={userId} className="text-sm text-slate-300 px-2">
                  • {userData.userEmail}
                </div>
              ) : null
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBulkDeleteDialogOpen(false)
                setSelectedUsers(new Set())
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
