import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/Logger'

export type Role = 'SYSTEM_ADMIN' | 'SITE_OWNER' | 'FIELD_ENGINEER'

export interface AuthUser {
  id: string
  email: string
  role: Role
  fullName: string
  ownerId?: string
  engineerId?: string
  siteName?: string
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

let warnedEmptyAllowlist = false

/**
 * ADMIN_ALLOWED_EMAILS is the source of truth for System Admin sysadmin-dashboard
 * access. An unset/empty value fails closed (no one is allowed) rather than
 * silently granting access to every SYSTEM_ADMIN account.
 */
export function isAllowedAdminEmail(email: string | undefined | null): boolean {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || ''
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowed.length === 0) {
    if (!warnedEmptyAllowlist) {
      warnedEmptyAllowlist = true
      logger.warn('ADMIN_ALLOWED_EMAILS is not set — all System Admin dashboard access is denied')
    }
    return false
  }

  return !!email && allowed.includes(email.trim().toLowerCase())
}

export function requireAdminAllowlist(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAllowedAdminEmail(req.user.email)) {
    return res.status(403).json({ error: 'Not on the sysadmin allowlist' })
  }
  next()
}
