export interface OwnerRegistrationRequest {
    id: string
    full_name: string
    email: string
    password_hash?: string
    phone?: string
    company_name: string
    number_of_sites: number
    site_names: string[]
    status: 'pending' | 'approved' | 'rejected'
    rejection_reason?: string
    subscription_key?: string
    created_at: Date
    reviewed_at?: Date
    reviewed_by?: string
    notes?: string
}

export interface CreateOwnerRegistrationRequest {
    full_name: string
    email: string
    password?: string
    password_hash?: string
    phone?: string
    company_name: string
    number_of_sites: number
    site_names: string[]
}
