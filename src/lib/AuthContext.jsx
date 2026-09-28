import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth as useClerkAuth, useUser as useClerkUser, useClerk } from '@clerk/clerk-react'
import { base44 } from '@/api/base44Client'

/**
 * AuthContext exposes the exact shape App.jsx and existing pages already
 * consume: {user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
 * authError, logout, navigateToLogin, appPublicSettings, checkAppState}.
 *
 * Under the hood everything is Clerk. `user` is the DB row from
 * /api/auth/me (has role, is_seller, seller_profile_id — the fields the
 * frontend actually reads). `appPublicSettings` and the loader stay for
 * source-compat; nothing in the new stack needs them, so they're never-
 * loading no-ops.
 */
const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const clerk = useClerk()
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth()
  const { user: clerkUser } = useClerkUser()

  const [dbUser, setDbUser] = useState(null)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [authError, setAuthError] = useState(null)

  const loadDbUser = useCallback(async () => {
    try {
      setIsLoadingAuth(true)
      setAuthError(null)
      const me = await base44.auth.me()
      setDbUser(me)
    } catch (err) {
      setDbUser(null)
      if (err?.status === 401 || err?.status === 403) {
        setAuthError({ type: 'auth_required', message: err.message ?? 'Authentication required' })
      } else {
        setAuthError({ type: 'unknown', message: err?.message ?? 'Failed to load user' })
      }
    } finally {
      setIsLoadingAuth(false)
    }
  }, [])

  useEffect(() => {
    if (!clerkLoaded) return
    if (!isSignedIn) {
      setDbUser(null)
      setIsLoadingAuth(false)
      setAuthError({ type: 'auth_required', message: 'Authentication required' })
      return
    }
    loadDbUser()
  }, [clerkLoaded, isSignedIn, clerkUser?.id, loadDbUser])

  const logout = useCallback((shouldRedirect = true) => {
    setDbUser(null)
    clerk.signOut({
      redirectUrl: shouldRedirect ? '/sign-in' : undefined,
    }).catch(() => {})
  }, [clerk])

  const navigateToLogin = useCallback(() => {
    const target = window.location.href
    const search = new URLSearchParams({ redirect_url: target }).toString()
    window.location.assign(`/sign-in?${search}`)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user: dbUser,
        isAuthenticated: !!dbUser,
        isLoadingAuth: !clerkLoaded || isLoadingAuth,
        // Kept for source-compat with App.jsx / older callers — the new
        // stack has no public-settings bootstrap step.
        isLoadingPublicSettings: false,
        appPublicSettings: null,
        authError,
        logout,
        navigateToLogin,
        checkAppState: loadDbUser,
        refreshUser: loadDbUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
