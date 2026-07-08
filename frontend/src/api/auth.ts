import { apiClient } from './client'
import type { User } from '../types'

export const fetchMe = (): Promise<User> =>
  apiClient.get('/api/auth/me').then((r) => r.data)

export const changePassword = (current_password: string, new_password: string): Promise<void> =>
  apiClient.post('/api/auth/change-password', { current_password, new_password })
