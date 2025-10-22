import { Router } from "express"
import { verifyPermissions } from "../../../middleware/verify-permissions"
import { handleEditUsersRoles, handleGetUsersRoles } from "../../../handlers/users-roles"
import { handleSetMfa } from "backend/handlers/auth0/set-mfa"
import getUsersInfoHandler from "backend/handlers/auth0/manage-users/get-users"
import deleteUsersHandler from "backend/handlers/auth0/manage-users/delete-users"


export const usersRouter = Router()

usersRouter.get('/roles', 
  verifyPermissions('roles:view'), 
  handleGetUsersRoles
)

usersRouter.post('/:userId/roles/:roleName', 
  verifyPermissions('roles:edit'), 
  handleEditUsersRoles
)

usersRouter.post('/:userId/2fa',
  handleSetMfa
)

usersRouter.get('/info/:organizationId', 
  getUsersInfoHandler
)

usersRouter.delete('/', deleteUsersHandler)

