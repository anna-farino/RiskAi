import createFreeSubHandler from "backend/handlers/stripe/create-free-sub";
import { Router } from "express";


export const subsRouter = Router()

subsRouter.post('/free-sub', createFreeSubHandler)
