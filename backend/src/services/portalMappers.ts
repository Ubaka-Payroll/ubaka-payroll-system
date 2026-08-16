import { Pool } from 'pg'
import DatabaseManager from '../config/database'

export function pool(): Pool {
  return DatabaseManager.getInstance().getPool()
}

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return d.toISOString().slice(0, 10)
}

export function mapUser(row: any) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role,
    companyName: row.company_name ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: iso(row.created_at),
  }
}

export function publicUser(row: any) {
  const user = mapUser(row)
  if (!user) return null
  const { passwordHash: _pw, ...rest } = user
  return rest
}

export function mapRequest(row: any) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    companyName: row.company_name,
    phone: row.phone,
    message: row.message ?? undefined,
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: iso(row.reviewed_at) ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: iso(row.created_at),
  }
}

export function mapSubscription(row: any) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    planName: row.plan_name,
    seats: Number(row.seats),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    createdAt: iso(row.created_at),
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    companyName: row.company_name,
    keysIssued: row.keys_issued != null ? Number(row.keys_issued) : undefined,
    keysUsed: row.keys_used != null ? Number(row.keys_used) : undefined,
  }
}

export function mapEngineer(row: any) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    siteName: row.site_name,
    status: row.status,
    activationKeyId: row.activation_key_id ?? undefined,
    activationKey: row.activation_key ?? null,
    userId: row.user_id ?? undefined,
    createdAt: iso(row.created_at),
    activatedAt: iso(row.activated_at) ?? undefined,
  }
}

export function mapKey(row: any) {
  return {
    id: row.id,
    key: row.key,
    ownerId: row.owner_id,
    engineerId: row.engineer_id ?? undefined,
    siteName: row.site_name ?? undefined,
    status: row.status,
    createdAt: iso(row.created_at),
    usedAt: iso(row.used_at) ?? undefined,
    engineerName: row.engineer_name ?? null,
    engineerEmail: row.engineer_email ?? null,
  }
}

export function makeKey() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `UBAKA-${chunk()}-${chunk()}-${chunk()}`
}
