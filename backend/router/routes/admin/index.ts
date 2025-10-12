import { handleCreateUser } from "backend/handlers/auth0/manage-users/create-user";
import { Router } from "express";


export const adminRouter = Router()

adminRouter.post('/user', handleCreateUser)
