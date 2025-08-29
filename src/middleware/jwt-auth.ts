import type {Request, Response, NextFunction} from 'express';
import {jwtAuthService} from '../services/jwt-auth.service';

export interface AuthenticatedRequest extends Request {
    user?: {
        userId:string;
        email:string;
        role:string;
    }
}

// Middleware to verify JWT token
export const verifyJwtToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
    ) => {
        try{
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({error: 'No token provided'});
            }

            const token = authHeader.split('Bearer ')[1];

            if (!token) {
                return res.status(401).json({error: 'No token provided'});
            }

            //verify token using jwtAuthService
            const payload = jwtAuthService.verifyToken(token);
            req.user = {
                userId: (await payload).userId,
                email: (await payload).email,
                role: (await payload).role
            };
            next();
        } catch (error) {
            return res.status(401).json({
                error: 'Invalid token',
                message: error instanceof Error ? error.message : 'Authentication failed'
            });
        }
    }

    // Middleware to require specific roles

    export const requireRole = (roles: string | string[]) => {
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user){
                return res.status(401).json({error: 'Unauthorized'});
            }

            if (!allowedRoles.includes(req.user.role)){
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: allowedRoles,
                    current: req.user.role
                });
            }
            next();
        };
    }

    export const requireAdmin = requireRole(['admin']);

    export const requireStaff = requireRole(['staff', 'admin']);

    export const requireDriver = requireRole (['driver', 'staff', 'admin']);

    export const optionalAuth = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
        ) => {
            try {
                const authHeader = req.headers.authorization;

                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.split('Bearer ')[1];

                    if (token) {
                        try{
                            const payload = await jwtAuthService.verifyToken(token);
                            req.user = {
                                userId: payload.userId,
                                email: payload.email,
                                role: payload.role
                            };
                        } catch (error) {
                            //Token is invalid, but we don't fail, we just continue withou the user
                            console.warn('Optional auth failed:', error);
                        }
                    }
            }
            next();
            } catch (error) {
                next();
            }
        };
    
        export const requireOwnerOrStaff = (userIdParam: string = 'userId') => {
            return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
                if (!req.user) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const requestedUserId = req.params[userIdParam];

                const isOwner = req.user.userId === requestedUserId;
                const isStaff = ['staff', 'admin'].includes(req.user.role);

                if (!isOwner && !isStaff) {
                    return res.status(403).json({
                        error: 'Insufficient permissions' 
                    });
                }

                next();
            };
        };