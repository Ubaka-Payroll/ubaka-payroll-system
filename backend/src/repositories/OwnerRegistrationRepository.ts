import { Pool } from 'pg'
import DatabaseManager from '../config/database'
import { OwnerRegistrationRequest, CreateOwnerRegistrationRequest } from '../models/OwnerRegistrationRequest'
import { randomBytes } from 'crypto'

function makeKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let res = ''
    for (let i = 0; i < 16; i += 1) {
        res += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `UBK-${res.slice(0, 4)}-${res.slice(4, 8)}-${res.slice(8, 12)}-${res.slice(12)}`
}

export class OwnerRegistrationRepository {
    private pool: Pool

    constructor() {
        this.pool = DatabaseManager.getInstance().getPool()
    }

    async create(data: CreateOwnerRegistrationRequest): Promise<OwnerRegistrationRequest> {
        const query = `
      INSERT INTO owner_registration_request (
        full_name, email, password_hash, phone, company_name, number_of_sites, site_names
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, full_name, email, phone, company_name, number_of_sites, site_names, status, created_at
    `
        const values = [
            data.full_name,
            data.email,
            data.password_hash || null,
            data.phone || null,
            data.company_name,
            data.number_of_sites,
            data.site_names
        ]
        const result = await this.pool.query(query, values)
        return result.rows[0]
    }

    async findAll(status?: string): Promise<OwnerRegistrationRequest[]> {
        let query = 'SELECT id, full_name, email, phone, company_name, number_of_sites, site_names, status, rejection_reason, subscription_key, created_at, reviewed_at, reviewed_by, notes FROM owner_registration_request'
        const values: any[] = []

        if (status) {
            query += ' WHERE status = $1'
            values.push(status)
        }

        query += ' ORDER BY created_at DESC'

        const result = await this.pool.query(query, values)
        return result.rows
    }

    async findById(id: string): Promise<OwnerRegistrationRequest | null> {
        const query = 'SELECT * FROM owner_registration_request WHERE id = $1'
        const result = await this.pool.query(query, [id])
        return result.rows[0] || null
    }

    async findByEmail(email: string): Promise<OwnerRegistrationRequest | null> {
        const query = 'SELECT * FROM owner_registration_request WHERE email = $1'
        const result = await this.pool.query(query, [email])
        return result.rows[0] || null
    }

    async approve(id: string, adminId: string): Promise<OwnerRegistrationRequest> {
        const client = await this.pool.connect()
        try {
            await client.query('BEGIN')

            // Fetch the registration request
            const reqRes = await client.query('SELECT * FROM owner_registration_request WHERE id = $1', [id])
            const request = reqRes.rows[0]
            if (!request) {
                throw new Error('Registration request not found')
            }

            const subscriptionKey = `UBAKA-${randomBytes(16).toString('hex').toUpperCase()}`

            // 1. Create or update app_user for the site owner
            const userRes = await client.query(
                `INSERT INTO app_user (email, password_hash, full_name, role, company_name, phone)
                 VALUES ($1, $2, $3, 'SITE_OWNER', $4, $5)
                 ON CONFLICT (email) DO UPDATE SET 
                   password_hash = COALESCE(EXCLUDED.password_hash, app_user.password_hash),
                   full_name = EXCLUDED.full_name,
                   company_name = EXCLUDED.company_name,
                   phone = EXCLUDED.phone
                 RETURNING id`,
                [
                    request.email,
                    request.password_hash || '$2b$10$e.R.w1Z1J0x9dY1w1Z1J0e.R.w1Z1J0x9dY1w1Z1J0e.R.w1Z1J0', // fallback hash if none
                    request.full_name,
                    request.company_name,
                    request.phone,
                ]
            )
            const ownerId = userRes.rows[0].id

            // 2. Create subscription
            await client.query(
                `INSERT INTO subscription (owner_id, status, plan_name, seats, starts_at, ends_at)
                 VALUES ($1, 'ACTIVE', $2, $3, NOW(), NOW() + INTERVAL '1 year')`,
                [ownerId, `${request.number_of_sites} Site Plan`, request.number_of_sites]
            )

            // 3. Issue activation keys for each site
            const siteNames: string[] = request.site_names || []
            for (let i = 0; i < request.number_of_sites; i += 1) {
                const key = makeKey()
                const siteName = siteNames[i] || `Site ${i + 1}`
                await client.query(
                    `INSERT INTO activation_key (key, owner_id, site_name, status) VALUES ($1, $2, $3, 'AVAILABLE')`,
                    [key, ownerId, siteName]
                )
            }

            // 4. Update owner_registration_request status
            const updateRes = await client.query(
                `UPDATE owner_registration_request
                 SET 
                   status = 'approved',
                   subscription_key = $1,
                   reviewed_at = CURRENT_TIMESTAMP,
                   reviewed_by = $2
                 WHERE id = $3
                 RETURNING id, full_name, email, phone, company_name, number_of_sites, site_names, status, subscription_key, created_at, reviewed_at`,
                [subscriptionKey, adminId, id]
            )

            await client.query('COMMIT')
            return updateRes.rows[0]
        } catch (err) {
            await client.query('ROLLBACK')
            throw err
        } finally {
            client.release()
        }
    }

    async reject(id: string, adminId: string, reason: string): Promise<OwnerRegistrationRequest> {
        const query = `
      UPDATE owner_registration_request
      SET 
        status = 'rejected',
        rejection_reason = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $2
      WHERE id = $3
      RETURNING id, full_name, email, phone, company_name, number_of_sites, site_names, status, rejection_reason, created_at, reviewed_at
    `
        const result = await this.pool.query(query, [reason, adminId, id])
        return result.rows[0]
    }

    async updateNotes(id: string, notes: string): Promise<void> {
        const query = 'UPDATE owner_registration_request SET notes = $1 WHERE id = $2'
        await this.pool.query(query, [notes, id])
    }
}
