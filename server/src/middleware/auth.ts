import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole } from '../models';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      userRole?: UserRole;
    }
  }
}

interface JWTPayload {
  userId: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Verify JWT and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as JWTPayload;

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid token or user deactivated.' });
      return;
    }

    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired. Please login again.' });
      return;
    }
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

/**
 * Role-Based Access Control middleware
 * Usage: authorize(UserRole.ADMIN, UserRole.ANALYST)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        error: 'Insufficient permissions. Required roles: ' + allowedRoles.join(', '),
      });
      return;
    }
    next();
  };
};

/**
 * Optional auth — attaches user if token present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as JWTPayload;
      const user = await User.findById(decoded.userId);
      if (user && user.isActive) {
        req.user = user;
        req.userId = decoded.userId;
        req.userRole = decoded.role;
      }
    }
  } catch {
    // Silently continue without auth
  }
  next();
};
