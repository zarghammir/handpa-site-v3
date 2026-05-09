import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useInactivityTimeout from '../hooks/useInactivityTimeout'

// 30-minute auto sign-out applies to anything wrapped by ProtectedRoute.
const INACTIVITY_MINUTES = 30

export default function ProtectedRoute({ children, requiredRole }) {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hook is safe to call unconditionally — it only does anything once mounted.
  // If the user isn't logged in we Navigate away below before any timer matters.
  useInactivityTimeout(INACTIVITY_MINUTES)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setSession(null)
        setLoading(false)
        return
      }

      setSession(session)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      setRole(profile?.role ?? null)
      setLoading(false)
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-forest">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/login" replace />
  }

  return children
}
