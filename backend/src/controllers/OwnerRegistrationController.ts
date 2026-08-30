import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { OwnerRegistrationRepository } from '../repositories/OwnerRegistrationRepository'
import { EmailService } from '../services/EmailService'
import { pool } from '../services/portalMappers'
import { logger } from '../utils/Logger'

export class OwnerRegistrationController {
    private repo: OwnerRegistrationRepository

    constructor() {
        this.repo = new OwnerRegistrationRepository()
    }

    /**
     * Public registration endpoint for owners
     * POST /api/owner-registration/register
     */
    public register = async (req: Request, res: Response): Promise<void> => {
        try {
            const { full_name, email, password, phone, company_name, number_of_sites, site_names } = req.body

            // Validation
            if (!full_name || !email || !password || !company_name || !number_of_sites || !site_names) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields (full_name, email, password, company_name, number_of_sites, site_names)'
                })
                return
            }

            if (typeof password !== 'string' || password.length < 6) {
                res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters'
                })
                return
            }

            if (!Array.isArray(site_names) || site_names.length !== number_of_sites) {
                res.status(400).json({
                    success: false,
                    error: 'Number of site names must match number_of_sites'
                })
                return
            }

            // Check if email already registered
            const existing = await this.repo.findByEmail(email)
            if (existing) {
                res.status(409).json({
                    success: false,
                    error: 'An owner request with this email already exists'
                })
                return
            }

            const password_hash = await bcrypt.hash(password, 10)

            const registration = await this.repo.create({
                full_name,
                email,
                password_hash,
                phone,
                company_name,
                number_of_sites,
                site_names
            })

            logger.info('Owner registration request created', { email, company_name })

            // Real-time Email Notifications via Resend
            EmailService.sendOwnerRegistrationReceived(
                registration.email,
                registration.full_name,
                registration.company_name,
                registration.number_of_sites
            ).catch(err => logger.error('Failed sending owner confirmation email', err))

            EmailService.sendAdminNewRegistrationNotice(
                'sysadmin@ubaka.com',
                registration.full_name,
                registration.company_name,
                registration.number_of_sites
            ).catch(err => logger.error('Failed sending admin registration alert email', err))

            res.status(201).json({
                success: true,
                data: {
                    id: registration.id,
                    email: registration.email,
                    status: registration.status,
                    created_at: registration.created_at
                }
            })
        } catch (error: any) {
            logger.error('Error creating owner registration', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to create registration request'
            })
        }
    }

    /**
     * Get all registration requests (Admin only)
     * GET /api/admin/owner-registration
     */
    public getAllRequests = async (req: Request, res: Response): Promise<void> => {
        try {
            const { status } = req.query
            const requests = await this.repo.findAll(status as string)

            res.json({
                success: true,
                data: requests
            })
        } catch (error: any) {
            logger.error('Error fetching registration requests', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to fetch registration requests'
            })
        }
    }

    /**
     * Approve registration request (Admin only)
     * POST /api/admin/owner-registration/:id/approve
     */
    public approve = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params
            const adminId = (req as any).user.id

            const request = await this.repo.findById(String(id))
            if (!request) {
                res.status(404).json({
                    success: false,
                    error: 'Registration request not found'
                })
                return
            }

            if (request.status !== 'pending') {
                res.status(400).json({
                    success: false,
                    error: 'Request already processed'
                })
                return
            }

            const approved = await this.repo.approve(String(id), adminId)

            logger.info('Owner registration approved', {
                email: approved.email,
                subscription_key: approved.subscription_key
            })

            // Send Real-time Approval Email with credentials and activation keys
            try {
                const userRes = await pool().query('SELECT id FROM app_user WHERE LOWER(email) = LOWER($1)', [approved.email])
                const ownerUserId = userRes.rows[0]?.id
                const keyRes = await pool().query('SELECT key, site_name FROM activation_key WHERE owner_id = $1', [ownerUserId])
                const keys = keyRes.rows.map((r: any) => ({ key: r.key, siteName: r.site_name || 'Construction Site' }))

                EmailService.sendOwnerRegistrationApproved(
                    approved.email,
                    approved.full_name,
                    approved.company_name,
                    keys
                ).catch(err => logger.error('Failed sending owner approval email', err))
            } catch (err) {
                logger.error('Failed querying keys for approval email', err as Error)
            }

            res.json({
                success: true,
                data: approved
            })
        } catch (error: any) {
            logger.error('Error approving registration', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to approve registration'
            })
        }
    }

    /**
     * Reject registration request (Admin only)
     * POST /api/admin/owner-registration/:id/reject
     */
    public reject = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params
            const { reason } = req.body
            const adminId = (req as any).user.id

            if (!reason) {
                res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                })
                return
            }

            const request = await this.repo.findById(String(id))
            if (!request) {
                res.status(404).json({
                    success: false,
                    error: 'Registration request not found'
                })
                return
            }

            if (request.status !== 'pending') {
                res.status(400).json({
                    success: false,
                    error: 'Request already processed'
                })
                return
            }

            const rejected = await this.repo.reject(String(id), adminId, reason)

            logger.info('Owner registration rejected', { email: rejected.email, reason })

            // Send Real-time Rejection Email
            EmailService.sendOwnerRegistrationRejected(
                rejected.email,
                rejected.full_name,
                rejected.company_name,
                reason
            ).catch(err => logger.error('Failed sending owner rejection email', err))

            res.json({
                success: true,
                data: rejected
            })
        } catch (error: any) {
            logger.error('Error rejecting registration', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to reject registration'
            })
        }
    }

    /**
     * Update notes (Admin only)
     * PUT /api/admin/owner-registration/:id/notes
     */
    public updateNotes = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params
            const { notes } = req.body

            await this.repo.updateNotes(String(id), notes)

            res.json({
                success: true,
                message: 'Notes updated'
            })
        } catch (error: any) {
            logger.error('Error updating notes', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to update notes'
            })
        }
    }
}
