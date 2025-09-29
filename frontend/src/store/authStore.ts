import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserInfo } from '../types'

interface AuthState {
  isAuthenticated: boolean
  user: UserInfo | null
  accessToken: string | null
  refreshToken: string | null
  login: (token: string, refreshToken: string, user: UserInfo) => void
  logout: () => void
  updateUser: (user: Partial<UserInfo>) => void
  setTokens: (accessToken: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,

      login: (accessToken: string, refreshToken: string, user: UserInfo) => {
        set({
          isAuthenticated: true,
          user,
          accessToken,
          refreshToken,
        })
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
        })
      },

      updateUser: (userData: Partial<UserInfo>) => {
        const currentUser = get().user
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          })
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)