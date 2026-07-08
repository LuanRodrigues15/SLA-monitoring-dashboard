import { apiClient } from './client'
import type { User, Role } from '../types'

export interface UserCreate {
  name: string
  email: string
  password: string
  role: Role
}

export interface UserUpdate {
  name?: string
  email?: string
  password?: string
  role?: Role
  active?: boolean
}

export const listUsers = (): Promise<User[]> =>
  apiClient.get('/api/users').then((r) => r.data)

export const createUser = (body: UserCreate): Promise<User> =>
  apiClient.post('/api/users', body).then((r) => r.data)

export const updateUser = (id: string, body: UserUpdate): Promise<User> =>
  apiClient.put(`/api/users/${id}`, body).then((r) => r.data)

export const deactivateUser = (id: string): Promise<void> =>
  apiClient.delete(`/api/users/${id}`)
