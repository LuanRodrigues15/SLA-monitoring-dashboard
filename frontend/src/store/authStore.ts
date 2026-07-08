import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Role } from '../types'
import { apiClient } from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const resp = await apiClient.post('/api/auth/login', { email, password })
        const { access_token, user } = resp.data
        set({ token: access_token, user })
      },

      logout: () => {
        set({ token: null, user: null })
      },

      hasRole: (...roles) => {
        const user = get().user
        if (!user) return false
        return roles.includes(user.role)
      },
    }),
    {
      name: 'dash-vi-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
