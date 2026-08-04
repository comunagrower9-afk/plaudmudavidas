import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  isAdmin: boolean
  checkIsAdmin: () => Promise<boolean>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const checkIsAdmin = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('current_user_is_admin')
      if (error || !data) {
        setIsAdmin(false)
        return false
      }
      const adminVerified = Boolean(data)
      setIsAdmin(adminVerified)
      return adminVerified
    } catch {
      setIsAdmin(false)
      return false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) {
          setSession(data.session)
          setUser(data.session?.user ?? null)
          if (data.session?.user) {
            await checkIsAdmin()
          } else {
            setIsAdmin(false)
          }
        }
      } catch {
        if (mounted) {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        await checkIsAdmin()
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [checkIsAdmin])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setSession(null)
      setUser(null)
      setIsAdmin(false)
      // Limpa dados transitórios de sessão
      sessionStorage.removeItem('plaud_auth_email')
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      isAdmin,
      checkIsAdmin,
      signOut,
    }),
    [session, user, loading, isAdmin, checkIsAdmin, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
