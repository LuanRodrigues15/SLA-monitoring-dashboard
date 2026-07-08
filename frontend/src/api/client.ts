import axios from 'axios'
import { mockAdapter } from './mock/adapter'

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 60000,
  adapter: isDemoMode ? mockAdapter : undefined,
})

apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('dash-vi-auth')
  if (raw) {
    const parsed = JSON.parse(raw) as { state?: { token?: string } }
    const token = parsed?.state?.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginEndpoint = err.config?.url?.includes('/api/auth/login')
    if (err.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('dash-vi-auth')
      window.location.href = `${import.meta.env.BASE_URL}#/login`
    }
    return Promise.reject(err)
  }
)
