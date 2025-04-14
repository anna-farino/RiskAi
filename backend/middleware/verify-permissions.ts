import { Request, Response, NextFunction } from 'express';
import { FullRequest } from './index';

type Permission =  
    'actions:view' |
    'permissions:edit' |
    'roles:edit' |
    'roles:view'

export function verifyPermissions(permission: Permission) {

    return async (req: Request, res: Response, next: NextFunction) => {
        console.log('🔐 [VERIFY] Verifying permissions for:', permission);

        const user = (req as unknown as FullRequest).user;
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        console.log('🔐 [VERIFY] User:', user, permission);
        if (!user.permissions || !user.permissions.includes(permission)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    }
}
