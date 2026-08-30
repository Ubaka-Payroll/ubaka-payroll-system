import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor to attach Bearer token
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('ubaka_engineer_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    error => Promise.reject(error)
)

// Response interceptor for error handling
api.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
    }
)

export default api
