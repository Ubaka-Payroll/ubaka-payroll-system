import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type Role = 'SYSTEM_ADMIN' | 'SITE_OWNER' | 'FIELD_ENGINEER'

export interface AuthUser {
  id: string
  email: string
  role: Role
  fullName: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const secret = () => process.env.JWT_SECRET || 'dev-secret'

export function signToken(user: AuthUser) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn']
  return jwt.sign(user, secret(), { expiresIn })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    const payload = jwt.verify(header.slice(7), secret()) as AuthUser
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}
