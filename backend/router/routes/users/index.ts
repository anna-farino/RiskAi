import { Router } from "express"
import { verifyPermissions } from "../../../middleware/verify-permissions"
import { handleEditUsersRoles, handleGetUsersRoles } from "../../../handlers/users-roles"


export const usersRouter = Router()

usersRouter.get('/roles', 
  verifyPermissions('roles:view'), 
  handleGetUsersRoles
)
usersRouter.post('/:userId/roles/:roleName', 
  verifyPermissions('roles:edit'), 
  handleEditUsersRoles
)

